# GMIT Portfolio

The home base of active management for the Global Markets Investment Team (GMIT) at UJ Invest — real-time charts, a personal watchlist, price alerts and AI-written market news emails.

## Features

- **Dashboard** — market overview, stock heatmap, top stories and market quotes (TradingView widgets)
- **Search** — `Ctrl/⌘ + K` command palette to find any stock and star it into your watchlist
- **Stock details** — candlestick and baseline charts, technical analysis, company profile and financials
- **Watchlist** — live price, change, market cap and P/E for every saved stock, plus news for your holdings
- **Price alerts** — get an email when a stock moves above or below your target
- **Emails** — AI-personalised welcome email and a daily market news summary (Gemini + Nodemailer, scheduled with Inngest)

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Better Auth · MongoDB + Mongoose · Inngest · Finnhub · Google Gemini · Nodemailer

## Getting started

**Prerequisites:** Node.js 20+, a MongoDB database, and API keys for Finnhub and Gemini.

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values

   | Variable | What it's for |
   | --- | --- |
   | `NEXT_PUBLIC_BASE_URL` | Public URL of the app (used for links and images in emails) |
   | `FINNHUB_API_KEY` | Stock search, quotes, company profiles and news |
   | `MONGODB_URI` | MongoDB connection string |
   | `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Authentication |
   | `GEMINI_API_KEY` | Writes the welcome email and daily news summary |
   | `NODEMAILER_EMAIL` / `NODEMAILER_PASSWORD` | Gmail address and app password that send the emails |

3. Check the database connection

   ```bash
   npm run test:db
   ```

4. Start the app

   ```bash
   npm run dev
   ```

5. In a second terminal, start the Inngest dev server so the welcome email, daily news and price alerts run locally

   ```bash
   npx inngest-cli@latest dev
   ```

Open [http://localhost:3000](http://localhost:3000) and create an account.

## Background jobs (Inngest)

| Function | Trigger | What it does |
| --- | --- | --- |
| `sign-up-email` | `app/user.created` | Sends the personalised welcome email |
| `daily-news-summary` | Every day at 12:00 UTC | Emails each user a summary of news for their watchlist |
| `check-stock-alerts` | Every 5 minutes | Emails users whose price alerts were hit |

The alert schedule lives in `ALERT_CHECK_CRON` in `lib/constants.ts`.
