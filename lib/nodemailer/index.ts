import nodemailer from 'nodemailer';
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
    INACTIVE_USER_REMINDER_EMAIL_TEMPLATE,
    ANNOUNCEMENT_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";
import {formatPrice} from "@/lib/utils";
import {BRANDS, type TeamBrand} from "@/lib/brand";
import {MARKETS, marketHref, type MarketKey} from "@/lib/markets";

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    }
})

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');

// The header row: the recipient's team logo on the left (GMIT, LMIT, or UJ Invest for those over both) and the
// UJ Invest logo in line with it in the top right corner
const brandValues = (brand: TeamBrand) => {
    const { team, teamName, emailLogo } = BRANDS[brand];
    const uj = BRANDS.ujinvest.emailLogo;
    const corner = brand === 'ujinvest' ? '' : `
                                    <td align="right" valign="middle" width="40" style="width: 40px;"><img src="${BASE_URL}${uj.src}" alt="UJ Invest" width="40" style="display: block; width: 40px; height: auto; border: 0;"></td>`;
    return {
        team,
        teamName,
        logo: `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="left" valign="middle"><img src="${BASE_URL}${emailLogo.src}" alt="${team}" width="${emailLogo.width}" style="display: block; max-width: 100%; height: auto; border: 0;"></td>${corner}
                                </tr>
                            </table>`,
    };
};

// Replaces every occurrence of each {{placeholder}} in an email template
const fillTemplate = (template: string, values: Record<string, string>, brand: TeamBrand) =>
    Object.entries({ baseUrl: BASE_URL, ...brandValues(brand), ...values }).reduce(
        (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
        template
    );

const decodeEntities = (text: string) => text
    .replace(/&nbsp;/g, ' ').replace(/&rsquo;|&lsquo;|&#39;/g, "'").replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&middot;/g, '·').replace(/&bull;/g, '•').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&copy;/g, '©')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// The plain-text twin of an HTML email. Spam filters distrust a text part that doesn't match the HTML,
// so it carries the same words and links.
const htmlToText = (html: string) => decodeEntities(html
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return href.startsWith('mailto:') || !text || text === href ? text || href : `${text}: ${href}`;
    })
    .replace(/<\/li>\s*/gi, '')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|tr|div|ul|ol|table)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const sender = (label: string) => `"${label}" <${process.env.NODEMAILER_EMAIL}>`;

const send = (mail: { from: string; to?: string; bcc?: string[]; subject: string; html: string }) =>
    transporter.sendMail({ ...mail, text: htmlToText(mail.html) });

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name;

export const sendWelcomeEmail = async ({ email, name, intro, brand }: WelcomeEmailData & { brand: TeamBrand }) => {
    const { team } = BRANDS[brand];
    await send({
        from: sender(team),
        to: email,
        subject: `Welcome to ${team}, ${firstNameOf(name)}`,
        html: fillTemplate(WELCOME_EMAIL_TEMPLATE, { name, intro }, brand),
    });
}

// The daily summary of one department's market news: global markets, or the JSE and South Africa
export const sendNewsSummaryEmail = async (
    { email, date, newsContent, brand, market }: { email: string; date: string; newsContent: string; brand: TeamBrand; market: MarketKey }
): Promise<void> => {
    const scope = market === 'local' ? 'Local' : 'Global';
    await send({
        from: sender(`${BRANDS[brand].team} News`),
        to: email,
        subject: `Today's ${scope} Market News Summary - ${date}`,
        html: fillTemplate(NEWS_SUMMARY_EMAIL_TEMPLATE, { heading: `Today&rsquo;s ${scope} Market News Summary`, date, newsContent }, brand),
    });
};

export const sendPriceAlertEmail = async (
    { email, symbol, company, alertType, currentPrice, targetPrice, currency = 'USD', timestamp, brand }: StockAlertEmailData & { brand: TeamBrand }
): Promise<void> => {
    const template = alertType === 'upper' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;
    await send({
        from: sender(`${BRANDS[brand].team} Alerts`),
        to: email,
        subject: `🔔 ${symbol} just hit your alert`,
        html: fillTemplate(template, {
            symbol,
            company,
            currentPrice: formatPrice(currentPrice, currency),
            targetPrice: formatPrice(targetPrice, currency),
            timestamp,
        }, brand),
    });
};

export const sendInactiveUserReminderEmail = async (
    { email, name, brand }: { email: string; name: string; brand: TeamBrand }
): Promise<void> => {
    await send({
        from: sender(BRANDS[brand].team),
        to: email,
        subject: `🔔 ${name}, opportunities are waiting for you`,
        html: fillTemplate(INACTIVE_USER_REMINDER_EMAIL_TEMPLATE, { name, dashboardUrl: BASE_URL }, brand),
    });
};

const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// One stock's news for the Portfolio Insider
export type StockNewsGroup = { symbol: string; company: string; articles: MarketNewsArticle[] };

// Stories shown per stock; the rest are a click away on the stock's page
const INSIDER_STORIES_PER_STOCK = 5;

const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? escapeHtml(url) : '#');

const storyTime = (unix: number) =>
    new Date(unix * 1000).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' });

const insiderStory = (a: MarketNewsArticle) => {
    const summary = a.summary?.trim();
    return `<div class="dark-info-box" style="background-color: #212328; padding: 18px 20px; margin: 0 0 12px 0; border-radius: 8px;">
                                <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.4; color: #9CA3AF;">${escapeHtml(a.source)} &middot; ${storyTime(a.datetime)}</p>
                                <h4 class="dark-text" style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #FFFFFF; line-height: 1.4;">${escapeHtml(a.headline)}</h4>
                                ${summary ? `<p class="dark-text-secondary" style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6; color: #CCDADC;">${escapeHtml(summary.length > 280 ? `${summary.slice(0, 277)}…` : summary)}</p>` : ''}
                                <a href="${safeUrl(a.url)}" style="color: #3B82F6; text-decoration: none; font-weight: 500; font-size: 14px;" target="_blank" rel="noopener noreferrer">Read Full Story &rarr;</a>
                            </div>`;
};

const insiderSection = (title: string, intro: string, groups: StockNewsGroup[], stockUrl: (symbol: string) => string, empty: string) => {
    const withNews = groups.filter((g) => g.articles.length > 0);
    const quiet = groups.filter((g) => g.articles.length === 0);
    const stocks = withNews.map((g) => {
        const more = g.articles.length - INSIDER_STORIES_PER_STOCK;
        return `<h3 class="mobile-news-title dark-text" style="margin: 26px 0 12px 0; font-size: 17px; font-weight: 600; color: #f8f9fa; line-height: 1.3;"><strong style="color: #3B82F6;">${escapeHtml(g.symbol)}</strong> &middot; ${escapeHtml(g.company)} <span style="font-size: 13px; font-weight: 400; color: #9CA3AF;">(${g.articles.length} ${g.articles.length === 1 ? 'story' : 'stories'})</span></h3>
                            ${g.articles.slice(0, INSIDER_STORIES_PER_STOCK).map(insiderStory).join('\n                            ')}
                            ${more > 0 ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #9CA3AF;">${more} more on the <a href="${safeUrl(stockUrl(g.symbol))}" style="color: #3B82F6; text-decoration: underline;">${escapeHtml(g.symbol)} page</a>.</p>` : ''}`;
    }).join('\n                            ');
    return `<h2 class="dark-text" style="margin: 10px 0 6px 0; font-size: 21px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">${title}</h2>
                            <p class="dark-text-secondary" style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.5; color: #9CA3AF;">${intro}</p>
                            ${withNews.length ? stocks : `<p class="dark-text-secondary" style="margin: 12px 0 0 0; font-size: 15px; line-height: 1.6; color: #CCDADC;">${empty}</p>`}
                            ${withNews.length && quiet.length ? `<p style="margin: 16px 0 0 0; font-size: 13px; line-height: 1.5; color: #9CA3AF;">No news in the past 24 hours: ${quiet.map((g) => escapeHtml(g.symbol)).join(', ')}.</p>` : ''}`;
};

// The GMIT or LMIT Portfolio Insider: the past day's news on the team portfolio's holdings, then (below it) on
// the stocks this member has starred in that market's watchlist
export const sendPortfolioInsiderEmail = async (
    { email, brand, market, date, portfolio, watchlist, starredInPortfolio }:
    { email: string; brand: TeamBrand; market: MarketKey; date: string; portfolio: StockNewsGroup[]; watchlist: StockNewsGroup[]; starredInPortfolio: number }
): Promise<void> => {
    const team = MARKETS[market].team;
    const name = `${team} Portfolio Insider`;
    const stockUrl = (symbol: string) => `${BASE_URL}${marketHref(market, `/stocks/${encodeURIComponent(symbol)}`)}`;
    const watchlistEmpty = watchlist.length === 0
        ? (starredInPortfolio > 0
            ? 'The stocks you’ve starred are all in the portfolio, so their news is above.'
            : `You haven’t starred any ${market === 'local' ? 'JSE' : 'global'} stocks yet. Star stocks on your watchlist to follow their news here.`)
        : 'No news on the stocks you’ve starred in the past 24 hours.';

    const newsContent = [
        insiderSection('Portfolio news', `Everything published in the past 24 hours on the ${team} portfolio’s holdings.`, portfolio, stockUrl, 'No news on the portfolio’s holdings in the past 24 hours.'),
        '<div style="border-top: 1px solid #374151; margin: 32px 0 24px 0;"></div>',
        insiderSection('Your watchlist', starredInPortfolio > 0 && watchlist.length > 0 ? 'News on the stocks you’ve starred. Starred stocks the portfolio holds are covered above.' : 'News on the stocks you’ve starred.', watchlist, stockUrl, watchlistEmpty),
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0 0 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${BASE_URL}${marketHref(market, '/portfolio')}" style="display: inline-block; background: #3B82F6; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 500;">Open the ${team} portfolio</a>
                                    </td>
                                </tr>
                            </table>`,
    ].join('\n                            ');

    await send({
        from: sender(name),
        to: email,
        subject: `${name} - ${date}`,
        html: fillTemplate(NEWS_SUMMARY_EMAIL_TEMPLATE, { heading: name, date, newsContent }, brand),
    });
};

export type EmailRecipient = { email: string; brand: TeamBrand };

// A team notice in the announcement layout, sent to each team with its own logo. Recipients are Bcc'd
// in batches so nobody sees anyone else's address; returns how many addresses Gmail accepted.
const sendTeamNotice = async (
    { recipients, fromLabel, subject, title, message, label, dashboardPath }:
    { recipients: EmailRecipient[]; fromLabel?: string; subject: string; title: string; message: string; label: string; dashboardPath: string }
): Promise<number> => {
    const values = {
        title: escapeHtml(title),
        message: escapeHtml(message).replace(/\n/g, '<br>'),
        audience: escapeHtml(label),
        date: new Date().toLocaleDateString('en-ZA', { dateStyle: 'long', timeZone: 'Africa/Johannesburg' }),
        dashboardUrl: `${BASE_URL}${dashboardPath}`,
    };

    let sent = 0;
    for (const brand of Object.keys(BRANDS) as TeamBrand[]) {
        const addresses = recipients.filter((r) => r.brand === brand).map((r) => r.email);
        if (addresses.length === 0) continue;
        const html = fillTemplate(ANNOUNCEMENT_EMAIL_TEMPLATE, values, brand);
        const team = BRANDS[brand].team;

        for (let i = 0; i < addresses.length; i += 50) {
            const bcc = addresses.slice(i, i + 50);
            const info = await send({
                from: sender(fromLabel ? `${team} ${fromLabel}` : team),
                to: process.env.NODEMAILER_EMAIL,
                bcc,
                subject,
                html,
            });
            const accepted = new Set((info.accepted ?? []).map((a) => String(a).toLowerCase()));
            sent += bcc.filter((address) => accepted.has(address.toLowerCase())).length;
        }
    }
    return sent;
};

// An administrator announcement to a department's members
export const sendAnnouncementEmail = async (
    { recipients, title, message, audienceLabel, dashboardPath }: { recipients: EmailRecipient[]; title: string; message: string; audienceLabel: string; dashboardPath: string }
): Promise<number> =>
    sendTeamNotice({ recipients, fromLabel: 'Announcements', subject: `📢 ${title}`, title, message, label: audienceLabel, dashboardPath });

// Happy birthday to the member themselves
export const sendBirthdayWishEmail = async ({ email, name, brand }: { email: string; name: string; brand: TeamBrand }) => {
    const firstName = firstNameOf(name);
    return sendTeamNotice({
        recipients: [{ email, brand }],
        subject: `🎉 Happy birthday, ${firstName}!`,
        title: `Happy birthday, ${firstName}!`,
        message: 'Everyone on the GMIT and LMIT teams wishes you a wonderful birthday. Thank you for everything you bring to the portfolio. Enjoy your day!',
        label: 'Happy birthday',
        dashboardPath: '/',
    });
};

// Lets the rest of the team know whose birthday it is
export const sendBirthdayReminderEmail = async (
    { recipients, name, roleLabel }: { recipients: EmailRecipient[]; name: string; roleLabel: string }
) =>
    sendTeamNotice({
        recipients,
        subject: `🎂 It's ${name}'s birthday today`,
        title: `It's ${name}'s birthday today`,
        message: `${name} (${roleLabel}) is celebrating a birthday today. Take a moment to wish them well!`,
        label: 'Birthday reminder',
        dashboardPath: '/',
    });
