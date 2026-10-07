'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { AlertModel } from '@/database/models/alert.model';
import { marketFilter } from '@/database/queries';
import { getSessionUser } from '@/lib/better-auth/session';
import { getStockSnapshots } from '@/lib/actions/market.actions';
import { isMarketKey, marketHref, MARKETS, type MarketKey } from '@/lib/markets';

const FREQUENCIES: AlertFrequency[] = ['once_per_minute', 'once_per_hour', 'once_per_day'];

const parseAlertData = (data: AlertData) => {
  const symbol = data.symbol?.trim().toUpperCase();
  const alertName = data.alertName?.trim();
  const threshold = Number.parseFloat(String(data.threshold).replace(/[$R,\s]/g, ''));
  const market: MarketKey = isMarketKey(data.market) ? data.market : 'global';

  if (!symbol) throw new Error('Select a stock for this alert');
  if (!alertName) throw new Error('Alert name is required');
  if (!Number.isFinite(threshold) || threshold <= 0) throw new Error('Threshold must be a positive number');
  if (data.alertType !== 'upper' && data.alertType !== 'lower') throw new Error('Invalid condition');

  return {
    market,
    symbol,
    company: data.company?.trim() || symbol,
    alertName,
    alertType: data.alertType,
    threshold,
    frequency: FREQUENCIES.includes(data.frequency) ? data.frequency : 'once_per_day',
  };
};

export async function createAlert(data: AlertData) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    const values = parseAlertData(data);
    await connectToDatabase();
    await AlertModel.create({ ...values, userId: user.id });

    revalidatePath(marketHref(values.market, '/watchlist'));
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('createAlert error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create alert' };
  }
}

export async function updateAlert(alertId: string, data: AlertData) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    const values = parseAlertData(data);
    await connectToDatabase();
    const result = await AlertModel.updateOne(
      { _id: alertId, userId: user.id },
      // Reset trigger history so the edited condition is evaluated fresh
      { $set: values, $unset: { lastTriggeredAt: 1, lastTriggeredQuoteTime: 1 } }
    );
    if (result.matchedCount === 0) return { success: false, error: 'Alert not found' };

    revalidatePath(marketHref(values.market, '/watchlist'));
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('updateAlert error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update alert' };
  }
}

export async function deleteAlert(alertId: string) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    await connectToDatabase();
    const alert = await AlertModel.findOneAndDelete({ _id: alertId, userId: user.id }).lean();

    revalidatePath(marketHref(alert?.market === 'local' ? 'local' : 'global', '/watchlist'));
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('deleteAlert error:', err);
    return { success: false, error: 'Failed to delete alert' };
  }
}

// The signed-in user's alerts in one market with the latest quote and company logo
export async function getUserAlerts(market: MarketKey = 'global'): Promise<Alert[]> {
  try {
    const user = await getSessionUser();
    if (!user) return [];

    await connectToDatabase();
    const alerts = await AlertModel.find({ userId: user.id, ...marketFilter(market) }).sort({ createdAt: -1 }).lean();

    const symbols = [...new Set(alerts.map((a) => a.symbol))];
    const snapshots = await getStockSnapshots(market, symbols.map((symbol) => ({ symbol })));
    const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));

    return alerts.map((alert) => {
      const snap = bySymbol.get(alert.symbol);
      return {
        id: String(alert._id),
        market,
        symbol: alert.symbol,
        company: snap?.company || alert.company,
        alertName: alert.alertName,
        currentPrice: snap?.price ?? 0,
        alertType: alert.alertType,
        threshold: alert.threshold,
        frequency: alert.frequency,
        changePercent: snap?.changePercent,
        logo: snap?.logo,
        currency: snap?.currency || MARKETS[market].currency,
      };
    });
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('getUserAlerts error:', err);
    return [];
  }
}
