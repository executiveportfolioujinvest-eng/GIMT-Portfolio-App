import { connectToDatabase } from '@/database/mongoose';
import { CompanyFinancials, type CompanyFinancialsData } from '@/database/models/company-financials.model';
import { fetchCompanySnapshot, fetchPeerSnapshot } from '@/lib/valuation/yahoo-summary';
import { fetchSecPeriods } from '@/lib/valuation/sec';
import { fetchYahooPeriods } from '@/lib/valuation/yahoo-statements';
import { discoverReports, GeminiBusyError, readReport } from '@/lib/valuation/company-reports';
import { getBenchmarks, inBatches } from '@/lib/valuation/benchmarks';
import { getPeers } from '@/lib/actions/finnhub.actions';
import { getLocalStocks } from '@/lib/dashboard-config';
import type { MarketKey } from '@/lib/markets';
import { PERIOD_FIELDS, type CollectionPhase, type FinancialPeriod, type PeerSnapshot, type SourceKind } from '@/lib/valuation/types';

// Collects a company's financials step by step. Each call to advanceCollection does one bounded piece of work
// (under a minute), so it can run from the Valuation tab's polling, from a background job, or both: a lease
// stops two runs working on the same company at once.
//   basics   -> market data, Yahoo/SEC statements, peers and market figures (the valuation can show after this)
//   discover -> search the company's website for its published results
//   read     -> read one results document per step and add its figures
//   done

export const collectionKey = (market: MarketKey, symbol: string) => `${market}:${symbol.toUpperCase()}`;
export const yahooSymbolFor = (market: MarketKey, symbol: string) => (market === 'local' ? `${symbol.toUpperCase()}.JO` : symbol.toUpperCase());

const LEASE_MS = 75_000;
const MAX_DOCUMENT_ATTEMPTS = 3;
// Stored data older than this is refreshed when someone opens the valuation
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// Official filings beat the company's own documents, which beat Yahoo's aggregated figures
const PRIORITY: Record<SourceKind, number> = { sec: 3, company: 2, yahoo: 1 };

const periodKey = (p: FinancialPeriod) => `${p.kind}|${p.end.slice(0, 7)}`;

// Combines periods from several sources figure by figure, keeping the most authoritative value for each
export const mergePeriods = (existing: FinancialPeriod[], incoming: FinancialPeriod[]): FinancialPeriod[] => {
    const byKey = new Map(existing.map((p) => [periodKey(p), { ...p, sources: [...p.sources], fieldSources: { ...p.fieldSources }, bySource: { ...p.bySource } }]));
    for (const next of incoming) {
        const nextKind = next.sources[0]?.kind ?? 'yahoo';
        const figures = Object.fromEntries(PERIOD_FIELDS.filter((f) => next[f] != null).map((f) => [f, next[f] as number]));
        const current = byKey.get(periodKey(next));
        if (!current) {
            byKey.set(periodKey(next), {
                ...next,
                fieldSources: Object.fromEntries(Object.keys(figures).map((f) => [f, nextKind])),
                bySource: { [nextKind]: figures },
            });
            continue;
        }
        current.bySource = { ...current.bySource, [nextKind]: { ...current.bySource?.[nextKind], ...figures } };
        for (const field of PERIOD_FIELDS) {
            const value = next[field];
            if (value == null) continue;
            const held = current.fieldSources?.[field] as SourceKind | undefined;
            if (current[field] == null || !held || PRIORITY[nextKind] > PRIORITY[held]) {
                current[field] = value as never;
                current.fieldSources = { ...current.fieldSources, [field]: nextKind };
            }
        }
        for (const source of next.sources) {
            if (!current.sources.some((s) => s.url === source.url && s.label === source.label)) current.sources.push(source);
        }
    }
    return [...byKey.values()].sort((a, b) => b.end.localeCompare(a.end));
};

const loadPeers = async (market: MarketKey, symbol: string): Promise<PeerSnapshot[]> => {
    let candidates: { yahoo: string; symbol: string }[];
    if (market === 'local') {
        const stocks = await getLocalStocks();
        const sector = stocks.find((s) => s.symbol === symbol)?.sector;
        const sameSector = stocks.filter((s) => s.symbol !== symbol && s.sector === sector);
        const others = stocks.filter((s) => s.symbol !== symbol && s.sector !== sector);
        candidates = [...sameSector, ...others].slice(0, 6).map((s) => ({ yahoo: `${s.symbol}.JO`, symbol: s.symbol }));
    } else {
        candidates = (await getPeers(symbol)).filter((p) => p !== symbol).slice(0, 6).map((p) => ({ yahoo: p, symbol: p }));
    }
    return (await inBatches(candidates, 6, (c) => fetchPeerSnapshot(c.yahoo, c.symbol))).filter((p): p is PeerSnapshot => !!p);
};

// Creates the record (or restarts collection on a stale one) when someone asks for a valuation
export const startCollection = async (market: MarketKey, symbol: string, requestedBy?: { id: string; name: string }, refresh = false) => {
    await connectToDatabase();
    const key = collectionKey(market, symbol);
    const existing = await CompanyFinancials.findOne({ key }).lean();
    if (existing && !refresh && existing.phase !== 'done') return existing;
    if (existing && !refresh && existing.collectedAt && Date.now() - new Date(existing.collectedAt).getTime() < STALE_AFTER_MS) return existing;

    return CompanyFinancials.findOneAndUpdate(
        { key },
        {
            $set: { phase: 'basics', status: existing?.periods?.length ? 'ready' : 'collecting', message: 'Gathering market data and financial statements', updatedAt: new Date(), ...(requestedBy ? { requestedBy } : {}) },
            $setOnInsert: { key, market, symbol: symbol.toUpperCase() },
        },
        { upsert: true, new: true, lean: true }
    );
};

const save = (key: string, update: Partial<CompanyFinancialsData> & Record<string, unknown>) =>
    CompanyFinancials.updateOne({ key }, { $set: { ...update, updatedAt: new Date(), leaseUntil: null } });

const stepBasics = async (doc: CompanyFinancialsData) => {
    const { market, symbol, key } = doc;
    const [snapshot, sec, yahoo, peers] = await Promise.all([
        fetchCompanySnapshot(yahooSymbolFor(market, symbol)),
        market === 'global' ? fetchSecPeriods(symbol).catch(() => null) : Promise.resolve(null),
        fetchYahooPeriods(yahooSymbolFor(market, symbol)),
        loadPeers(market, symbol).catch(() => []),
        // Warm the market figures (cached for a day) so the report renders quickly
        getBenchmarks(market).catch((e) => console.error('getBenchmarks error:', e)),
    ]);

    if (!snapshot && !yahoo.length && !sec?.periods.length) {
        await save(key, { phase: 'done', status: doc.periods.length ? 'ready' : 'failed', message: `No financial data was found for ${symbol}` });
        return;
    }

    // Order matters only for ties; priorities decide which figure wins
    const periods = mergePeriods(mergePeriods(doc.periods ?? [], yahoo), sec?.periods ?? []);
    // US companies' SEC filings cover five years and the quarters, so their websites aren't needed
    const next: CollectionPhase = sec?.periods.some((p) => p.kind === 'annual') && periods.filter((p) => p.kind === 'annual').length >= 5 ? 'done' : 'discover';

    await save(key, {
        company: snapshot?.name ?? doc.company ?? symbol,
        snapshot: snapshot ?? doc.snapshot,
        peers,
        periods,
        secCik: sec?.cik,
        phase: next,
        status: 'ready',
        message: next === 'done' ? undefined : 'Searching the company website for its published results',
        ...(next === 'done' ? { collectedAt: new Date() } : {}),
    });
};

const stepDiscover = async (doc: CompanyFinancialsData) => {
    const website = doc.snapshot?.website;
    if (!website) {
        await save(doc.key, { phase: 'done', websiteNote: 'No company website is listed for this share', message: undefined, collectedAt: new Date() });
        return;
    }
    const { documents, pagesVisited } = await discoverReports(website);
    if (!documents.length) {
        await save(doc.key, {
            phase: 'done',
            collectedAt: new Date(),
            message: undefined,
            websiteNote: pagesVisited.length
                ? `No results documents were found on ${new URL(website).hostname} (the site may block automated visitors or publish results elsewhere)`
                : `${new URL(website).hostname} could not be reached`,
        });
        return;
    }
    await save(doc.key, { documents, documentAttempts: {}, phase: 'read', websiteNote: undefined, message: `Reading ${documents.length} results document${documents.length === 1 ? '' : 's'} from the company website` });
};

const stepRead = async (doc: CompanyFinancialsData) => {
    const documents = [...(doc.documents ?? [])];
    const index = documents.findIndex((d) => d.status === 'pending');
    if (index === -1) {
        await save(doc.key, { phase: 'done', message: undefined, collectedAt: new Date() });
        return;
    }

    const target = documents[index];
    const attempts = { ...(doc.documentAttempts ?? {}) };
    let periods = doc.periods ?? [];
    try {
        const result = await readReport(target);
        periods = mergePeriods(periods, result.periods);
        documents[index] = { ...target, status: result.periods.length ? 'read' : 'failed', note: result.periods.length ? `${result.periods.length} period${result.periods.length === 1 ? '' : 's'} extracted` : 'No figures found' };
    } catch (e) {
        const tries = (attempts[target.url] ?? 0) + 1;
        attempts[target.url] = tries;
        const busy = e instanceof GeminiBusyError;
        // A busy AI service is retried on a later step; real failures are recorded and skipped
        documents[index] = busy && tries < MAX_DOCUMENT_ATTEMPTS
            ? target
            : { ...target, status: 'failed', note: e instanceof Error ? e.message : 'Could not be read' };
    }

    const remaining = documents.filter((d) => d.status === 'pending').length;
    await save(doc.key, {
        documents,
        documentAttempts: attempts,
        periods,
        phase: remaining ? 'read' : 'done',
        message: remaining ? `Reading results documents from the company website (${documents.length - remaining} of ${documents.length} done)` : undefined,
        ...(remaining ? {} : { collectedAt: new Date() }),
    });
};

export type CollectionState = { phase: CollectionPhase; status: CompanyFinancialsData['status']; message?: string; updatedAt?: string };

const toState = (doc: Pick<CompanyFinancialsData, 'phase' | 'status' | 'message' | 'updatedAt'> | null): CollectionState | null =>
    doc ? { phase: doc.phase, status: doc.status, message: doc.message, updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined } : null;

// Does the next piece of work for a company, unless another run holds it right now
export const advanceCollection = async (market: MarketKey, symbol: string): Promise<CollectionState | null> => {
    await connectToDatabase();
    const key = collectionKey(market, symbol);
    const now = new Date();
    const doc = await CompanyFinancials.findOneAndUpdate(
        { key, phase: { $ne: 'done' }, $or: [{ leaseUntil: null }, { leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }] },
        { $set: { leaseUntil: new Date(now.getTime() + LEASE_MS) } },
        { new: true, lean: true }
    );
    if (!doc) return toState(await CompanyFinancials.findOne({ key }, { phase: 1, status: 1, message: 1, updatedAt: 1 }).lean());

    try {
        const data = doc as unknown as CompanyFinancialsData;
        if (data.phase === 'basics') await stepBasics(data);
        else if (data.phase === 'discover') await stepDiscover(data);
        else if (data.phase === 'read') await stepRead(data);
    } catch (e) {
        console.error('advanceCollection error:', key, e);
        // Basics failing leaves nothing to show; later phases just stop and keep what was gathered
        await save(key, doc.phase === 'basics' && !doc.periods?.length
            ? { phase: 'done', status: 'failed', message: 'Financial data could not be collected right now. Try again later.' }
            : { phase: 'done', message: undefined, collectedAt: new Date() });
    }
    return toState(await CompanyFinancials.findOne({ key }, { phase: 1, status: 1, message: 1, updatedAt: 1 }).lean());
};

// Runs a whole collection to the end (used by the background job); stops after `maxSteps`
export const runCollection = async (market: MarketKey, symbol: string, maxSteps = 12) => {
    let state: CollectionState | null = null;
    for (let i = 0; i < maxSteps; i++) {
        state = await advanceCollection(market, symbol);
        if (!state || state.phase === 'done') break;
    }
    return state;
};
