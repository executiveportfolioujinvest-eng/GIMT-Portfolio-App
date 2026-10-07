import type { DataSource, FinancialPeriod, PeriodField, PeriodKind } from '@/lib/valuation/types';

// US companies' own filings with the SEC (10-K annual, 10-Q quarterly) through EDGAR's free XBRL API
const SEC_HEADERS = { 'User-Agent': 'GMIT-Portfolio research app (gimt-portfolio-app.vercel.app)', Accept: 'application/json' };

type Fact = { start?: string; end: string; val: number; form: string; filed: string };
type Facts = Record<string, { units?: Record<string, Fact[]> }>;

let tickers: { map: Map<string, number>; at: number } | null = null;

export const findCik = async (ticker: string): Promise<string | null> => {
    if (!tickers || Date.now() - tickers.at > 24 * 60 * 60 * 1000) {
        const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: SEC_HEADERS, cache: 'no-store' });
        if (!res.ok) return null;
        const json = (await res.json()) as Record<string, { cik_str: number; ticker: string }>;
        tickers = { map: new Map(Object.values(json).map((t) => [t.ticker.toUpperCase(), t.cik_str])), at: Date.now() };
    }
    const cik = tickers.map.get(ticker.toUpperCase().replace('.', '-'));
    return cik ? String(cik).padStart(10, '0') : null;
};

const DAY = 24 * 60 * 60 * 1000;
const days = (f: Fact) => (f.start ? Math.round((Date.parse(f.end) - Date.parse(f.start)) / DAY) : 0);
const isReport = (f: Fact) => /^10-[KQ]/.test(f.form);

// Facts for the first tags that report them, latest filing winning when a figure was restated
const series = (facts: Facts, tags: string[], unit: string): Fact[] => {
    const byKey = new Map<string, Fact>();
    for (const tag of tags) {
        const fromTag = new Map<string, Fact>();
        for (const f of facts[tag]?.units?.[unit] ?? []) {
            if (!isReport(f) || !Number.isFinite(f.val)) continue;
            const key = `${f.start ?? ''}|${f.end}`;
            const seen = fromTag.get(key);
            if (!seen || f.filed > seen.filed) fromTag.set(key, f);
        }
        // Earlier tags win; later ones only fill periods the earlier ones don't cover
        for (const [key, f] of fromTag) if (!byKey.has(key)) byKey.set(key, f);
    }
    return [...byKey.values()];
};

const DURATION: Partial<Record<PeriodField, { tags: string[]; unit: string }>> = {
    revenue: { tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'], unit: 'USD' },
    grossProfit: { tags: ['GrossProfit'], unit: 'USD' },
    operatingIncome: { tags: ['OperatingIncomeLoss'], unit: 'USD' },
    netIncome: { tags: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'], unit: 'USD' },
    eps: { tags: ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], unit: 'USD/shares' },
    dps: { tags: ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'], unit: 'USD/shares' },
    operatingCashFlow: { tags: ['NetCashProvidedByUsedInOperatingActivities'], unit: 'USD' },
    capex: { tags: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], unit: 'USD' },
    interestExpense: { tags: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'], unit: 'USD' },
    dividendsPaid: { tags: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'], unit: 'USD' },
    depreciation: { tags: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'Depreciation'], unit: 'USD' },
    shares: { tags: ['WeightedAverageNumberOfDilutedSharesOutstanding'], unit: 'shares' },
};

const INSTANT: Partial<Record<PeriodField, string[]>> = {
    totalAssets: ['Assets'],
    totalLiabilities: ['Liabilities'],
    currentAssets: ['AssetsCurrent'],
    currentLiabilities: ['LiabilitiesCurrent'],
    equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
};

const instantAt = (facts: Facts, tags: string[], end: string) =>
    series(facts, tags, 'USD').filter((f) => !f.start && f.end === end).sort((a, b) => b.filed.localeCompare(a.filed))[0]?.val;

// Cash plus short-term investments, and all borrowings (current and long-term)
const cashAt = (facts: Facts, end: string) =>
    instantAt(facts, ['CashCashEquivalentsAndShortTermInvestments'], end) ??
    (() => {
        const parts = [
            instantAt(facts, ['CashAndCashEquivalentsAtCarryingValue', 'Cash'], end),
            instantAt(facts, ['ShortTermInvestments'], end),
            instantAt(facts, ['MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'], end),
        ].filter((v): v is number => v != null);
        return parts.length ? parts.reduce((a, b) => a + b, 0) : undefined;
    })();

const debtAt = (facts: Facts, end: string) => {
    const shortTerm = (instantAt(facts, ['ShortTermBorrowings'], end) ?? 0) + (instantAt(facts, ['CommercialPaper'], end) ?? 0);
    const total = instantAt(facts, ['LongTermDebt', 'DebtAndCapitalLeaseObligations'], end);
    if (total != null) return total + shortTerm;
    const parts = [instantAt(facts, ['LongTermDebtNoncurrent'], end), instantAt(facts, ['LongTermDebtCurrent', 'DebtCurrent'], end)].filter((v): v is number => v != null);
    return parts.length || shortTerm ? parts.reduce((a, b) => a + b, 0) + shortTerm : undefined;
};

// A duration figure for the period ending `end` that lasted about `months`; quarters missing from the
// filings are worked out as the difference between two year-to-date figures (e.g. Q4 = full year - 9 months)
const durationValue = (all: Fact[], end: string, months: number): number | undefined => {
    const target = months * 30.4;
    const direct = all.filter((f) => f.end === end && Math.abs(days(f) - target) < 20).sort((a, b) => b.filed.localeCompare(a.filed))[0];
    if (direct) return direct.val;
    if (months !== 3) return undefined;
    for (const longer of all.filter((f) => f.end === end && days(f) > 120)) {
        const shorter = all.find((f) => f.start === longer.start && Math.abs(days(longer) - days(f) - 91) < 15);
        if (shorter) return longer.val - shorter.val;
    }
    return undefined;
};

const buildPeriod = (facts: Facts, kind: PeriodKind, end: string, months: number, source: DataSource): FinancialPeriod => {
    const period: FinancialPeriod = { kind, end, months, sources: [source] };
    for (const [field, spec] of Object.entries(DURATION) as [PeriodField, { tags: string[]; unit: string }][]) {
        const value = durationValue(series(facts, spec.tags, spec.unit), end, months);
        if (value != null) period[field] = value as never;
    }
    for (const [field, tags] of Object.entries(INSTANT) as [PeriodField, string[]][]) {
        const value = instantAt(facts, tags, end);
        if (value != null) period[field] = value as never;
    }
    period.cash = cashAt(facts, end);
    period.totalDebt = debtAt(facts, end);
    if (period.totalLiabilities == null && period.equity != null) {
        const total = instantAt(facts, ['LiabilitiesAndStockholdersEquity'], end);
        if (total != null) period.totalLiabilities = total - period.equity;
    }
    if (period.operatingCashFlow != null) period.freeCashFlow = period.operatingCashFlow - (period.capex ?? 0);
    return period;
};

export const fetchSecPeriods = async (ticker: string): Promise<{ periods: FinancialPeriod[]; cik: string } | null> => {
    const cik = await findCik(ticker);
    if (!cik) return null;
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: SEC_HEADERS, cache: 'no-store' });
    if (!res.ok) return null;
    const facts = ((await res.json()) as { facts?: { 'us-gaap'?: Facts } }).facts?.['us-gaap'];
    if (!facts) return null;

    const filingsUrl = (type: string) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${type}&dateb=&owner=include&count=40`;
    const income = [...series(facts, DURATION.netIncome!.tags, 'USD'), ...series(facts, DURATION.revenue!.tags, 'USD')];
    const ends = (test: (f: Fact) => boolean) => [...new Set(income.filter(test).map((f) => f.end))].sort().reverse();

    const annualEnds = ends((f) => f.form.startsWith('10-K') && days(f) > 340 && days(f) < 390).slice(0, 6);
    const quarterEnds = ends((f) => days(f) > 80 && days(f) < 100).slice(0, 8);

    const periods: FinancialPeriod[] = [
        ...annualEnds.map((end) => buildPeriod(facts, 'annual', end, 12, { kind: 'sec', label: 'SEC annual report (10-K)', url: filingsUrl('10-K') })),
        ...quarterEnds.map((end) => buildPeriod(facts, 'quarter', end, 3, { kind: 'sec', label: 'SEC quarterly report (10-Q)', url: filingsUrl('10-Q') })),
    ];

    // Year to date: from the start of the financial year to the latest quarter, with the same stretch a year earlier
    const latestQuarter = quarterEnds[0];
    if (latestQuarter && latestQuarter > (annualEnds[0] ?? '')) {
        const ytdFact = income.filter((f) => f.end === latestQuarter && days(f) < 330).sort((a, b) => days(b) - days(a))[0];
        if (ytdFact) {
            const months = Math.round(days(ytdFact) / 30.4);
            const priorEnd = income.map((f) => f.end).find((e) => Math.abs(Date.parse(latestQuarter) - Date.parse(e) - 365 * DAY) < 10 * DAY);
            for (const end of [latestQuarter, priorEnd].filter(Boolean) as string[]) {
                periods.push(buildPeriod(facts, 'ytd', end, months, { kind: 'sec', label: 'SEC quarterly report (10-Q)', url: filingsUrl('10-Q') }));
            }
        }
    }

    return { periods, cik };
};
