import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendPriceAlertEmail, sendWelcomeEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail} from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail } from "@/lib/actions/watchlist.actions";
import { getNews, getStockQuote } from "@/lib/actions/finnhub.actions";
import { getYahooQuote } from "@/lib/actions/yahoo.actions";
import { getMarketNews, getNewsForStocks } from "@/lib/actions/news.actions";
import { LOCAL_STOCKS, marketForDepartment, MARKETS } from "@/lib/markets";
import { getFormattedTodayDate } from "@/lib/utils";
import { connectToDatabase } from "@/database/mongoose";
import { AlertModel } from "@/database/models/alert.model";
import { ALERT_CHECK_CRON, ALERT_FREQUENCY_MS } from "@/lib/constants";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
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
            const introText = (part && 'text' in part ? part.text : null) || 'Thanks for joining the Global Markets. You now have the tools to track markets, spot opportunities, and make smarter moves — all in one place.'

            const { data: { email, name } } = event;

            return await sendWelcomeEmail({ email, name, intro: introText });
        })

        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news' }, { cron: '0 12 * * *' } ],
    async ({ step }) => {
        // Step #1: Get all users for news delivery
        const users = await step.run('get-all-users', getAllUsersForNewsEmail)

        if(!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        // Step #2: For each user, get watchlist symbols -> fetch news (fallback to general)
        const results = await step.run('fetch-user-news', async () => {
            const perUser: Array<{ user: UserForNewsEmail; articles: MarketNewsArticle[] }> = [];
            for (const user of users as UserForNewsEmail[]) {
                try {
                    // Local Markets (LIMT) members get JSE news; everyone else gets global news
                    if (marketForDepartment(user.department) === 'local') {
                        const symbols = await getWatchlistSymbolsByEmail(user.email, 'local');
                        let articles = await getNewsForStocks('local', symbols.map((symbol) => ({ symbol, company: LOCAL_STOCKS.find((s) => s.symbol === symbol)?.name ?? symbol })), 6);
                        if (articles.length === 0) articles = await getMarketNews('local', 'local', 6);
                        perUser.push({ user, articles });
                        continue;
                    }

                    const symbols = await getWatchlistSymbolsByEmail(user.email);
                    let articles = await getNews(symbols);
                    // Enforce max 6 articles per user
                    articles = (articles || []).slice(0, 6);
                    // If still empty, fallback to general
                    if (!articles || articles.length === 0) {
                        articles = await getNews();
                        articles = (articles || []).slice(0, 6);
                    }
                    perUser.push({ user, articles });
                } catch (e) {
                    console.error('daily-news: error preparing user news', user.email, e);
                    perUser.push({ user, articles: [] });
                }
            }
            return perUser;
        });

        // Step #3: (placeholder) Summarize news via AI
        const userNewsSummaries: { user: UserForNewsEmail; newsContent: string | null }[] = [];

        for (const { user, articles } of results) {
                try {
                    const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));

                    const response = await step.ai.infer(`summarize-news-${user.email}`, {
                        model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                        body: {
                            contents: [{ role: 'user', parts: [{ text:prompt }]}]
                        }
                    });

                    const part = response.candidates?.[0]?.content?.parts?.[0];
                    const newsContent = (part && 'text' in part ? part.text : null) || 'No market news.'

                    userNewsSummaries.push({ user, newsContent });
                } catch (e) {
                    console.error('Failed to summarize news for : ', user.email);
                    userNewsSummaries.push({ user, newsContent: null });
                }
            }

        // Step #4: (placeholder) Send the emails
        await step.run('send-news-emails', async () => {
                await Promise.all(
                    userNewsSummaries.map(async ({ user, newsContent}) => {
                        if(!newsContent) return false;

                        return await sendNewsSummaryEmail({ email: user.email, date: getFormattedTodayDate(), newsContent })
                    })
                )
            })

        return { success: true, message: 'Daily news summary emails sent successfully' }
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
            const users = await getAllUsersForNewsEmail();
            const emailsById = new Map(users.map((u) => [u.id, u.email]));
            const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' });

            await connectToDatabase();
            await Promise.all(
                triggered.map(async (alert) => {
                    const email = emailsById.get(alert.userId);
                    if (!email) return;

                    try {
                        await sendPriceAlertEmail({
                            email,
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
