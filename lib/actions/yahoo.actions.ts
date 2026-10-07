'use server';

import { getLocalStocks } from '@/lib/dashboard-config';

// Yahoo Finance's public chart/search endpoints: free and keyless, but unofficial, so every call is cached and fails soft.
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const HISTORY_RANGES: Record<HistoryRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '5D': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
};

type YahooChartResult = {
  meta: {
    currency?: string;
    symbol: string;
    exchangeName?: string;
    fullExchangeName?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    regularMarketTime?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    longName?: string;
    shortName?: string;
    gmtoffset?: number;
  };
  timestamp?: number[];
  indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
};

// JSE equities trade in cents (ZAc); report everything in rand
const scaleFor = (currency?: string) => (currency === 'ZAc' || currency === 'GBp' ? 0.01 : 1);
const currencyFor = (currency?: string) => (currency === 'ZAc' ? 'ZAR' : currency === 'GBp' ? 'GBP' : currency || 'USD');

async function fetchYahooChart(yahooSymbol: string, range: string, interval: string, revalidateSeconds: number): Promise<YahooChartResult | null> {
  try {
    const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      ...(revalidateSeconds ? { next: { revalidate: revalidateSeconds } } : { cache: 'no-store' as const }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { chart?: { result?: YahooChartResult[] } };
    return data.chart?.result?.[0] ?? null;
  } catch (e) {
    console.error('Yahoo chart request failed for', yahooSymbol, e);
    return null;
  }
}

const toQuote = (result: YahooChartResult): MarketQuote | null => {
  const { meta } = result;
  if (meta.regularMarketPrice == null) return null;

  const scale = scaleFor(meta.currency);
  const price = meta.regularMarketPrice * scale;
  const prevCloseRaw = meta.chartPreviousClose ?? meta.previousClose;
  const prevClose = prevCloseRaw != null ? prevCloseRaw * scale : undefined;
  const opens = result.indicators?.quote?.[0]?.open ?? [];
  const firstOpen = opens.find((o): o is number => o != null);

  return {
    symbol: meta.symbol,
    name: meta.longName || meta.shortName || meta.symbol,
    price,
    change: prevClose != null ? price - prevClose : undefined,
    changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : undefined,
    open: firstOpen != null ? firstOpen * scale : undefined,
    high: meta.regularMarketDayHigh != null ? meta.regularMarketDayHigh * scale : undefined,
    low: meta.regularMarketDayLow != null ? meta.regularMarketDayLow * scale : undefined,
    prevClose,
    volume: meta.regularMarketVolume,
    week52High: meta.fiftyTwoWeekHigh != null ? meta.fiftyTwoWeekHigh * scale : undefined,
    week52Low: meta.fiftyTwoWeekLow != null ? meta.fiftyTwoWeekLow * scale : undefined,
    currency: currencyFor(meta.currency),
    exchange: meta.fullExchangeName || meta.exchangeName,
    time: meta.regularMarketTime,
  };
};

export async function getYahooQuote(yahooSymbol: string, revalidateSeconds = 60): Promise<MarketQuote | null> {
  const result = await fetchYahooChart(yahooSymbol, '1d', '1d', revalidateSeconds);
  return result ? toQuote(result) : null;
}

export async function getYahooQuotes(yahooSymbols: string[]): Promise<(MarketQuote | null)[]> {
  return Promise.all(yahooSymbols.map((s) => getYahooQuote(s)));
}

// Latest quotes for every tracked JSE stock, keyed by ticker
export async function getJseQuotes(): Promise<Record<string, MarketQuote | null>> {
  const stocks = await getLocalStocks();
  const quotes = await Promise.all(stocks.map((s) => getYahooQuote(`${s.symbol}.JO`)));
  return Object.fromEntries(stocks.map((s, i) => [s.symbol, quotes[i]]));
}

export async function getPriceHistory(yahooSymbol: string, range: HistoryRange = '1M'): Promise<PriceHistory> {
  const { range: yahooRange, interval } = HISTORY_RANGES[range] ?? HISTORY_RANGES['1M'];
  const result = await fetchYahooChart(yahooSymbol, yahooRange, interval, range === '1D' ? 60 : 900);
  if (!result) return { points: [], quote: null };

  const scale = scaleFor(result.meta.currency);
  const offset = result.meta.gmtoffset ?? 0;
  const q = result.indicators?.quote?.[0] ?? {};
  const points: PricePoint[] = (result.timestamp ?? []).flatMap((t, i) => {
    const close = q.close?.[i];
    if (close == null) return [];
    const open = q.open?.[i] ?? close;
    return [{
      // Shift to exchange-local time so intraday axes read in market hours
      time: t + offset,
      open: open * scale,
      high: (q.high?.[i] ?? Math.max(open, close)) * scale,
      low: (q.low?.[i] ?? Math.min(open, close)) * scale,
      close: close * scale,
      volume: q.volume?.[i] ?? 0,
    }];
  });

  return { points, quote: toQuote(result) };
}

export async function searchJseStocks(query?: string): Promise<StockWithWatchlistStatus[]> {
  const trimmed = query?.trim() ?? '';

  if (!trimmed) {
    return (await getLocalStocks()).slice(0, 10).map((s) => ({ symbol: s.symbol, name: s.name, exchange: 'JSE', type: s.sector, isInWatchlist: false }));
  }

  try {
    const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(trimmed)}&quotesCount=20&newsCount=0`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      quotes?: { symbol: string; exchange?: string; quoteType?: string; longname?: string; shortname?: string; industryDisp?: string; sectorDisp?: string }[];
    };

    return (data.quotes ?? [])
      .filter((q) => q.exchange === 'JNB' && q.symbol.endsWith('.JO'))
      .map((q) => ({
        symbol: q.symbol.replace(/\.JO$/, ''),
        name: q.longname || q.shortname || q.symbol,
        exchange: 'JSE',
        type: q.industryDisp || q.sectorDisp || q.quoteType || 'Equity',
        isInWatchlist: false,
      }))
      .slice(0, 15);
  } catch (e) {
    console.error('JSE search failed', e);
    return [];
  }
}
