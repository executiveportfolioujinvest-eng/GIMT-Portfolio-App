import type { CompanyFinancialsData } from '@/database/models/company-financials.model';
import type { MarketKey } from '@/lib/markets';
import { PERIOD_FIELDS } from '@/lib/valuation/types';
import type {
    CompanySnapshot, DataSource, FinancialPeriod, Holder, InsiderTrade, MarketBenchmarks, Officer, PeerSnapshot, PeriodField, ReportDocument, SourceKind,
} from '@/lib/valuation/types';

// Turns a company's stored figures, market data and benchmarks into the Valuation tab's report.
// Methods are standard ones (discounted cash flow, residual income, peer multiples); every assumption is shown.

export const LEARN = {
    dcf: 'https://www.investopedia.com/terms/d/dcf.asp',
    residualIncome: 'https://www.investopedia.com/terms/r/residualincome.asp',
    capm: 'https://www.investopedia.com/terms/c/capm.asp',
    beta: 'https://www.investopedia.com/terms/b/beta.asp',
    pe: 'https://www.investopedia.com/terms/p/price-earningsratio.asp',
    pb: 'https://www.investopedia.com/terms/p/price-to-bookratio.asp',
    evEbitda: 'https://www.investopedia.com/terms/e/ev-ebitda.asp',
    priceTarget: 'https://www.investopedia.com/terms/p/pricetarget.asp',
    roe: 'https://www.investopedia.com/terms/r/returnonequity.asp',
    roa: 'https://www.investopedia.com/terms/r/returnonassets.asp',
    netMargin: 'https://www.investopedia.com/terms/n/net_margin.asp',
    fcf: 'https://www.investopedia.com/terms/f/freecashflow.asp',
    cagr: 'https://www.investopedia.com/terms/c/cagr.asp',
    debtEquity: 'https://www.investopedia.com/terms/d/debtequityratio.asp',
    interestCover: 'https://www.investopedia.com/terms/i/interestcoverageratio.asp',
    currentRatio: 'https://www.investopedia.com/terms/c/currentratio.asp',
    dividendYield: 'https://www.investopedia.com/terms/d/dividendyield.asp',
    payout: 'https://www.investopedia.com/terms/p/payoutratio.asp',
    insider: 'https://www.investopedia.com/terms/i/insidertrading.asp',
} as const;

// Equity risk premium: a mature-market figure, plus a country premium for South Africa
const EQUITY_RISK_PREMIUM: Record<MarketKey, number> = { global: 0.055, local: 0.075 };
// Long-run growth can't outpace the economy, so the bond-yield-based terminal growth is capped
const TERMINAL_GROWTH_CAP: Record<MarketKey, number> = { global: 0.04, local: 0.055 };
const PROJECTION_YEARS = 10;

export type Indicator = { label: string; pass: boolean | null; detail: string; learn?: string };

export type StatementRow = FinancialPeriod & { label: string };

export type ValuationReport = {
    market: MarketKey;
    symbol: string;
    company: string;
    currency: string;
    phase: CompanyFinancialsData['phase'];
    message?: string;
    websiteNote?: string;
    collectedAt?: string;
    documents: ReportDocument[];
    sources: DataSource[];
    snapshot: CompanySnapshot | null;
    benchmarks: MarketBenchmarks | null;
    price?: number;
    ratios: { pe?: number; pb?: number; evEbitda?: number; dividendYield?: number; marketCap?: number };
    fairValue: {
        method: 'cash-flow' | 'residual-income' | null;
        value?: number;
        difference?: number; // fair value vs price: positive = price below the estimate
        reason?: string;
        costOfEquity?: number;
        terminalGrowth?: number;
        inputs: { label: string; value: string; learn?: string }[];
        projections: { year: number; cashFlow: number; presentValue: number }[];
        presentValueOfCashFlows?: number;
        presentValueOfTerminal?: number;
    };
    analysts: { mean?: number; high?: number; low?: number; count?: number; upside?: number; recommendation?: string };
    relative: { metric: 'P/E' | 'P/B'; company?: number; peersAverage?: number; marketMedian?: number; impliedByModel?: number; peers: PeerSnapshot[] };
    growth: {
        earningsThisYear?: number; earningsNextYear?: number; revenueThisYear?: number; revenueNextYear?: number;
        marketEarnings?: number; marketRevenue?: number; bondYield?: number; epsNextYear?: number; peersEarnings?: number;
    };
    performance: {
        annual: StatementRow[];
        toDate: StatementRow[];   // year to date (US) or latest half year (JSE) with the same period a year earlier
        recent: StatementRow[];   // quarters (US) or half years (JSE)
        recentLabel: string;
        revenueGrowth1y?: number; revenueCagr?: number; earningsGrowth1y?: number; earningsCagr?: number;
        cagrYears?: number; netMargin?: number; netMarginPrior?: number; roe?: number; roa?: number; cashConversion?: number;
    };
    health: {
        asOf?: string;
        totalAssets?: number; totalLiabilities?: number; currentAssets?: number; currentLiabilities?: number; nonCurrentLiabilities?: number;
        cash?: number; debt?: number; equity?: number; debtToEquity?: number; debtToEquityEarliest?: number; earliestYear?: string;
        netCash?: number; interestCover?: number; cashFlowToDebt?: number; currentRatio?: number;
        history: { end: string; debt?: number; equity?: number; cash?: number }[];
    };
    dividends: {
        yield?: number; rate?: number; payoutRatio?: number; cashPayoutRatio?: number; marketLow?: number; marketHigh?: number;
        exDate?: string; payDate?: string; growth?: number; history: { end: string; dps: number }[];
    };
    people: { officers: Officer[]; insidersPct?: number; institutionsPct?: number; publicPct?: number; holders: Holder[]; trades: InsiderTrade[]; netInsiderSelling?: boolean };
    indicators: Record<'value' | 'growth' | 'performance' | 'health' | 'dividends', Indicator[]>;
    highlights: { strengths: string[]; watch: string[] };
};

const num = (v: number | undefined | null): v is number => typeof v === 'number' && Number.isFinite(v);
const ratio = (a?: number, b?: number) => (num(a) && num(b) && b !== 0 ? a / b : undefined);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (v?: number, digits = 1) => (num(v) ? `${(v * 100).toFixed(digits)}%` : '—');
const mean = (values: (number | undefined)[]) => {
    const ok = values.filter(num);
    return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : undefined;
};
const cagr = (latest?: number, earliest?: number, years?: number) =>
    num(latest) && num(earliest) && years && latest > 0 && earliest > 0 ? (latest / earliest) ** (1 / years) - 1 : undefined;

const fiscalLabel = (p: FinancialPeriod) => {
    const [y, m] = p.end.split('-');
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-ZA', { month: 'short' });
    if (p.kind === 'annual') return `FY ${y}`;
    if (p.kind === 'interim') return `H1 to ${month} ${y}`;
    if (p.kind === 'ytd') return `${p.months}M to ${month} ${y}`;
    return `Q to ${month} ${y}`;
};

const isFinancialCompany = (s?: CompanySnapshot | null) => /bank|insur|financial|capital markets|asset management|credit services|mortgage/i.test(`${s?.sector ?? ''} ${s?.industry ?? ''}`);

const SOURCE_ORDER: SourceKind[] = ['sec', 'company', 'yahoo'];

// Sources define some lines differently (an insurer's "revenue" may be insurance revenue in its own results but
// total income on Yahoo), so each line of a series is taken from the one source that covers the most periods,
// falling back to another source only where that one has a gap
const harmonise = (series: FinancialPeriod[]): FinancialPeriod[] => {
    if (series.length < 2) return series;
    const chosen = new Map<string, SourceKind>();
    for (const field of PERIOD_FIELDS) {
        const coverage = SOURCE_ORDER.map((kind) => ({ kind, n: series.filter((p) => num(p.bySource?.[kind]?.[field])).length }));
        const best = coverage.reduce((a, b) => (b.n > a.n ? b : a));
        if (best.n > 0) chosen.set(field, best.kind);
    }
    return series.map((p) => {
        const out: FinancialPeriod = { ...p, fieldSources: { ...p.fieldSources } };
        for (const [field, kind] of chosen) {
            const value = p.bySource?.[kind]?.[field];
            if (num(value)) {
                out[field as PeriodField] = value as never;
                out.fieldSources![field] = kind;
            }
        }
        if (num(out.operatingCashFlow)) out.freeCashFlow = out.operatingCashFlow - (out.capex ?? 0);
        return out;
    });
};

export const buildReport = (data: CompanyFinancialsData, benchmarks: MarketBenchmarks | null, livePrice?: number): ValuationReport => {
    const { market, symbol } = data;
    const s = data.snapshot ?? null;
    const price = livePrice ?? s?.price;
    const sorted = [...(data.periods ?? [])].sort((a, b) => b.end.localeCompare(a.end));
    const periods = (['annual', 'interim', 'quarter', 'ytd'] as const).flatMap((kind) => harmonise(sorted.filter((p) => p.kind === kind)))
        .sort((a, b) => b.end.localeCompare(a.end));
    const annual = periods.filter((p) => p.kind === 'annual').slice(0, 5);
    const latest = annual[0];
    const shares = s?.sharesOutstanding ?? latest?.shares;
    const sameCurrency = !s || s.financialCurrency === s.currency;

    // ---- Ratios
    const eps = s?.trailingEps ?? latest?.eps;
    const bookPerShare = s?.bookValuePerShare ?? ratio(latest?.equity, shares);
    const pe = num(price) && num(eps) && eps > 0 && sameCurrency ? price / eps : undefined;
    const pb = num(price) && num(bookPerShare) && bookPerShare > 0 && sameCurrency ? price / bookPerShare : undefined;
    // Negative for many banks and insurers (cash exceeds debt plus market value), where the ratio means nothing
    const evRaw = ratio(s?.enterpriseValue, s?.ebitda);
    const evEbitda = num(evRaw) && evRaw > 0 && num(s?.enterpriseValue) && s!.enterpriseValue! > 0 ? evRaw : undefined;

    // ---- Fair value
    const rf = benchmarks?.riskFreeRate;
    const beta = clamp(s?.beta ?? 1, 0.8, 2);
    const costOfEquity = num(rf) ? rf + beta * EQUITY_RISK_PREMIUM[market] : undefined;
    const terminalGrowth = num(benchmarks?.riskFreeAverage) ? Math.min(benchmarks!.riskFreeAverage, TERMINAL_GROWTH_CAP[market]) : undefined;
    const fairValue: ValuationReport['fairValue'] = { method: null, inputs: [], projections: [] };
    const financial = isFinancialCompany(s);

    if (!num(costOfEquity) || !num(terminalGrowth)) {
        fairValue.reason = 'Market bond yields are unavailable right now, so the estimate can’t be calculated.';
    } else if (!sameCurrency) {
        fairValue.reason = `The company reports in ${s?.financialCurrency} but trades in ${s?.currency}, so the estimate isn’t comparable with the share price.`;
    } else if (!num(shares) || shares <= 0) {
        fairValue.reason = 'The number of shares in issue is unavailable.';
    } else if (financial) {
        // Residual income: book value plus the value of returns earned above the cost of equity
        const roes = annual.map((p, i) => ratio(p.netIncome, mean([p.equity, annual[i + 1]?.equity])));
        const roe = clamp(mean([...roes, s?.returnOnEquity]) ?? 0, 0, 0.4);
        if (num(bookPerShare) && bookPerShare > 0 && costOfEquity > terminalGrowth) {
            const excess = (roe - costOfEquity) * bookPerShare;
            const value = bookPerShare + excess / (costOfEquity - terminalGrowth);
            Object.assign(fairValue, { method: 'residual-income', value, costOfEquity, terminalGrowth });
            fairValue.inputs = [
                { label: 'Book value per share', value: bookPerShare.toFixed(2), learn: LEARN.pb },
                { label: 'Return on equity (average)', value: pct(roe), learn: LEARN.roe },
                { label: 'Cost of equity', value: pct(costOfEquity), learn: LEARN.capm },
                { label: 'Excess return per share', value: excess.toFixed(2), learn: LEARN.residualIncome },
                { label: 'Long-term growth', value: pct(terminalGrowth) },
            ];
        } else {
            fairValue.reason = 'Book value is unavailable, so the residual-income estimate can’t be calculated.';
        }
    } else {
        // Discounted free cash flow over ten years, growth fading from the forecast to the long-term rate
        const recentFcf = annual.slice(0, 3).map((p) => p.freeCashFlow).filter(num);
        const baseFcf = mean(recentFcf);
        const base = num(baseFcf) && baseFcf > 0 ? baseFcf : num(latest?.netIncome) && latest.netIncome > 0 ? latest.netIncome : undefined;
        const historicGrowth = cagr(annual[0]?.netIncome, annual[annual.length - 1]?.netIncome, annual.length - 1);
        const startGrowth = clamp(s?.earningsGrowthNextYear ?? historicGrowth ?? terminalGrowth, -0.05, 0.2);
        if (num(base) && costOfEquity > terminalGrowth) {
            let cashFlow = base;
            let pvSum = 0;
            for (let year = 1; year <= PROJECTION_YEARS; year++) {
                const growth = startGrowth + (terminalGrowth - startGrowth) * ((year - 1) / (PROJECTION_YEARS - 1));
                cashFlow *= 1 + growth;
                const presentValue = cashFlow / (1 + costOfEquity) ** year;
                pvSum += presentValue;
                fairValue.projections.push({ year: new Date().getFullYear() + year, cashFlow, presentValue });
            }
            const terminal = (cashFlow * (1 + terminalGrowth)) / (costOfEquity - terminalGrowth);
            const pvTerminal = terminal / (1 + costOfEquity) ** PROJECTION_YEARS;
            const value = (pvSum + pvTerminal) / shares;
            Object.assign(fairValue, { method: 'cash-flow', value, costOfEquity, terminalGrowth, presentValueOfCashFlows: pvSum, presentValueOfTerminal: pvTerminal });
            fairValue.inputs = [
                { label: num(baseFcf) && baseFcf > 0 ? `Free cash flow (average of last ${recentFcf.length} years)` : 'Net profit (free cash flow was negative)', value: base.toLocaleString('en-US', { maximumFractionDigits: 0 }), learn: LEARN.fcf },
                { label: s?.earningsGrowthNextYear != null ? 'Starting growth (analyst forecast)' : 'Starting growth (past earnings trend)', value: pct(startGrowth) },
                { label: 'Long-term growth (bond yield, capped)', value: pct(terminalGrowth) },
                { label: '10-year bond yield', value: pct(rf), learn: benchmarks?.riskFreeSource.url },
                { label: 'Beta (limited to 0.8 to 2)', value: beta.toFixed(2), learn: LEARN.beta },
                { label: 'Equity risk premium', value: pct(EQUITY_RISK_PREMIUM[market]) },
                { label: 'Discount rate (cost of equity)', value: pct(costOfEquity), learn: LEARN.capm },
                { label: 'Shares in issue', value: shares.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
            ];
        } else {
            fairValue.reason = 'Free cash flow and profit are both negative, so a cash-flow estimate isn’t meaningful.';
        }
    }
    if (num(fairValue.value) && num(price) && price > 0) fairValue.difference = fairValue.value / price - 1;

    // ---- Relative value
    const peers = data.peers ?? [];
    const metric: 'P/E' | 'P/B' = financial && !num(pe) ? 'P/B' : 'P/E';
    const peerValues = peers.map((p) => (metric === 'P/E' ? p.pe : p.pb)).filter((v): v is number => num(v) && v > 0 && v < 200);
    const relative: ValuationReport['relative'] = {
        metric,
        company: metric === 'P/E' ? pe : pb,
        peersAverage: mean(peerValues),
        marketMedian: metric === 'P/E' ? benchmarks?.medianPe : undefined,
        impliedByModel: metric === 'P/E' && num(fairValue.value) && num(eps) && eps > 0 ? fairValue.value / eps : undefined,
        peers,
    };

    // ---- Analysts
    const analysts = {
        mean: s?.targetMean, high: s?.targetHigh, low: s?.targetLow, count: s?.analystCount, recommendation: s?.recommendation,
        upside: num(s?.targetMean) && num(price) ? s!.targetMean! / price - 1 : undefined,
    };

    // ---- Growth outlook
    const growth = {
        earningsThisYear: s?.earningsGrowthThisYear, earningsNextYear: s?.earningsGrowthNextYear,
        revenueThisYear: s?.revenueGrowthThisYear, revenueNextYear: s?.revenueGrowthNextYear,
        marketEarnings: benchmarks?.earningsGrowthNextYear, marketRevenue: benchmarks?.revenueGrowthNextYear,
        bondYield: rf, epsNextYear: s?.epsNextYear,
        peersEarnings: mean(peers.map((p) => p.earningsGrowthNextYear).filter((v) => num(v) && Math.abs(v!) < 1)),
    };

    // ---- Performance
    const label = (p: FinancialPeriod): StatementRow => ({ ...p, label: fiscalLabel(p) });
    const quarters = periods.filter((p) => p.kind === 'quarter').slice(0, 8);
    const halves = periods.filter((p) => p.kind === 'interim').slice(0, 6);
    const ytd = periods.filter((p) => p.kind === 'ytd').slice(0, 2);
    // JSE companies report half-yearly: their latest half year (when newer than the last full year) is the year to date
    const toDate = ytd.length ? ytd : halves[0] && (!latest || halves[0].end > latest.end)
        ? halves.filter((h) => h.end === halves[0].end || h.end.slice(5) === halves[0].end.slice(5)).slice(0, 2)
        : [];
    const oldest = annual[annual.length - 1];
    const years = annual.length - 1;
    const performance: ValuationReport['performance'] = {
        annual: annual.map(label),
        toDate: toDate.map(label),
        recent: (quarters.length ? quarters : halves).map(label),
        recentLabel: quarters.length ? 'Quarterly' : 'Half-yearly',
        revenueGrowth1y: annual[1] ? ratio(latest?.revenue, annual[1].revenue)! - 1 : undefined,
        revenueCagr: cagr(latest?.revenue, oldest?.revenue, years),
        earningsGrowth1y: annual[1] && num(annual[1].netIncome) && annual[1].netIncome > 0 ? ratio(latest?.netIncome, annual[1].netIncome)! - 1 : undefined,
        earningsCagr: cagr(latest?.netIncome, oldest?.netIncome, years),
        cagrYears: years > 0 ? years : undefined,
        netMargin: ratio(latest?.netIncome, latest?.revenue),
        netMarginPrior: ratio(annual[1]?.netIncome, annual[1]?.revenue),
        roe: ratio(latest?.netIncome, mean([latest?.equity, annual[1]?.equity])) ?? s?.returnOnEquity,
        roa: ratio(latest?.netIncome, latest?.totalAssets),
        cashConversion: num(latest?.netIncome) && latest.netIncome > 0 ? ratio(latest.operatingCashFlow, latest.netIncome) : undefined,
    };
    if (performance.revenueGrowth1y != null && !num(performance.revenueGrowth1y)) performance.revenueGrowth1y = undefined;

    // ---- Balance sheet (most recent period that has one)
    const sheet = periods.find((p) => num(p.totalAssets));
    const earliest = [...annual].reverse().find((p) => num(p.equity) && p.equity > 0);
    const health: ValuationReport['health'] = {
        asOf: sheet?.end,
        totalAssets: sheet?.totalAssets, totalLiabilities: sheet?.totalLiabilities,
        currentAssets: sheet?.currentAssets, currentLiabilities: sheet?.currentLiabilities,
        nonCurrentLiabilities: num(sheet?.totalLiabilities) && num(sheet?.currentLiabilities) ? sheet!.totalLiabilities! - sheet!.currentLiabilities! : undefined,
        cash: sheet?.cash ?? s?.totalCash, debt: sheet?.totalDebt ?? s?.totalDebt, equity: sheet?.equity,
        debtToEquity: ratio(sheet?.totalDebt ?? s?.totalDebt, sheet?.equity),
        debtToEquityEarliest: earliest && earliest !== sheet ? ratio(earliest.totalDebt, earliest.equity) : undefined,
        earliestYear: earliest?.end.slice(0, 4),
        netCash: num(sheet?.cash) && num(sheet?.totalDebt) ? sheet!.cash! - sheet!.totalDebt! : undefined,
        interestCover: num(latest?.interestExpense) && latest.interestExpense > 0 ? ratio(latest.operatingIncome, latest.interestExpense) : undefined,
        cashFlowToDebt: num(latest?.totalDebt) && latest.totalDebt > 0 ? ratio(latest.operatingCashFlow, latest.totalDebt) : undefined,
        currentRatio: ratio(sheet?.currentAssets, sheet?.currentLiabilities),
        history: [...annual].reverse().map((p) => ({ end: p.end, debt: p.totalDebt, equity: p.equity, cash: p.cash })),
    };

    // ---- Dividends
    const dpsHistory = [...annual].reverse().flatMap((p) => {
        const dps = p.dps ?? (num(p.dividendsPaid) && num(p.shares) && p.shares > 0 ? p.dividendsPaid / p.shares : undefined);
        return num(dps) && dps > 0 ? [{ end: p.end, dps }] : [];
    });
    const dividends: ValuationReport['dividends'] = {
        yield: s?.dividendYield, rate: s?.dividendRate,
        payoutRatio: s?.payoutRatio ?? ratio(latest?.dps, latest?.eps),
        cashPayoutRatio: num(latest?.freeCashFlow) && latest.freeCashFlow > 0 ? ratio(latest.dividendsPaid, latest.freeCashFlow) : undefined,
        marketLow: benchmarks?.dividendYieldP25, marketHigh: benchmarks?.dividendYieldP75,
        exDate: s?.exDividendDate, payDate: s?.dividendDate,
        growth: dpsHistory.length > 1 ? cagr(dpsHistory[dpsHistory.length - 1].dps, dpsHistory[0].dps, dpsHistory.length - 1) : undefined,
        history: dpsHistory,
    };

    // ---- People and ownership
    const trades = s?.insiderTrades ?? [];
    const threeMonthsAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recentTrades = trades.filter((t) => t.date && t.date >= threeMonthsAgo);
    const sold = recentTrades.filter((t) => /sale|sold/i.test(t.text ?? '')).reduce((a, t) => a + (t.value ?? 0), 0);
    const bought = recentTrades.filter((t) => /purchase|bought|buy/i.test(t.text ?? '')).reduce((a, t) => a + (t.value ?? 0), 0);
    const people = {
        officers: s?.officers ?? [],
        insidersPct: s?.insidersPct,
        institutionsPct: s?.institutionsPct,
        publicPct: num(s?.insidersPct) || num(s?.institutionsPct) ? Math.max(0, 1 - (s?.insidersPct ?? 0) - (s?.institutionsPct ?? 0)) : undefined,
        holders: s?.holders ?? [],
        trades,
        netInsiderSelling: recentTrades.length ? sold > bought * 2 && sold > 0 : undefined,
    };

    // ---- Indicators (our own checklist; null means there isn't enough data to judge)
    const check = (label: string, pass: boolean | null | undefined, detail: string, learn?: string): Indicator => ({ label, pass: pass ?? null, detail, learn });
    const gt = (a?: number, b?: number) => (num(a) && num(b) ? a > b : null);
    const indicators: ValuationReport['indicators'] = {
        value: [
            check('Share price below our fair value estimate', num(fairValue.difference) ? fairValue.difference > 0 : null,
                num(fairValue.difference) ? `Estimate is ${pct(Math.abs(fairValue.difference))} ${fairValue.difference > 0 ? 'above' : 'below'} the price` : fairValue.reason ?? 'No estimate', fairValue.method === 'residual-income' ? LEARN.residualIncome : LEARN.dcf),
            check(`${metric} below the peer average`, gt(relative.peersAverage, relative.company), `${relative.company?.toFixed(1) ?? '—'}x vs peers ${relative.peersAverage?.toFixed(1) ?? '—'}x`, metric === 'P/E' ? LEARN.pe : LEARN.pb),
            check('P/E below the market median', metric === 'P/E' ? gt(relative.marketMedian, relative.company) : null, `${pe?.toFixed(1) ?? '—'}x vs market ${relative.marketMedian?.toFixed(1) ?? '—'}x`, LEARN.pe),
            check('Analysts’ average target above the price', num(analysts.upside) ? analysts.upside > 0 : null, num(analysts.upside) ? `${pct(analysts.upside)} from ${analysts.count ?? '?'} analysts` : 'No analyst targets', LEARN.priceTarget),
        ],
        growth: [
            check('Earnings forecast to beat the bond yield', gt(growth.earningsNextYear, growth.bondYield), `${pct(growth.earningsNextYear)} vs ${pct(growth.bondYield)}`),
            check('Earnings forecast to beat the market', gt(growth.earningsNextYear, growth.marketEarnings), `${pct(growth.earningsNextYear)} vs market ${pct(growth.marketEarnings)}`),
            check('Revenue forecast to beat the market', gt(growth.revenueNextYear, growth.marketRevenue), `${pct(growth.revenueNextYear)} vs market ${pct(growth.marketRevenue)}`),
            check('Earnings forecast to grow over 15% a year', num(growth.earningsNextYear) ? growth.earningsNextYear > 0.15 : null, pct(growth.earningsNextYear)),
        ],
        performance: [
            check(`Earnings up over ${years || 'the'} years`, num(performance.earningsCagr) ? performance.earningsCagr > 0 : null, `${pct(performance.earningsCagr)} a year`, LEARN.cagr),
            check('Net margin up on the prior year', gt(performance.netMargin, performance.netMarginPrior), `${pct(performance.netMargin)} vs ${pct(performance.netMarginPrior)}`, LEARN.netMargin),
            check('Return on equity above 15%', num(performance.roe) ? performance.roe > 0.15 : null, pct(performance.roe), LEARN.roe),
            check('Profit backed by operating cash flow', num(performance.cashConversion) ? performance.cashConversion >= 0.8 : null, num(performance.cashConversion) ? `Cash flow is ${pct(performance.cashConversion, 0)} of profit` : 'Not available', LEARN.fcf),
        ],
        health: [
            check('Debt below half of equity', num(health.debtToEquity) ? health.debtToEquity < 0.5 : null, `Debt to equity ${pct(health.debtToEquity)}`, LEARN.debtEquity),
            check(`Debt to equity lower than in ${health.earliestYear ?? 'earlier years'}`, num(health.debtToEquity) && num(health.debtToEquityEarliest) ? health.debtToEquity <= health.debtToEquityEarliest : null, `${pct(health.debtToEquityEarliest)} → ${pct(health.debtToEquity)}`, LEARN.debtEquity),
            check('Operating cash flow covers 20% of debt', num(health.cashFlowToDebt) ? health.cashFlowToDebt >= 0.2 : num(health.debt) && health.debt === 0 ? true : null, pct(health.cashFlowToDebt), LEARN.fcf),
            check('Operating profit covers interest 3 times', num(health.interestCover) ? health.interestCover >= 3 : null, num(health.interestCover) ? `${health.interestCover.toFixed(1)}x` : 'Not available', LEARN.interestCover),
            check('Current assets exceed current liabilities', num(health.currentRatio) ? health.currentRatio >= 1 : null, num(health.currentRatio) ? `Current ratio ${health.currentRatio.toFixed(2)}` : 'Not split on the balance sheet', LEARN.currentRatio),
        ],
        dividends: [
            check('Pays a dividend', num(dividends.yield) ? dividends.yield > 0 : num(dividends.rate) ? dividends.rate > 0 : null, pct(dividends.yield, 2), LEARN.dividendYield),
            check('Yield above the market’s lower quarter', gt(dividends.yield, dividends.marketLow), `${pct(dividends.yield, 2)} vs ${pct(dividends.marketLow, 2)}`, LEARN.dividendYield),
            check('Dividend covered by earnings (payout under 75%)', num(dividends.payoutRatio) && dividends.payoutRatio > 0 ? dividends.payoutRatio < 0.75 : null, pct(dividends.payoutRatio), LEARN.payout),
            check('Dividend per share has grown', num(dividends.growth) ? dividends.growth > 0 : null, num(dividends.growth) ? `${pct(dividends.growth)} a year` : 'Not enough history', LEARN.dividendYield),
        ],
    };

    const all = Object.values(indicators).flat();
    const highlights = {
        strengths: all.filter((i) => i.pass === true).slice(0, 5).map((i) => `${i.label} (${i.detail})`),
        watch: [
            ...(people.netInsiderSelling ? ['Insiders have been net sellers over the last three months'] : []),
            ...all.filter((i) => i.pass === false).map((i) => `${i.label.replace(/^(.)/, (c) => c.toLowerCase())} — not met (${i.detail})`),
        ].slice(0, 5).map((t) => t.replace(/^(.)/, (c) => c.toUpperCase())),
    };

    // Every source used, for the data panel
    const sources = new Map<string, DataSource>();
    for (const p of periods) for (const src of p.sources) sources.set(`${src.label}|${src.url ?? ''}`, src);
    if (s) sources.set('yahoo-summary', { kind: 'yahoo', label: 'Yahoo Finance quote, profile, analysts and ownership', url: `https://finance.yahoo.com/quote/${encodeURIComponent(s.yahooSymbol)}` });
    if (benchmarks) sources.set('bond', { kind: 'yahoo', label: benchmarks.riskFreeSource.label, url: benchmarks.riskFreeSource.url });

    return {
        market, symbol, company: data.company || s?.name || symbol,
        currency: s?.currency ?? (market === 'local' ? 'ZAR' : 'USD'),
        phase: data.phase, message: data.message, websiteNote: data.websiteNote,
        collectedAt: data.collectedAt ? new Date(data.collectedAt).toISOString() : undefined,
        documents: data.documents ?? [],
        sources: [...sources.values()],
        snapshot: s, benchmarks, price,
        ratios: { pe, pb, evEbitda, dividendYield: s?.dividendYield, marketCap: s?.marketCap },
        fairValue, analysts, relative, growth, performance, health, dividends, people, indicators, highlights,
    };
};
