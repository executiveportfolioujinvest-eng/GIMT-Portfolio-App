'use server';

import { getDateRange, validateArticle, formatArticle } from '@/lib/utils';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { getWatchlistSymbolsForUser } from '@/database/queries';
import { getSessionUser } from '@/lib/better-auth/session';
import { searchJseStocks } from '@/lib/actions/yahoo.actions';
import type { MarketKey } from '@/lib/markets';
import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

const getToken = () => process.env.FINNHUB_API_KEY || NEXT_PUBLIC_FINNHUB_API_KEY;

async function fetchJSON<T>(url: string, revalidateSeconds?: number): Promise<T> {
  const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
    ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
    : { cache: 'no-store' };

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
  try {
    const range = getDateRange(5);
    const token = getToken();
    if (!token) {
      throw new Error('FINNHUB API key is not configured');
    }
    const cleanSymbols = (symbols || [])
      .map((s) => s?.trim().toUpperCase())
      .filter((s): s is string => Boolean(s));

    const maxArticles = 6;

    // If we have symbols, try to fetch company news per symbol and round-robin select
    if (cleanSymbols.length > 0) {
      const perSymbolArticles: Record<string, RawNewsArticle[]> = {};

      await Promise.all(
        cleanSymbols.map(async (sym) => {
          try {
            const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}&from=${range.from}&to=${range.to}&token=${token}`;
            const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
            perSymbolArticles[sym] = (articles || []).filter(validateArticle);
          } catch (e) {
            console.error('Error fetching company news for', sym, e);
            perSymbolArticles[sym] = [];
          }
        })
      );

      const collected: MarketNewsArticle[] = [];
      // Round-robin up to 6 picks
      for (let round = 0; round < maxArticles; round++) {
        for (let i = 0; i < cleanSymbols.length; i++) {
          const sym = cleanSymbols[i];
          const list = perSymbolArticles[sym] || [];
          if (list.length === 0) continue;
          const article = list.shift();
          if (!article || !validateArticle(article)) continue;
          collected.push(formatArticle(article, true, sym, round));
          if (collected.length >= maxArticles) break;
        }
        if (collected.length >= maxArticles) break;
      }

      if (collected.length > 0) {
        // Sort by datetime desc
        collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
        return collected.slice(0, maxArticles);
      }
      // If none collected, fall through to general news
    }

    // General market news fallback or when no symbols provided
    const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
    const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

    const seen = new Set<string>();
    const unique: RawNewsArticle[] = [];
    for (const art of general || []) {
      if (!validateArticle(art)) continue;
      const key = `${art.id}-${art.url}-${art.headline}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(art);
      if (unique.length >= 20) break; // cap early before final slicing
    }

    const formatted = unique.slice(0, maxArticles).map((a, idx) => formatArticle(a, false, undefined, idx));
    return formatted;
  } catch (err) {
    console.error('getNews error:', err);
    throw new Error('Failed to fetch news');
  }
}

const withWatchlistStatus = async (stocks: StockWithWatchlistStatus[], market: MarketKey) => {
  const watchlistSymbols = new Set(
    await getSessionUser()
      .then((user) => (user ? getWatchlistSymbolsForUser(user.id, market) : []))
      .catch((err) => {
        unstable_rethrow(err);
        return [] as string[];
      })
  );
  return stocks.map((s) => ({ ...s, isInWatchlist: watchlistSymbols.has(s.symbol) }));
};

export const searchStocks = cache(async (query?: string, market: MarketKey = 'global'): Promise<StockWithWatchlistStatus[]> => {
  try {
    const trimmed = typeof query === 'string' ? query.trim() : '';

    // Local (JSE) search runs on Yahoo Finance, since Finnhub's free plan is US-only
    if (market === 'local') {
      return await withWatchlistStatus(await searchJseStocks(trimmed), 'local');
    }

    const token = getToken();
    if (!token) {
      // If no token, log and return empty to avoid throwing per requirements
      console.error('Error in stock search:', new Error('FINNHUB API key is not configured'));
      return [];
    }

    let results: (FinnhubSearchResult & { __exchange?: string })[] = [];

    if (!trimmed) {
      // Fetch top 10 popular symbols' profiles
      const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
      const profiles = await Promise.all(
        top.map(async (sym) => {
          try {
            const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
            // Revalidate every hour
            const profile = await fetchJSON<ProfileData & { ticker?: string }>(url, 3600);
            return { sym, profile };
          } catch (e) {
            console.error('Error fetching profile2 for', sym, e);
            return { sym, profile: null };
          }
        })
      );

      results = profiles
        .map(({ sym, profile }) => {
          const symbol = sym.toUpperCase();
          const name: string | undefined = profile?.name || profile?.ticker || undefined;
          const exchange: string | undefined = profile?.exchange || undefined;
          if (!name) return undefined;
          // Carry the exchange through to the final mapping stage (internal only)
          return {
            symbol,
            description: name,
            displaySymbol: symbol,
            type: 'Common Stock',
            __exchange: exchange,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    } else {
      const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${token}`;
      const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
      results = Array.isArray(data?.result) ? data.result : [];
    }

    const mapped: StockWithWatchlistStatus[] = results
      .map((r) => {
        const upper = (r.symbol || '').toUpperCase();
        const name = r.description || upper;
        const exchangeFromDisplay = (r.displaySymbol as string | undefined) || undefined;
        const exchangeFromProfile = r.__exchange;
        const exchange = exchangeFromDisplay || exchangeFromProfile || 'US';
        const type = r.type || 'Stock';
        const item: StockWithWatchlistStatus = {
          symbol: upper,
          name,
          exchange,
          type,
          isInWatchlist: false,
        };
        return item;
      })
      .slice(0, 15);

    return await withWatchlistStatus(mapped, 'global');
  } catch (err) {
    unstable_rethrow(err);
    console.error('Error in stock search:', err);
    return [];
  }
});

export async function getStockQuote(symbol: string, revalidateSeconds = 60): Promise<QuoteData | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    return await fetchJSON<QuoteData>(url, revalidateSeconds);
  } catch (e) {
    console.error('Error fetching quote for', symbol, e);
    return null;
  }
}

export async function getCompanyProfile(symbol: string): Promise<ProfileData | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    return await fetchJSON<ProfileData>(url, 3600);
  } catch (e) {
    console.error('Error fetching profile2 for', symbol, e);
    return null;
  }
}

export async function getBasicFinancials(symbol: string): Promise<FinancialsData | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${FINNHUB_BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token}`;
    return await fetchJSON<FinancialsData>(url, 3600);
  } catch (e) {
    console.error('Error fetching financials for', symbol, e);
    return null;
  }
}

// Finnhub market news by category: general, forex, crypto or merger
export async function getGeneralNews(category: 'general' | 'forex' | 'crypto' | 'merger' = 'general', max = 10): Promise<MarketNewsArticle[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const url = `${FINNHUB_BASE_URL}/news?category=${category}&token=${token}`;
    const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
    return (articles || [])
      .filter(validateArticle)
      .slice(0, max)
      .map((a, idx) => formatArticle(a, false, undefined, idx));
  } catch (e) {
    console.error('Error fetching general news', category, e);
    return [];
  }
}

export async function getCompanyNews(symbol: string, max = 3, days = 7): Promise<MarketNewsArticle[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const range = getDateRange(days);
    const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(symbol)}&from=${range.from}&to=${range.to}&token=${token}`;
    const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
    return (articles || [])
      .filter(validateArticle)
      .slice(0, max)
      .map((a, idx) => formatArticle(a, true, symbol, idx));
  } catch (e) {
    console.error('Error fetching company news for', symbol, e);
    return [];
  }
}

// Latest analyst recommendation trend (strong buy … strong sell counts)
export async function getRecommendation(symbol: string): Promise<RecommendationTrend | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${FINNHUB_BASE_URL}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    const trends = await fetchJSON<RecommendationTrend[]>(url, 3600);
    return trends?.[0] ?? null;
  } catch (e) {
    console.error('Error fetching recommendation for', symbol, e);
    return null;
  }
}

// Average insider sentiment (MSPR, -100…100) over the last three months
export async function getInsiderSentiment(symbol: string): Promise<number | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const range = getDateRange(120);
    const url = `${FINNHUB_BASE_URL}/stock/insider-sentiment?symbol=${encodeURIComponent(symbol)}&from=${range.from}&to=${range.to}&token=${token}`;
    const data = await fetchJSON<{ data?: { mspr?: number }[] }>(url, 3600);
    const values = (data?.data ?? []).map((d) => d.mspr).filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  } catch (e) {
    console.error('Error fetching insider sentiment for', symbol, e);
    return null;
  }
}

export async function getPeers(symbol: string): Promise<string[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const url = `${FINNHUB_BASE_URL}/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    const peers = await fetchJSON<string[]>(url, 86400);
    return (peers || []).filter((p) => p.toUpperCase() !== symbol.toUpperCase());
  } catch (e) {
    console.error('Error fetching peers for', symbol, e);
    return [];
  }
}
