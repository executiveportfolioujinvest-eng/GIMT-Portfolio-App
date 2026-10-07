'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { Holding } from '@/database/models/holding.model';
import { getSessionUser } from '@/lib/better-auth/session';
import { getCompanyProfile } from '@/lib/actions/finnhub.actions';
import { getYahooQuote } from '@/lib/actions/yahoo.actions';
import { getStockSnapshots } from '@/lib/actions/market.actions';
import { isMarketKey, LOCAL_STOCKS, marketHref, MARKETS, type MarketKey } from '@/lib/markets';

type HoldingInput = {
  symbol: string;
  shares: string | number;
  buyPrice: string | number;
  market: MarketKey;
};

const toNumber = (value: string | number) => Number.parseFloat(String(value).replace(/[$R,\s]/g, ''));

const parseHolding = (input: Omit<HoldingInput, 'symbol' | 'market'>) => {
  const shares = toNumber(input.shares);
  const buyPrice = toNumber(input.buyPrice);
  if (!Number.isFinite(shares) || shares <= 0) throw new Error('Shares must be a positive number');
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) throw new Error('Buy price must be a positive number');
  return { shares, buyPrice };
};

// Confirms the ticker exists in the market and returns the company name
const resolveCompany = async (market: MarketKey, symbol: string) => {
  if (market === 'local') {
    const known = LOCAL_STOCKS.find((s) => s.symbol === symbol);
    if (known) return known.name;
    const quote = await getYahooQuote(`${symbol}.JO`);
    if (!quote) throw new Error(`${symbol} isn't listed on the JSE`);
    return quote.name;
  }

  const profile = await getCompanyProfile(symbol);
  if (profile && !profile.name) throw new Error(`${symbol} wasn't found`);
  return profile?.name || symbol;
};

const revalidatePortfolio = (market: MarketKey) => {
  revalidatePath(marketHref(market, '/portfolio'));
  revalidatePath(marketHref(market, '/news'));
};

export async function addHolding(input: HoldingInput) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    const market: MarketKey = isMarketKey(input.market) ? input.market : 'global';
    const symbol = input.symbol.trim().toUpperCase().replace(/\.JO$/, '');
    if (!symbol) return { success: false, error: 'Enter a stock symbol' };
    const { shares, buyPrice } = parseHolding(input);

    await connectToDatabase();
    const existing = await Holding.findOne({ userId: user.id, market, symbol });

    if (existing) {
      // Buying more of a held stock averages the cost
      const totalShares = existing.shares + shares;
      existing.buyPrice = (existing.shares * existing.buyPrice + shares * buyPrice) / totalShares;
      existing.shares = totalShares;
      await existing.save();
    } else {
      const company = await resolveCompany(market, symbol);
      await Holding.create({ userId: user.id, market, symbol, company, shares, buyPrice });
    }

    revalidatePortfolio(market);
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('addHolding error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to add holding' };
  }
}

export async function updateHolding(holdingId: string, input: Omit<HoldingInput, 'symbol' | 'market'>) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    const values = parseHolding(input);
    await connectToDatabase();
    const holding = await Holding.findOneAndUpdate({ _id: holdingId, userId: user.id }, { $set: values }).lean();
    if (!holding) return { success: false, error: 'Holding not found' };

    revalidatePortfolio(holding.market === 'local' ? 'local' : 'global');
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('updateHolding error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update holding' };
  }
}

export async function deleteHolding(holdingId: string) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    await connectToDatabase();
    const holding = await Holding.findOneAndDelete({ _id: holdingId, userId: user.id }).lean();

    revalidatePortfolio(holding?.market === 'local' ? 'local' : 'global');
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('deleteHolding error:', err);
    return { success: false, error: 'Failed to delete holding' };
  }
}

// The signed-in user's holdings in one market, valued at the latest price
export async function getPortfolio(market: MarketKey = 'global'): Promise<{ holdings: HoldingWithData[]; summary: PortfolioSummary }> {
  const currency = MARKETS[market].currency;
  const empty = { holdings: [], summary: { totalValue: 0, totalCost: 0, totalGain: 0, totalGainPercent: 0, dayChange: 0, currency } };

  try {
    const user = await getSessionUser();
    if (!user) return empty;

    await connectToDatabase();
    const items = await Holding.find({ userId: user.id, market }).sort({ addedAt: -1 }).lean();
    if (items.length === 0) return empty;

    const snapshots = await getStockSnapshots(market, items.map((i) => ({ symbol: i.symbol, company: i.company })));

    const holdings: HoldingWithData[] = items.map((item, index) => {
      const snap = snapshots[index];
      const costBasis = item.shares * item.buyPrice;
      const marketValue = snap?.price ? item.shares * snap.price : undefined;
      const gain = marketValue != null ? marketValue - costBasis : undefined;
      return {
        id: String(item._id),
        market,
        symbol: item.symbol,
        company: snap?.company || item.company,
        logo: snap?.logo,
        shares: item.shares,
        buyPrice: item.buyPrice,
        currentPrice: snap?.price,
        changePercent: snap?.changePercent,
        costBasis,
        marketValue,
        gain,
        gainPercent: gain != null && costBasis ? (gain / costBasis) * 100 : undefined,
        currency: snap?.currency || currency,
      };
    });

    // Positions without a live price are valued at cost so the totals stay meaningful
    const totalValue = holdings.reduce((sum, h) => sum + (h.marketValue ?? h.costBasis), 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const dayChange = holdings.reduce((sum, h, i) => sum + (snapshots[i]?.change ?? 0) * h.shares, 0);

    return {
      holdings,
      summary: {
        totalValue,
        totalCost,
        totalGain: totalValue - totalCost,
        totalGainPercent: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        dayChange,
        currency,
      },
    };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('getPortfolio error:', err);
    return empty;
  }
}

export async function getHoldingStocks(market: MarketKey = 'global'): Promise<{ symbol: string; company: string }[]> {
  try {
    const user = await getSessionUser();
    if (!user) return [];

    await connectToDatabase();
    const items = await Holding.find({ userId: user.id, market }, { symbol: 1, company: 1 }).lean();
    return items.map((i) => ({ symbol: i.symbol, company: i.company }));
  } catch (err) {
    unstable_rethrow(err);
    console.error('getHoldingStocks error:', err);
    return [];
  }
}
