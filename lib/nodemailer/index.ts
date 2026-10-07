import nodemailer from 'nodemailer';
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
    INACTIVE_USER_REMINDER_EMAIL_TEMPLATE,
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
