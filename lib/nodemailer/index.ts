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

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    }
})

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');

// Replaces every occurrence of each {{placeholder}} in an email template
const fillTemplate = (template: string, values: Record<string, string>) =>
    Object.entries({ baseUrl: BASE_URL, ...values }).reduce(
        (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
        template
    );

const sender = (label: string) => `"${label}" <${process.env.NODEMAILER_EMAIL}>`;

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    const htmlTemplate = fillTemplate(WELCOME_EMAIL_TEMPLATE, { name, intro });

    const mailOptions = {
        from: sender('GMIT'),
        to: email,
        subject: `Welcome to GMIT 🚀`,
        text: 'Thanks for joining GMIT',
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
): Promise<void> => {
    const htmlTemplate = fillTemplate(NEWS_SUMMARY_EMAIL_TEMPLATE, { date, newsContent });

    const mailOptions = {
        from: sender('GMIT News'),
        to: email,
        subject: `Today's Market News Summary - ${date}`,
        text: `Today's market news summary from GMIT`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendPriceAlertEmail = async (
    { email, symbol, company, alertType, currentPrice, targetPrice, currency = 'USD', timestamp }: StockAlertEmailData
): Promise<void> => {
    const template = alertType === 'upper' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;
    const htmlTemplate = fillTemplate(template, {
        symbol,
        company,
        currentPrice: formatPrice(currentPrice, currency),
        targetPrice: formatPrice(targetPrice, currency),
        timestamp,
    });

    const mailOptions = {
        from: sender('GMIT Alerts'),
        to: email,
        subject: `🔔 ${symbol} just hit your alert`,
        text: `${symbol} (${company}) is now ${formatPrice(currentPrice, currency)}, ${alertType === 'upper' ? 'above' : 'below'} your target of ${formatPrice(targetPrice, currency)}.`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendInactiveUserReminderEmail = async (
    { email, name }: { email: string; name: string }
): Promise<void> => {
    const htmlTemplate = fillTemplate(INACTIVE_USER_REMINDER_EMAIL_TEMPLATE, {
        name,
        dashboardUrl: BASE_URL,
        unsubscribeUrl: '#',
    });

    const mailOptions = {
        from: sender('GMIT'),
        to: email,
        subject: `🔔 ${name}, opportunities are waiting for you`,
        text: `We miss you, ${name}. The markets have been moving.`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A team notice in the announcement layout. Recipients are Bcc'd in batches so nobody sees anyone else's
// address; returns how many addresses Gmail accepted.
const sendTeamNotice = async (
    { recipients, from, subject, title, message, label, dashboardPath }:
    { recipients: string[]; from: string; subject: string; title: string; message: string; label: string; dashboardPath: string }
): Promise<number> => {
    const html = fillTemplate(ANNOUNCEMENT_EMAIL_TEMPLATE, {
        title: escapeHtml(title),
        message: escapeHtml(message).replace(/\n/g, '<br>'),
        audience: escapeHtml(label),
        date: new Date().toLocaleDateString('en-ZA', { dateStyle: 'long', timeZone: 'Africa/Johannesburg' }),
        dashboardUrl: `${BASE_URL}${dashboardPath}`,
    });

    let sent = 0;
    for (let i = 0; i < recipients.length; i += 50) {
        const bcc = recipients.slice(i, i + 50);
        const info = await transporter.sendMail({
            from: sender(from),
            to: process.env.NODEMAILER_EMAIL,
            bcc,
            subject,
            text: `${title}\n\n${message}\n\n${BASE_URL}${dashboardPath}`,
            html,
        });
        const accepted = new Set((info.accepted ?? []).map((a) => String(a).toLowerCase()));
        sent += bcc.filter((address) => accepted.has(address.toLowerCase())).length;
    }
    return sent;
};

// An administrator announcement to a department's members
export const sendAnnouncementEmail = async (
    { recipients, title, message, audienceLabel, dashboardPath }: { recipients: string[]; title: string; message: string; audienceLabel: string; dashboardPath: string }
): Promise<number> =>
    sendTeamNotice({ recipients, from: 'GMIT Announcements', subject: `📢 ${title}`, title, message, label: audienceLabel, dashboardPath });

// Happy birthday to the member themselves
export const sendBirthdayWishEmail = async ({ email, name }: { email: string; name: string }) => {
    const firstName = name.trim().split(/\s+/)[0] || name;
    return sendTeamNotice({
        recipients: [email],
        from: 'GMIT',
        subject: `🎉 Happy birthday, ${firstName}!`,
        title: `Happy birthday, ${firstName}!`,
        message: 'Everyone on the GMIT and LIMT teams wishes you a wonderful birthday. Thank you for everything you bring to the portfolio. Enjoy your day!',
        label: 'Happy birthday',
        dashboardPath: '/',
    });
};

// Lets the rest of the team know whose birthday it is
export const sendBirthdayReminderEmail = async (
    { recipients, name, roleLabel }: { recipients: string[]; name: string; roleLabel: string }
) =>
    sendTeamNotice({
        recipients,
        from: 'GMIT',
        subject: `🎂 It's ${name}'s birthday today`,
        title: `It's ${name}'s birthday today`,
        message: `${name} (${roleLabel}) is celebrating a birthday today. Take a moment to wish them well!`,
        label: 'Birthday reminder',
        dashboardPath: '/',
    });
