'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { getWatchlistSymbolsForUser, marketFilter } from '@/database/queries';
import { getSessionUser } from '@/lib/better-auth/session';
import { getStockSnapshots } from '@/lib/actions/market.actions';
import { formatChangePercent, formatMarketCapValue, formatPrice } from '@/lib/utils';
import { isMarketKey, marketHref, type MarketKey } from '@/lib/markets';

export async function getWatchlistSymbolsByEmail(email: string, market: MarketKey = 'global'): Promise<string[]> {
  if (!email) return [];

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    // Better Auth stores users in the "user" collection
    const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });

    if (!user) return [];

    const userId = (user.id as string) || String(user._id || '');
    if (!userId) return [];

    const items = await Watchlist.find({ userId, ...marketFilter(market) }, { symbol: 1 }).lean();
    return items.map((i) => String(i.symbol));
  } catch (err) {
    console.error('getWatchlistSymbolsByEmail error:', err);
    return [];
  }
}

// Symbols in the signed-in user's watchlist (empty when signed out)
export async function getUserWatchlistSymbols(market: MarketKey = 'global'): Promise<string[]> {
  try {
    const user = await getSessionUser();
    if (!user) return [];

    return await getWatchlistSymbolsForUser(user.id, market);
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('getUserWatchlistSymbols error:', err);
    return [];
  }
}

export async function isStockInWatchlist(symbol: string, market: MarketKey = 'global'): Promise<boolean> {
  const symbols = await getUserWatchlistSymbols(market);
  return symbols.includes(symbol.toUpperCase());
}

const revalidateWatchlist = (market: MarketKey) => {
  revalidatePath(marketHref(market, '/watchlist'));
  revalidatePath(marketHref(market, '/'));
};

export async function addToWatchlist(symbol: string, company: string, market: MarketKey = 'global') {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };
    if (!isMarketKey(market)) return { success: false, error: 'Invalid market' };

    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return { success: false, error: 'Invalid symbol' };

    await connectToDatabase();
    await Watchlist.updateOne(
      { userId: user.id, market, symbol: cleanSymbol },
      { $setOnInsert: { userId: user.id, market, symbol: cleanSymbol, company: company.trim() || cleanSymbol, addedAt: new Date() } },
      { upsert: true }
    );

    revalidateWatchlist(market);
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('addToWatchlist error:', err);
    return { success: false, error: 'Failed to add to watchlist' };
  }
}

export async function removeFromWatchlist(symbol: string, market: MarketKey = 'global') {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };
    if (!isMarketKey(market)) return { success: false, error: 'Invalid market' };

    await connectToDatabase();
    await Watchlist.deleteOne({ userId: user.id, symbol: symbol.trim().toUpperCase(), ...marketFilter(market) });

    revalidateWatchlist(market);
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('removeFromWatchlist error:', err);
    return { success: false, error: 'Failed to remove from watchlist' };
  }
}

// The signed-in user's watchlist with live price, change, market cap and P/E
export async function getWatchlistWithData(market: MarketKey = 'global'): Promise<StockWithData[]> {
  try {
    const user = await getSessionUser();
    if (!user) return [];

    await connectToDatabase();
    const items = await Watchlist.find({ userId: user.id, ...marketFilter(market) }).sort({ addedAt: -1 }).lean();
    const snapshots = await getStockSnapshots(market, items.map((i) => ({ symbol: i.symbol, company: i.company })));

    return items.map((item, index) => {
      const snap = snapshots[index];
      const currency = snap?.currency;
      return {
        userId: item.userId,
        market,
        symbol: item.symbol,
        company: snap?.company || item.company,
        addedAt: item.addedAt,
        logo: snap?.logo,
        currentPrice: snap?.price,
        change: snap?.change,
        changePercent: snap?.changePercent,
        priceFormatted: snap?.price ? formatPrice(snap.price, currency) : '—',
        changeFormatted: formatChangePercent(snap?.changePercent) || '—',
        marketCap: snap?.marketCap ? formatMarketCapValue(snap.marketCap, currency) : '—',
        peRatio: snap?.peRatio ? snap.peRatio.toFixed(1) : '—',
      };
    });
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('getWatchlistWithData error:', err);
    return [];
  }
}
