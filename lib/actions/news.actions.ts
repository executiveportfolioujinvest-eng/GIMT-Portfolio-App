'use server';

import { getCompanyNews, getGeneralNews, getNews } from '@/lib/actions/finnhub.actions';
import type { MarketKey } from '@/lib/markets';

const GOOGLE_NEWS_URL = 'https://news.google.com/rss/search';

const NEWS_QUERIES = {
  local: 'JSE OR "Johannesburg Stock Exchange" OR "South African stocks" when:3d',
  world: '"world markets" OR "global stocks" OR "Wall Street" when:2d',
} as const;

const decodeEntities = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

const tagValue = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]) : '';
};

// Google News RSS: free and keyless; covers South African business press that the stock APIs don't
export async function getGoogleNews(query: string, max = 10, related = ''): Promise<MarketNewsArticle[]> {
  try {
    const url = `${GOOGLE_NEWS_URL}?q=${encodeURIComponent(query)}&hl=en-ZA&gl=ZA&ceid=ZA:en`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items.slice(0, max).flatMap((item, index) => {
      const source = tagValue(item, 'source');
      // Google appends " - Source" to every title
      const title = tagValue(item, 'title').replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
      const url = tagValue(item, 'link');
      const published = Date.parse(tagValue(item, 'pubDate'));
      if (!title || !url || Number.isNaN(published)) return [];

      return [{
        id: published + index,
        headline: title,
        summary: '',
        source: source || 'Google News',
        url,
        datetime: Math.floor(published / 1000),
        category: 'google-news',
        related,
      }];
    });
  } catch (e) {
    console.error('Google News request failed', e);
    return [];
  }
}

// "Naspers Limited" -> "Naspers", so Google matches how the press names the company
const shortCompanyName = (company: string) =>
  company
    .replace(/\b(Limited|Ltd|plc|p\.l\.c\.|N\.V\.|SA|Holdings|Group|Company|Corporation|Mining)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || company;

const companyQuery = (company: string, days: number) => `"${shortCompanyName(company)}" (JSE OR shares OR stock) when:${days}d`;

const safe = async (promise: Promise<MarketNewsArticle[]>) => promise.catch(() => [] as MarketNewsArticle[]);

const newestFirst = (articles: MarketNewsArticle[]) => {
  const seen = new Set<string>();
  return articles
    .filter((a) => {
      const key = a.headline.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.datetime - a.datetime);
};

// Top stories / Local market / World markets feed used by the dashboard and News page
export async function getMarketNews(tab: NewsTab, market: MarketKey = 'global', max = 10): Promise<MarketNewsArticle[]> {
  if (tab === 'local') return getGoogleNews(NEWS_QUERIES.local, max);

  if (tab === 'world') {
    const [google, forex] = await Promise.all([
      safe(getGoogleNews(NEWS_QUERIES.world, max)),
      safe(getGeneralNews('forex', max)),
    ]);
    return newestFirst([...forex, ...google]).slice(0, max);
  }

  // Top stories: each team's home market first, blended with the other feed
  if (market === 'local') {
    const [local, general] = await Promise.all([
      safe(getGoogleNews(NEWS_QUERIES.local, max)),
      safe(getGeneralNews('general', Math.ceil(max / 2))),
    ]);
    return newestFirst([...local, ...general]).slice(0, max);
  }

  return safe(getGeneralNews('general', max));
}

// News for a set of holdings or watchlist stocks in either market
export async function getNewsForStocks(market: MarketKey, stocks: { symbol: string; company: string }[], max = 6): Promise<MarketNewsArticle[]> {
  if (stocks.length === 0) return [];

  if (market === 'global') {
    return safe(getNews(stocks.map((s) => s.symbol)));
  }

  const perStock = await Promise.all(
    stocks.slice(0, 8).map((s) => safe(getGoogleNews(companyQuery(s.company, 7), 3, s.symbol)))
  );
  // Round-robin so one busy company doesn't crowd out the rest
  const merged: MarketNewsArticle[] = [];
  for (let round = 0; round < 3; round++) {
    for (const list of perStock) if (list[round]) merged.push(list[round]);
  }
  return newestFirst(merged).slice(0, max);
}

// Everything published on one stock in the past 24 hours, newest first (for the Portfolio Insider)
export async function getTodaysStockNews(market: MarketKey, symbol: string, company: string): Promise<MarketNewsArticle[]> {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const articles = market === 'global'
    ? await safe(getCompanyNews(symbol, 100, 2))
    : await safe(getGoogleNews(companyQuery(company, 1), 30, symbol));
  return newestFirst(articles.filter((a) => a.datetime >= since));
}

// The day's market-wide news for one department's daily summary: global markets, or the JSE and South Africa
export async function getDailyMarketNews(market: MarketKey, max = 6): Promise<MarketNewsArticle[]> {
  const articles = market === 'local'
    ? await safe(getGoogleNews(NEWS_QUERIES.local, 20))
    : await safe(getGeneralNews('general', 20));
  // Prefer the past day's stories, topping up with the latest when it's been quiet
  const since = Math.floor(Date.now() / 1000) - 30 * 3600;
  const recent = newestFirst(articles).filter((a) => a.datetime >= since);
  return (recent.length >= 3 ? recent : newestFirst(articles)).slice(0, max);
}

export async function getStockNews(market: MarketKey, symbol: string, company: string, max = 3): Promise<MarketNewsArticle[]> {
  if (market === 'global') return safe(getCompanyNews(symbol, max));
  return safe(getGoogleNews(companyQuery(company, 14), max, symbol));
}
