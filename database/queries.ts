import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import type { MarketKey } from '@/lib/markets';

// Older watchlist entries have no market field; they belong to the global market
const marketFilter = (market: MarketKey) => (market === 'global' ? { market: { $ne: 'local' } } : { market });

export async function getWatchlistSymbolsForUser(userId: string, market: MarketKey = 'global'): Promise<string[]> {
  if (!userId) return [];

  await connectToDatabase();
  const items = await Watchlist.find({ userId, ...marketFilter(market) }, { symbol: 1 }).lean();
  return items.map((i) => String(i.symbol));
}

export { marketFilter };
