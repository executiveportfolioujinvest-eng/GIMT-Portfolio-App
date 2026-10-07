'use server';

import {
  getBasicFinancials,
  getCompanyProfile,
  getInsiderSentiment,
  getPeers,
  getRecommendation,
  getStockQuote,
} from '@/lib/actions/finnhub.actions';
import { getYahooQuote, searchJseStocks } from '@/lib/actions/yahoo.actions';
import { MARKETS, type MarketKey } from '@/lib/markets';
import { findLocalStock, getDashboardConfig, getLocalStocks } from '@/lib/dashboard-config';

const toYahooSymbol = (market: MarketKey, symbol: string) =>
  market === 'local' && !symbol.includes('.') && !symbol.startsWith('^') ? `${symbol}.JO` : symbol;


const ratingFromTrend = (trend: RecommendationTrend | null): string | undefined => {
  if (!trend) return undefined;
  const total = trend.strongBuy + trend.buy + trend.hold + trend.sell + trend.strongSell;
  if (!total) return undefined;
  const score = (2 * trend.strongBuy + trend.buy - trend.sell - 2 * trend.strongSell) / total;
  if (score >= 1) return 'Strong Buy';
  if (score >= 0.3) return 'Buy';
  if (score > -0.3) return 'Hold';
  if (score > -1) return 'Sell';
  return 'Strong Sell';
};

const sentimentFromMspr = (mspr: number | null): string | undefined => {
  if (mspr == null) return undefined;
  if (mspr > 10) return 'Positive';
  if (mspr < -10) return 'Negative';
  return 'Neutral';
};

const metricValue = (metric: Record<string, number> | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = metric?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};

// Price, change, market cap and P/E for a list of stocks in one market
export async function getStockSnapshots(market: MarketKey, stocks: { symbol: string; company?: string }[]): Promise<StockSnapshot[]> {
  const currency = MARKETS[market].currency;

  return Promise.all(
    stocks.map(async ({ symbol, company }) => {
      const upper = symbol.toUpperCase();

      if (market === 'local') {
        const quote = await getYahooQuote(toYahooSymbol(market, upper));
        return {
          symbol: upper,
          company: company || (await findLocalStock(upper))?.name || quote?.name || upper,
          price: quote?.price,
          change: quote?.change,
          changePercent: quote?.changePercent,
          currency: quote?.currency || currency,
        };
      }

      const [quote, profile, financials] = await Promise.all([
        getStockQuote(upper),
        getCompanyProfile(upper),
        getBasicFinancials(upper),
      ]);

      return {
        symbol: upper,
        company: profile?.name || company || upper,
        logo: profile?.logo || undefined,
        price: quote?.c || undefined,
        change: quote?.d ?? undefined,
        changePercent: quote?.dp ?? undefined,
        // Finnhub reports market capitalization in millions
        marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : undefined,
        peRatio: metricValue(financials?.metric, ['peTTM', 'peBasicExclExtraTTM', 'peNormalizedAnnual']),
        currency: profile?.currency || currency,
      };
    })
  );
}

// Today's Top Stocks on the dashboard
// (the administrator's list for the department, or the defaults)
export async function getTopStocks(market: MarketKey): Promise<StockSnapshot[]> {
  const { topStocks, localStocks } = await getDashboardConfig(market);
  const symbols = topStocks.map((symbol) => ({
    symbol,
    company: market === 'local' ? localStocks.find((s) => s.symbol === symbol)?.name : undefined,
  }));
  return getStockSnapshots(market, symbols);
}

// Everything the stock overview page shows for one company
export async function getStockOverview(market: MarketKey, symbol: string): Promise<StockOverview> {
  const upper = symbol.toUpperCase();
  const currency = MARKETS[market].currency;

  if (market === 'local') {
    const known = await findLocalStock(upper);
    const [quote, search] = await Promise.all([
      getYahooQuote(toYahooSymbol(market, upper)),
      known ? Promise.resolve([]) : searchJseStocks(upper),
    ]);
    const searched = search.find((s) => s.symbol === upper);
    const sector = known?.sector || searched?.type;
    const localStocks = await getLocalStocks();
    const peers = localStocks
      .filter((s) => s.symbol !== upper && (!sector || s.sector === sector))
      .concat(localStocks.filter((s) => s.symbol !== upper && s.sector !== sector))
      .slice(0, 5);

    return {
      market,
      symbol: upper,
      company: known?.name || searched?.name || quote?.name || upper,
      exchange: 'JSE',
      industry: sector,
      currency: quote?.currency || currency,
      quote: quote ?? undefined,
      info: { country: 'ZA' },
      related: await getStockSnapshots(market, peers.map((p) => ({ symbol: p.symbol, company: p.name }))),
    };
  }

  const [quote, profile, financials, trend, mspr, peers] = await Promise.all([
    getStockQuote(upper),
    getCompanyProfile(upper),
    getBasicFinancials(upper),
    getRecommendation(upper),
    getInsiderSentiment(upper),
    getPeers(upper),
  ]);

  const price = quote?.c || undefined;
  return {
    market,
    symbol: upper,
    company: profile?.name || upper,
    logo: profile?.logo || undefined,
    exchange: profile?.exchange,
    industry: profile?.finnhubIndustry,
    currency: profile?.currency || currency,
    quote: price
      ? {
          symbol: upper,
          name: profile?.name || upper,
          price,
          change: quote?.d ?? undefined,
          changePercent: quote?.dp ?? undefined,
          open: quote?.o || undefined,
          high: quote?.h || undefined,
          low: quote?.l || undefined,
          prevClose: quote?.pc || undefined,
          currency: profile?.currency || currency,
          time: quote?.t,
        }
      : undefined,
    marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : undefined,
    peRatio: metricValue(financials?.metric, ['peTTM', 'peBasicExclExtraTTM', 'peNormalizedAnnual']),
    eps: metricValue(financials?.metric, ['epsTTM', 'epsBasicExclExtraItemsTTM', 'epsNormalizedAnnual']),
    rating: ratingFromTrend(trend),
    sentiment: sentimentFromMspr(mspr),
    info: {
      ipo: profile?.ipo,
      country: profile?.country,
      // Finnhub reports shares outstanding in millions
      shares: profile?.shareOutstanding ? profile.shareOutstanding * 1e6 : undefined,
      website: profile?.weburl,
    },
    related: await getStockSnapshots(market, peers.slice(0, 5).map((p) => ({ symbol: p }))),
  };
}
