'use server';

import { unstable_rethrow } from 'next/navigation';
import { connectToDatabase } from '@/database/mongoose';
import { CompanyFinancials, type CompanyFinancialsData } from '@/database/models/company-financials.model';
import { getSessionUser } from '@/lib/better-auth/session';
import { getYahooQuote } from '@/lib/actions/yahoo.actions';
import { inngest } from '@/lib/inngest/client';
import { canAccessMarket, isMarketKey, type MarketKey } from '@/lib/markets';
import { advanceCollection, collectionKey, startCollection, yahooSymbolFor, type CollectionState } from '@/lib/valuation/collect';
import { readBenchmarks } from '@/lib/valuation/benchmarks';
import { buildReport, type ValuationReport } from '@/lib/valuation/model';

const SYMBOL = /^[A-Z0-9.\-^=]{1,20}$/;

const authorise = async (market: MarketKey, symbol: string) => {
    const user = await getSessionUser();
    if (!user) return { error: 'You need to be signed in' } as const;
    if (!isMarketKey(market) || !canAccessMarket(user, market)) return { error: "You don't have access to that department" } as const;
    if (!SYMBOL.test(symbol.toUpperCase())) return { error: 'Unknown share' } as const;
    return { user } as const;
};

// The stored valuation for a share (null until someone loads it), valued at the latest price
export async function getValuation(market: MarketKey, symbol: string): Promise<{ report: ValuationReport | null; error?: string }> {
    try {
        const auth = await authorise(market, symbol);
        if ('error' in auth) return { report: null, error: auth.error };

        await connectToDatabase();
        const doc = await CompanyFinancials.findOne({ key: collectionKey(market, symbol) }).lean();
        if (!doc || (!doc.periods?.length && !doc.snapshot)) return { report: null };

        const [benchmarks, quote] = await Promise.all([
            readBenchmarks(market).catch(() => null),
            getYahooQuote(yahooSymbolFor(market, symbol)).catch(() => null),
        ]);
        // Round-trip through JSON so only plain data reaches the page
        const data = JSON.parse(JSON.stringify(doc)) as CompanyFinancialsData;
        return { report: buildReport(data, benchmarks, quote?.price) };
    } catch (e) {
        unstable_rethrow(e);
        console.error('getValuation error:', e);
        return { report: null, error: 'The valuation could not be loaded' };
    }
}

// Starts (or refreshes) collecting a share's financials; the background job and the page both move it along
export async function startValuation(market: MarketKey, symbol: string, refresh = false): Promise<{ state?: CollectionState | null; error?: string }> {
    try {
        const auth = await authorise(market, symbol);
        if ('error' in auth) return { error: auth.error };

        await startCollection(market, symbol, { id: auth.user.id, name: auth.user.name }, refresh);
        await inngest.send({ name: 'app/financials.collect', data: { market, symbol: symbol.toUpperCase() } }).catch(() => null);
        return { state: await advanceCollection(market, symbol) };
    } catch (e) {
        unstable_rethrow(e);
        console.error('startValuation error:', e);
        return { error: 'Collection could not be started' };
    }
}

// Does the next step of collection (searching the website, reading one document) while someone watches
export async function advanceValuation(market: MarketKey, symbol: string): Promise<{ state?: CollectionState | null; error?: string }> {
    try {
        const auth = await authorise(market, symbol);
        if ('error' in auth) return { error: auth.error };
        return { state: await advanceCollection(market, symbol) };
    } catch (e) {
        unstable_rethrow(e);
        console.error('advanceValuation error:', e);
        return { error: 'Collection stalled' };
    }
}
