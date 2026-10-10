import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendBirthdayReminderEmail, sendBirthdayWishEmail, sendNewsSummaryEmail, sendPortfolioInsiderEmail, sendPriceAlertEmail, sendWelcomeEmail, type StockNewsGroup} from "@/lib/nodemailer";
import { ANALYSIS_APPROACH_OPTIONS, ASSET_CLASS_OPTIONS, birthdaysOn, COVERAGE_SECTOR_OPTIONS, EXPERIENCE_LEVELS, optionLabel } from "@/lib/member-profile";
import { getStockQuote } from "@/lib/actions/finnhub.actions";
import { getYahooQuote } from "@/lib/actions/yahoo.actions";
import { getDailyMarketNews, getTodaysStockNews } from "@/lib/actions/news.actions";
import { MARKETS, roleLabel, type MarketKey } from "@/lib/markets";
import { getEmailMembers, getWatchlistStocks } from "@/lib/email-members";
import { INSIDER_AUTOMATION, NEWS_AUTOMATION, wantsEmail } from "@/lib/email-preferences";
import { TeamHolding } from "@/database/models/team-holding.model";
import { advanceCollection } from "@/lib/valuation/collect";
import { getFormattedTodayDate } from "@/lib/utils";
import { connectToDatabase } from "@/database/mongoose";
import { AlertModel } from "@/database/models/alert.model";
import { ALERT_CHECK_CRON, ALERT_FREQUENCY_MS } from "@/lib/constants";
import { BRANDS, brandFor } from "@/lib/brand";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Role: ${roleLabel(event.data.teamRole)}
            - Preferred analysis approach: ${optionLabel(ANALYSIS_APPROACH_OPTIONS, event.data.analysisApproach) ?? 'not given'}
            - Asset class focus: ${optionLabel(ASSET_CLASS_OPTIONS, event.data.assetClassFocus) ?? 'not given'}
            - Sector they'd like to cover: ${optionLabel(COVERAGE_SECTOR_OPTIONS, event.data.coverageSector) ?? 'not given'}
            - Trading experience: ${optionLabel(EXPERIENCE_LEVELS, event.data.tradingExperience) ?? 'not given'}
            - Investment management experience: ${optionLabel(EXPERIENCE_LEVELS, event.data.investmentManagementExperience) ?? 'not given'}
            - Skills: ${Array.isArray(event.data.skills) && event.data.skills.length ? event.data.skills.join(', ') : 'not given'}
        `

        // Each team's members get their own team's logo and name
        const brand = brandFor(event.data);
        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile).replaceAll('{{team}}', BRANDS[brand].team)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-flash-lite-latest' }),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }]
            }
        })

        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText = (part && 'text' in part ? part.text : null) || `Thanks for joining the ${BRANDS[brand].teamName}. You now have the tools to track markets, spot opportunities, and make smarter moves — all in one place.`

            const { data: { email, name } } = event;

            return await sendWelcomeEmail({ email, name, intro: introText, brand });
        })

        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)

// Every afternoon: one summary of each department's market news (global markets, or the JSE and South Africa),
// summarised once per department and sent to everyone who gets that department's news
export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news' }, { cron: '0 12 * * *' } ],
    async ({ step }) => {
        const members = await step.run('get-members', getEmailMembers);
        let sent = 0;

        for (const market of ['global', 'local'] as MarketKey[]) {
            const recipients = members.filter((m) => wantsEmail(m, NEWS_AUTOMATION[market]));
            if (recipients.length === 0) continue;

            const articles = await step.run(`fetch-${market}-news`, () => getDailyMarketNews(market, 6));
            if (articles.length === 0) continue;

            const response = await step.ai.infer(`summarize-${market}-news`, {
                model: step.ai.models.gemini({ model: 'gemini-flash-lite-latest' }),
                body: { contents: [{ role: 'user', parts: [{ text: NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2)) }] }] },
            });
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const newsContent = part && 'text' in part ? part.text : null;
            if (!newsContent) continue;

            sent += await step.run(`send-${market}-news`, async () => {
                const date = getFormattedTodayDate();
                const results = await Promise.allSettled(recipients.map((m) =>
                    sendNewsSummaryEmail({ email: m.email, date, newsContent, brand: brandFor(m), market })
                ));
                results.forEach((r, i) => { if (r.status === 'rejected') console.error('daily-news: send failed', recipients[i].id, r.reason); });
                return results.filter((r) => r.status === 'fulfilled').length;
            });
        }

        return { success: true, message: `${sent} daily news email(s) sent` };
    }
)

// Runs a function over items a few at a time, so news requests stay within the providers' rate limits
const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    }));
    return out;
};

const stockNews = (market: MarketKey, stocks: { symbol: string; company: string }[]): Promise<StockNewsGroup[]> =>
    mapLimit(stocks, 4, async (s) => ({ ...s, articles: await getTodaysStockNews(market, s.symbol, s.company).catch(() => []) }));

// Every evening (18:00 South African time, after the JSE closes): the GMIT and LMIT Portfolio Insider. Sent for a
// department while its team portfolio holds shares: the day's news on the holdings, then on each member's starred stocks.
export const sendPortfolioInsider = inngest.createFunction(
    { id: 'portfolio-insider' },
    [ { event: 'app/portfolio.insider' }, { cron: 'TZ=Africa/Johannesburg 0 18 * * *' } ],
    async ({ step }) => {
        const members = await step.run('get-members', getEmailMembers);
        let sent = 0;

        for (const market of ['global', 'local'] as MarketKey[]) {
            const recipients = members.filter((m) => wantsEmail(m, INSIDER_AUTOMATION[market]));
            if (recipients.length === 0) continue;

            const holdings = await step.run(`${market}-holdings`, async () => {
                await connectToDatabase();
                const items = await TeamHolding.find({ market }, { symbol: 1, company: 1 }).sort({ symbol: 1 }).lean();
                return items.map((h) => ({ symbol: String(h.symbol), company: String(h.company ?? h.symbol) }));
            });
            if (holdings.length === 0) continue;

            const portfolio = await step.run(`${market}-portfolio-news`, () => stockNews(market, holdings));

            // Each recipient's starred stocks, leaving out those the portfolio holds (their news is already above)
            const held = new Set(holdings.map((h) => h.symbol));
            // Step results come back through JSON; these are plain strings, so the shape survives as is
            const watchlists = await step.run(`${market}-watchlists`, () =>
                Promise.all(recipients.map(async (m) => ({ id: m.id, stocks: await getWatchlistStocks(m.id, market).catch(() => []) })))
            ) as { id: string; stocks: { symbol: string; company: string }[] }[];
            const starred = new Map(watchlists.map((w) => [w.id, w.stocks]));
            const extra = new Map<string, { symbol: string; company: string }>();
            watchlists.flatMap((w) => w.stocks).forEach((s) => { if (!held.has(s.symbol)) extra.set(s.symbol, s); });
            const watchlistNews = await step.run(`${market}-watchlist-news`, () => stockNews(market, [...extra.values()]));
            const newsBySymbol = new Map(watchlistNews.map((g) => [g.symbol, g]));

            sent += await step.run(`send-${market}-insider`, async () => {
                const date = getFormattedTodayDate();
                const results = await Promise.allSettled(recipients.map((m) => {
                    const mine = starred.get(m.id) ?? [];
                    return sendPortfolioInsiderEmail({
                        email: m.email,
                        brand: brandFor(m),
                        market,
                        date,
                        portfolio,
                        watchlist: mine.flatMap((s) => newsBySymbol.get(s.symbol) ?? []),
                        starredInPortfolio: mine.filter((s) => held.has(s.symbol)).length,
                    });
                }));
                results.forEach((r, i) => { if (r.status === 'rejected') console.error('portfolio-insider: send failed', recipients[i].id, r.reason); });
                return results.filter((r) => r.status === 'fulfilled').length;
            });
        }

        return { success: true, message: `${sent} Portfolio Insider email(s) sent` };
    }
)

export const checkStockAlerts = inngest.createFunction(
    { id: 'check-stock-alerts' },
    [ { event: 'app/alerts.check' }, { cron: ALERT_CHECK_CRON } ],
    async ({ step }) => {
        // Step #1: Find alerts whose condition is met and whose frequency window has passed
        const triggered = await step.run('evaluate-alerts', async () => {
            await connectToDatabase();
            const alerts = await AlertModel.find({}).lean();
            if (alerts.length === 0) return [];

            // Fresh quotes per market: Finnhub for global stocks, Yahoo Finance for JSE stocks
            const keys = [...new Set(alerts.map((a) => `${a.market === 'local' ? 'local' : 'global'}:${a.symbol}`))];
            const quotes = new Map(
                await Promise.all(keys.map(async (key) => {
                    const [market, symbol] = key.split(':');
                    if (market === 'local') {
                        const q = await getYahooQuote(`${symbol}.JO`, 0);
                        return [key, q ? { price: q.price, changePercent: q.changePercent, time: q.time } : null] as const;
                    }
                    const q = await getStockQuote(symbol, 0);
                    return [key, q?.c ? { price: q.c, changePercent: q.dp, time: q.t } : null] as const;
                }))
            );

            const now = Date.now();
            return alerts.flatMap((alert) => {
                const market = alert.market === 'local' ? 'local' : 'global';
                const quote = quotes.get(`${market}:${alert.symbol}`);
                const price = quote?.price;
                if (!price) return [];

                const conditionMet = alert.alertType === 'upper' ? price > alert.threshold : price < alert.threshold;
                if (!conditionMet) return [];

                const lastTriggered = alert.lastTriggeredAt ? new Date(alert.lastTriggeredAt).getTime() : 0;
                if (now - lastTriggered < ALERT_FREQUENCY_MS[alert.frequency]) return [];
                // No new trades since the last trigger (e.g. market closed), so don't repeat the email
                if (alert.lastTriggeredQuoteTime && quote?.time && quote.time <= alert.lastTriggeredQuoteTime) return [];

                return [{
                    alertId: String(alert._id),
                    userId: alert.userId,
                    symbol: alert.symbol,
                    company: alert.company,
                    alertType: alert.alertType,
                    threshold: alert.threshold,
                    currentPrice: price,
                    changePercent: quote?.changePercent,
                    quoteTime: quote?.time,
                    currency: MARKETS[market].currency,
                }];
            });
        });

        if (triggered.length === 0) return { success: true, message: 'No alerts triggered' };

        // Step #2: Email each user and record the trigger
        await step.run('send-alert-emails', async () => {
            const users = await getEmailMembers();
            const usersById = new Map(users.map((u) => [u.id, u]));
            const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' });

            await connectToDatabase();
            await Promise.all(
                triggered.map(async (alert) => {
                    const user = usersById.get(alert.userId);
                    if (!user) return;

                    try {
                        // The trigger is recorded either way; the email only goes to members who get price alerts
                        if (wantsEmail(user, 'alerts')) await sendPriceAlertEmail({
                            email: user.email,
                            brand: brandFor(user),
                            symbol: alert.symbol,
                            company: alert.company,
                            alertType: alert.alertType,
                            currentPrice: alert.currentPrice,
                            targetPrice: alert.threshold,
                            changePercent: alert.changePercent,
                            currency: alert.currency,
                            timestamp,
                        });
                        await AlertModel.updateOne(
                            { _id: alert.alertId },
                            { $set: { lastTriggeredAt: new Date(), lastTriggeredQuoteTime: alert.quoteTime } }
                        );
                    } catch (e) {
                        console.error('Failed to send price alert', alert.alertId, e);
                    }
                })
            );
        });

        return { success: true, message: `${triggered.length} alert(s) sent` };
    }
)

// Every morning at 07:00 (South African time): wish members happy birthday and remind everyone else on the team
export const sendBirthdayEmails = inngest.createFunction(
    { id: 'birthday-emails' },
    [ { event: 'app/birthdays.check' }, { cron: 'TZ=Africa/Johannesburg 0 7 * * *' } ],
    async ({ step }) => {
        const members = await step.run('find-birthdays', getEmailMembers);
        const today = birthdaysOn(new Date());
        const celebrants = members.filter((m) => m.birthday && today.includes(m.birthday));

        if (celebrants.length === 0) return { success: true, message: 'No birthdays today' };

        await step.run('send-birthday-wishes', async () => {
            await Promise.all(celebrants.filter((m) => wantsEmail(m, 'birthdayWish')).map((m) =>
                sendBirthdayWishEmail({ email: m.email, name: m.name, brand: brandFor(m) }).catch((e) => console.error('Birthday wish failed', m.id, e))
            ));
        });

        await step.run('send-birthday-reminders', async () => {
            for (const celebrant of celebrants) {
                const recipients = members
                    .filter((m) => m.id !== celebrant.id && wantsEmail(m, 'birthdayReminders'))
                    .map((m) => ({ email: m.email, brand: brandFor(m) }));
                if (recipients.length === 0) continue;
                await sendBirthdayReminderEmail({ recipients, name: celebrant.name, roleLabel: roleLabel(celebrant.teamRole) })
                    .catch((e) => console.error('Birthday reminder failed', celebrant.id, e));
            }
        });

        return { success: true, message: `${celebrants.length} birthday(s) celebrated` };
    }
)

// Collects a company's financials in the background (portfolio holdings, or a valuation someone started),
// one bounded step at a time
export const collectCompanyFinancials = inngest.createFunction(
    { id: 'collect-company-financials', concurrency: { limit: 2 } },
    { event: 'app/financials.collect' },
    async ({ event, step }) => {
        const { market, symbol } = event.data as { market: 'global' | 'local'; symbol: string };
        for (let i = 0; i < 12; i++) {
            const state = await step.run(`advance-${i}`, () => advanceCollection(market, symbol));
            if (!state || state.phase === 'done') return { success: true, phase: state?.phase ?? 'missing' };
            // Gives a busy AI service (or a viewer's page also collecting) a moment before the next step
            await step.sleep(`pause-${i}`, '5s');
        }
        return { success: true, phase: 'paused' };
    }
)
