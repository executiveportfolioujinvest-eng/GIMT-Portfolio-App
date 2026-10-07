import { connectToDatabase } from '@/database/mongoose';
import { MarketBenchmark } from '@/database/models/market-benchmark.model';
import { fetchPeerSnapshot } from '@/lib/valuation/yahoo-summary';
import { getPriceHistory } from '@/lib/actions/yahoo.actions';
import { getLocalStocks } from '@/lib/dashboard-config';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import type { MarketBenchmarks, PeerSnapshot } from '@/lib/valuation/types';

type Market = 'global' | 'local';

// 10-year government bond yields from the St. Louis Fed (FRED), free and keyless as CSV
const BOND = {
    global: { id: 'DGS10', label: 'US 10-year Treasury yield (FRED)', fallback: 0.042 },
    local: { id: 'IRLTLT01ZAM156N', label: 'South Africa 10-year government bond yield (FRED)', fallback: 0.10 },
} as const;

const INDEX = {
    global: { symbol: '^GSPC', name: 'S&P 500' },
    local: { symbol: '^J203.JO', name: 'JSE All Share' },
} as const;

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const fetchBondYield = async (market: Market) => {
    const { id, fallback } = BOND[market];
    try {
        const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const rows = (await res.text()).trim().split('\n').slice(1)
            .map((line) => line.split(','))
            .map(([d, v]) => ({ date: d, value: Number(v) / 100 }))
            .filter((r) => Number.isFinite(r.value) && r.value > 0);
        if (!rows.length) throw new Error('empty');
        const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const recent = rows.filter((r) => r.date >= fiveYearsAgo);
        return {
            latest: rows[rows.length - 1].value,
            average: recent.reduce((s, r) => s + r.value, 0) / (recent.length || 1),
        };
    } catch (e) {
        console.error('fetchBondYield error:', id, e);
        return { latest: fallback, average: fallback };
    }
};

// Runs `fn` over `items` a few at a time
export const inBatches = async <T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const out: R[] = [];
    for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
    return out;
};

const quantile = (values: number[], q: number) => {
    if (!values.length) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (pos - lo);
};
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined);

const computeBenchmarks = async (market: Market): Promise<MarketBenchmarks> => {
    const universe = market === 'local'
        ? (await getLocalStocks()).map((s) => ({ yahoo: `${s.symbol}.JO`, symbol: s.symbol }))
        : POPULAR_STOCK_SYMBOLS.slice(0, 30).map((s) => ({ yahoo: s, symbol: s }));

    const [bond, snapshots, index] = await Promise.all([
        fetchBondYield(market),
        inBatches(universe, 6, (u) => fetchPeerSnapshot(u.yahoo, u.symbol)),
        getPriceHistory(INDEX[market].symbol, '1Y'),
    ]);
    const peers = snapshots.filter((s): s is PeerSnapshot => !!s);

    const closes = index.points.map((p) => p.close);
    const weekly = closes.filter((_, i) => i % 5 === 0);
    const weeklyMoves = weekly.slice(1).map((c, i) => Math.abs(c / weekly[i] - 1));

    return {
        market,
        riskFreeRate: bond.latest,
        riskFreeAverage: bond.average,
        riskFreeSource: { label: BOND[market].label, url: `https://fred.stlouisfed.org/series/${BOND[market].id}` },
        indexSymbol: INDEX[market].symbol,
        indexName: INDEX[market].name,
        indexReturn1y: closes.length > 1 ? closes[closes.length - 1] / closes[0] - 1 : undefined,
        indexWeeklyMove: mean(weeklyMoves),
        medianPe: quantile(peers.map((p) => p.pe).filter((v): v is number => v != null && v > 0 && v < 200), 0.5),
        // Medians, so a few very fast growers don't set the bar for the whole market
        earningsGrowthNextYear: quantile(peers.map((p) => p.earningsGrowthNextYear).filter((v): v is number => v != null && Math.abs(v) < 1), 0.5),
        revenueGrowthNextYear: quantile(peers.map((p) => p.revenueGrowthNextYear).filter((v): v is number => v != null && Math.abs(v) < 1), 0.5),
        // Ranges among companies that pay a dividend
        dividendYieldP25: quantile(peers.map((p) => p.dividendYield).filter((v): v is number => v != null && v > 0), 0.25),
        dividendYieldP75: quantile(peers.map((p) => p.dividendYield).filter((v): v is number => v != null && v > 0), 0.75),
        updatedAt: new Date().toISOString(),
    };
};

// Cached market figures, recalculated when older than a day
export const getBenchmarks = async (market: Market): Promise<MarketBenchmarks> => {
    await connectToDatabase();
    const saved = await MarketBenchmark.findOne({ market }).lean();
    if (saved && Date.now() - new Date(saved.updatedAt).getTime() < MAX_AGE_MS) return saved.data as unknown as MarketBenchmarks;

    const fresh = await computeBenchmarks(market);
    await MarketBenchmark.updateOne({ market }, { $set: { data: fresh, updatedAt: new Date() } }, { upsert: true });
    return fresh;
};

// The last saved market figures, however old (pages read these; collection refreshes them)
export const readBenchmarks = async (market: Market): Promise<MarketBenchmarks | null> => {
    await connectToDatabase();
    const saved = await MarketBenchmark.findOne({ market }).lean();
    return (saved?.data as unknown as MarketBenchmarks) ?? null;
};
