import type { CompanySnapshot, PeerSnapshot } from '@/lib/valuation/types';

// Yahoo Finance's company summary endpoint (free, no key). It needs a session cookie and "crumb" token,
// which are fetched once and reused for a few hours.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SUMMARY_URL = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';

let session: { cookie: string; crumb: string; at: number } | null = null;

const getSession = async (force = false) => {
    if (!force && session && Date.now() - session.at < 6 * 60 * 60 * 1000) return session;
    const first = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': USER_AGENT }, redirect: 'manual', cache: 'no-store' });
    const cookie = (first.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
    const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': USER_AGENT, cookie }, cache: 'no-store' });
    const crumb = (await res.text()).trim();
    if (!res.ok || !crumb || crumb.length > 40) throw new Error('Yahoo Finance session unavailable');
    session = { cookie, crumb, at: Date.now() };
    return session;
};

type Json = Record<string, unknown>;

export const fetchQuoteSummary = async (yahooSymbol: string, modules: string[]): Promise<Json | null> => {
    for (const attempt of [0, 1]) {
        try {
            const { cookie, crumb } = await getSession(attempt === 1);
            const url = `${SUMMARY_URL}/${encodeURIComponent(yahooSymbol)}?modules=${modules.join(',')}&crumb=${encodeURIComponent(crumb)}`;
            const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, cookie }, cache: 'no-store' });
            if (res.status === 401 || res.status === 403) continue;
            if (!res.ok) return null;
            const json = (await res.json()) as { quoteSummary?: { result?: Json[] } };
            return json.quoteSummary?.result?.[0] ?? null;
        } catch (e) {
            if (attempt === 1) console.error('fetchQuoteSummary error:', yahooSymbol, e);
        }
    }
    return null;
};

// Yahoo wraps numbers as { raw, fmt }
const raw = (value: unknown): number | undefined => {
    const n = (value as { raw?: unknown } | undefined)?.raw ?? value;
    return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const obj = (value: unknown): Json => (value && typeof value === 'object' ? (value as Json) : {});
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
const date = (value: unknown) => {
    const seconds = raw(value);
    return seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : undefined;
};
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

// JSE prices are quoted in cents (ZAc) and London ones in pence (GBp)
const priceScale = (currency?: string) => (currency === 'ZAc' || currency === 'GBp' ? 0.01 : 1);
const mainCurrency = (currency?: string) => (currency === 'ZAc' ? 'ZAR' : currency === 'GBp' ? 'GBP' : currency ?? 'USD');

const COMPANY_MODULES = [
    'price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'earningsTrend', 'assetProfile',
    'majorHoldersBreakdown', 'institutionOwnership', 'insiderTransactions', 'calendarEvents', 'recommendationTrend',
];

export const fetchCompanySnapshot = async (yahooSymbol: string): Promise<CompanySnapshot | null> => {
    const r = await fetchQuoteSummary(yahooSymbol, COMPANY_MODULES);
    if (!r) return null;

    const price = obj(r.price);
    const detail = obj(r.summaryDetail);
    const stats = obj(r.defaultKeyStatistics);
    const fin = obj(r.financialData);
    const profile = obj(r.assetProfile);
    const holdersBreakdown = obj(r.majorHoldersBreakdown);
    const calendar = obj(r.calendarEvents);
    const trends = list(obj(r.earningsTrend).trend);
    const trend = (period: string) => trends.find((t) => t.period === period);

    const quoteCurrency = text(price.currency);
    const scale = priceScale(quoteCurrency);
    const scaled = (v: unknown) => (raw(v) != null ? raw(v)! * scale : undefined);
    const nextYear = trend('+1y');
    const thisYear = trend('0y');

    return {
        name: text(price.longName) ?? text(price.shortName) ?? yahooSymbol,
        yahooSymbol,
        currency: mainCurrency(quoteCurrency),
        financialCurrency: text(fin.financialCurrency) ?? mainCurrency(quoteCurrency),
        price: scaled(price.regularMarketPrice),
        marketCap: raw(price.marketCap),
        sharesOutstanding: raw(stats.sharesOutstanding),
        beta: raw(stats.beta) ?? raw(detail.beta),
        trailingEps: raw(stats.trailingEps),
        forwardEps: raw(stats.forwardEps),
        bookValuePerShare: raw(stats.bookValue),
        enterpriseValue: raw(stats.enterpriseValue),
        ebitda: raw(fin.ebitda),
        revenueTtm: raw(fin.totalRevenue),
        netIncomeTtm: raw(stats.netIncomeToCommon),
        freeCashFlowTtm: raw(fin.freeCashflow),
        operatingCashFlowTtm: raw(fin.operatingCashflow),
        totalCash: raw(fin.totalCash),
        totalDebt: raw(fin.totalDebt),
        returnOnEquity: raw(fin.returnOnEquity),
        profitMargin: raw(fin.profitMargins),
        dividendRate: raw(detail.dividendRate) ?? raw(detail.trailingAnnualDividendRate),
        dividendYield: raw(detail.dividendYield) ?? raw(detail.trailingAnnualDividendYield),
        payoutRatio: raw(detail.payoutRatio),
        exDividendDate: date(detail.exDividendDate) ?? date(calendar.exDividendDate),
        dividendDate: date(calendar.dividendDate),
        nextEarningsDate: date(list(obj(calendar.earnings).earningsDate)[0]),
        fiftyTwoWeekHigh: scaled(detail.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: scaled(detail.fiftyTwoWeekLow),
        change52w: raw(stats['52WeekChange']),
        targetMean: scaled(fin.targetMeanPrice),
        targetHigh: scaled(fin.targetHighPrice),
        targetLow: scaled(fin.targetLowPrice),
        analystCount: raw(fin.numberOfAnalystOpinions),
        recommendation: text(fin.recommendationKey),
        earningsGrowthNextYear: raw(obj(nextYear?.growth)),
        revenueGrowthNextYear: raw(obj(obj(nextYear?.revenueEstimate).growth)),
        earningsGrowthThisYear: raw(obj(thisYear?.growth)),
        revenueGrowthThisYear: raw(obj(obj(thisYear?.revenueEstimate).growth)),
        epsNextYear: raw(obj(obj(nextYear?.earningsEstimate).avg)),
        sector: text(profile.sector),
        industry: text(profile.industry),
        website: text(profile.website),
        employees: raw(profile.fullTimeEmployees),
        summary: text(profile.longBusinessSummary),
        address: [profile.address1, profile.city, profile.country].map(text).filter(Boolean).join(', ') || undefined,
        exchange: text(price.exchangeName),
        insidersPct: raw(holdersBreakdown.insidersPercentHeld),
        institutionsPct: raw(holdersBreakdown.institutionsPercentHeld),
        institutionsCount: raw(holdersBreakdown.institutionsCount),
        officers: list(profile.companyOfficers).slice(0, 12).map((o) => ({
            name: text(o.name) ?? '—',
            title: text(o.title) ?? '',
            age: raw(o.age),
            pay: raw(o.totalPay),
        })),
        holders: list(obj(r.institutionOwnership).ownershipList).slice(0, 10).map((h) => ({
            name: text(h.organization) ?? '—',
            pctHeld: raw(h.pctHeld),
            shares: raw(h.position),
            value: raw(h.value),
            reportDate: date(h.reportDate),
        })),
        insiderTrades: list(obj(r.insiderTransactions).transactions).slice(0, 15).map((t) => ({
            name: text(t.filerName) ?? '—',
            relation: text(t.filerRelation),
            date: date(t.startDate),
            shares: raw(t.shares),
            value: raw(t.value),
            text: text(t.transactionText),
        })),
    };
};

// The few figures needed to compare a company with its peers or the wider market
export const fetchPeerSnapshot = async (yahooSymbol: string, symbol: string): Promise<PeerSnapshot | null> => {
    const r = await fetchQuoteSummary(yahooSymbol, ['price', 'summaryDetail', 'defaultKeyStatistics', 'earningsTrend']);
    if (!r) return null;
    const price = obj(r.price);
    const detail = obj(r.summaryDetail);
    const stats = obj(r.defaultKeyStatistics);
    const scale = priceScale(text(price.currency));
    const last = raw(price.regularMarketPrice) != null ? raw(price.regularMarketPrice)! * scale : undefined;
    const eps = raw(stats.trailingEps);
    const book = raw(stats.bookValue);
    const nextYear = list(obj(r.earningsTrend).trend).find((t) => t.period === '+1y');

    return {
        symbol,
        name: text(price.shortName) ?? text(price.longName) ?? symbol,
        pe: last && eps && eps > 0 ? last / eps : undefined,
        pb: last && book && book > 0 ? last / book : undefined,
        dividendYield: raw(detail.dividendYield) ?? raw(detail.trailingAnnualDividendYield),
        earningsGrowthNextYear: raw(obj(nextYear?.growth)),
        revenueGrowthNextYear: raw(obj(obj(nextYear?.revenueEstimate).growth)),
        change52w: raw(stats['52WeekChange']),
        marketCap: raw(price.marketCap),
    };
};
