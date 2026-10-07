import type { CompanyFinancialsData } from '@/database/models/company-financials.model';
import type { MarketKey } from '@/lib/markets';
import { PERIOD_FIELDS } from '@/lib/valuation/types';
import type {
    CompanySnapshot, DataSource, FinancialPeriod, Holder, InsiderTrade, MarketBenchmarks, Officer, PeerSnapshot, PeriodField, ReportDocument, SourceKind,
} from '@/lib/valuation/types';

// Turns a company's stored figures, market data and benchmarks into the Valuation tab's report.
// Methods are standard ones (discounted cash flow to the firm and to equity, residual income, peer multiples);
// every assumption is shown alongside the result.

export const LEARN = {
    dcf: 'https://www.investopedia.com/terms/d/dcf.asp',
    fcff: 'https://www.investopedia.com/terms/f/freecashflowtofirm.asp',
    fcfe: 'https://www.investopedia.com/terms/f/freecashflowtoequity.asp',
    wacc: 'https://www.investopedia.com/terms/w/wacc.asp',
    terminalValue: 'https://www.investopedia.com/terms/t/terminalvalue.asp',
    enterpriseValue: 'https://www.investopedia.com/terms/e/enterprisevalue.asp',
    residualIncome: 'https://www.investopedia.com/terms/r/residualincome.asp',
    capm: 'https://www.investopedia.com/terms/c/capm.asp',
    beta: 'https://www.investopedia.com/terms/b/beta.asp',
    pe: 'https://www.investopedia.com/terms/p/price-earningsratio.asp',
    pb: 'https://www.investopedia.com/terms/p/price-to-bookratio.asp',
    eps: 'https://www.investopedia.com/terms/e/eps.asp',
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
    buybackYield: 'https://www.investopedia.com/terms/s/sharerepurchase.asp',
    shareholderYield: 'https://www.investopedia.com/terms/s/shareholderyield.asp',
    payout: 'https://www.investopedia.com/terms/p/payoutratio.asp',
    insider: 'https://www.investopedia.com/terms/i/insidertrading.asp',
} as const;

// Equity risk premium: a mature-market figure, plus a country premium for South Africa
const EQUITY_RISK_PREMIUM: Record<MarketKey, number> = { global: 0.055, local: 0.075 };
// Long-run growth can't outpace the economy, so the bond-yield-based terminal growth is capped
const TERMINAL_GROWTH_CAP: Record<MarketKey, number> = { global: 0.04, local: 0.055 };
// Statutory company tax, used when the effective rate can't be worked out from the accounts
const STATUTORY_TAX: Record<MarketKey, number> = { global: 0.21, local: 0.27 };
const PROJECTION_YEARS = 10;

export type SourcePreference = 'auto' | SourceKind;

export type Indicator = { label: string; pass: boolean | null; detail: string; learn?: string };

export type StatementRow = FinancialPeriod & { label: string; roe?: number };

export type ModelResult = {
    key: 'fcff' | 'fcfe' | 'residual';
    label: string;
    perShare?: number;
    enterpriseValue?: number;
    equityValue?: number;
    terminalValue?: number;     // value of everything after the forecast years, at that future date
    terminalValuePv?: number;   // the same, in today's money
    discountRate?: number;
    note?: string;
};

export type RevenueFlow = {
    label: string;
    end: string;
    kind: FinancialPeriod['kind'];
    segments: { name: string; revenue: number }[];
    revenue: number;
    costOfRevenue?: number;
    grossProfit?: number;
    operatingExpenses?: number;
    operatingIncome?: number;
    financeCosts?: number;
    tax?: number;
    otherItems?: number;
    netIncome?: number;
};

export type HealthPoint = {
    label: string;
    end: string;
    kind: FinancialPeriod['kind'];
    totalAssets?: number; totalLiabilities?: number; currentAssets?: number; currentLiabilities?: number; nonCurrentLiabilities?: number;
    nonCurrentAssets?: number; cash?: number; debt?: number; equity?: number;
    debtToEquity?: number; netCash?: number; currentRatio?: number; interestCover?: number; cashFlowToDebt?: number;
};

export type ValuationReport = {
    market: MarketKey;
    symbol: string;
    company: string;
    currency: string;
    sourcePreference: SourcePreference;
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
    perShare: { epsDiluted?: number; epsBasic?: number; bookValue?: number; dps?: number; roe?: number };
    enterprise: { marketEv?: number; marketCap?: number; debt?: number; cash?: number; netDebt?: number; wacc?: number; costOfDebt?: number; taxRate?: number };
    fairValue: {
        method: 'cash-flow' | 'residual-income' | null;
        value?: number;
        difference?: number; // fair value vs price: positive = price below the estimate
        reason?: string;
        costOfEquity?: number;
        terminalGrowth?: number;
        models: ModelResult[];
        inputs: { label: string; value: string; learn?: string }[];
        projections: { year: number; cashFlow: number; presentValue: number }[];
        presentValueOfCashFlows?: number;
    };
    cashFlows: { label: string; end: string; operatingCashFlow?: number; capex?: number; fcf?: number; fcff?: number; fcfe?: number; netBorrowing?: number; taxRate?: number }[];
    analysts: { mean?: number; high?: number; low?: number; count?: number; upside?: number; recommendation?: string; priceHistory: { date: string; close: number }[] };
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
        flows: RevenueFlow[];
    };
    health: {
        asOf?: string;
        totalAssets?: number; totalLiabilities?: number; currentAssets?: number; currentLiabilities?: number; nonCurrentLiabilities?: number;
        cash?: number; debt?: number; equity?: number; debtToEquity?: number; debtToEquityEarliest?: number; earliestYear?: string;
        netCash?: number; interestCover?: number; cashFlowToDebt?: number; currentRatio?: number;
        series: HealthPoint[];
    };
    dividends: {
        yield?: number; trailingDps?: number; forwardRate?: number; forwardYield?: number; buybackYield?: number; shareholderYield?: number;
        payoutRatio?: number; cashPayoutRatio?: number; marketLow?: number; marketHigh?: number; industryAverage?: number;
        exDate?: string; payDate?: string; growth?: number;
        payments: { date: string; amount: number }[];
        annual: { year: number; amount: number; yield?: number; partial: boolean }[];
    };
    people: { officers: Officer[]; insidersPct?: number; institutionsPct?: number; publicPct?: number; holders: Holder[]; trades: InsiderTrade[]; netInsiderSelling?: boolean };
    discover: { cheapPeers: PeerSnapshot[]; dividendPayers: PeerSnapshot[]; medianPe?: number };
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
const big = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

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
// total income on Yahoo), so each line of a series is taken from one source: the one the viewer prefers when it
// has that line, otherwise the one covering the most periods; other sources only fill that source's gaps
const harmonise = (series: FinancialPeriod[], preference: SourcePreference): FinancialPeriod[] => {
    const chosen = new Map<string, SourceKind>();
    for (const field of PERIOD_FIELDS) {
        const coverage = SOURCE_ORDER.map((kind) => ({ kind, n: series.filter((p) => num(p.bySource?.[kind]?.[field])).length }));
        const preferred = preference !== 'auto' ? coverage.find((c) => c.kind === preference && c.n > 0) : undefined;
        const best = preferred ?? coverage.reduce((a, b) => (b.n > a.n ? b : a));
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

const taxRateOf = (p: FinancialPeriod | undefined, market: MarketKey) => {
    const effective = ratio(p?.incomeTax, p?.pretaxIncome);
    return num(effective) && num(p?.pretaxIncome) && p!.pretaxIncome! > 0 && effective >= 0 && effective <= 0.45 ? effective : STATUTORY_TAX[market];
};

// Discounts a cash flow that grows at `startGrowth`, fading in a straight line to `terminalGrowth` by year ten
const discountCashFlows = (base: number, startGrowth: number, terminalGrowth: number, rate: number) => {
    let cashFlow = base;
    let pvSum = 0;
    const projections: { year: number; cashFlow: number; presentValue: number }[] = [];
    for (let year = 1; year <= PROJECTION_YEARS; year++) {
        const growth = startGrowth + (terminalGrowth - startGrowth) * ((year - 1) / (PROJECTION_YEARS - 1));
        cashFlow *= 1 + growth;
        const presentValue = cashFlow / (1 + rate) ** year;
        pvSum += presentValue;
        projections.push({ year: new Date().getFullYear() + year, cashFlow, presentValue });
    }
    const terminalValue = (cashFlow * (1 + terminalGrowth)) / (rate - terminalGrowth);
    const terminalValuePv = terminalValue / (1 + rate) ** PROJECTION_YEARS;
    return { projections, pvSum, terminalValue, terminalValuePv };
};

export const buildReport = (
    data: CompanyFinancialsData,
    benchmarks: MarketBenchmarks | null,
    livePrice?: number,
    sourcePreference: SourcePreference = 'auto',
): ValuationReport => {
    const { market, symbol } = data;
    const s = data.snapshot ?? null;
    const price = livePrice ?? s?.price;
    const sorted = [...(data.periods ?? [])].sort((a, b) => b.end.localeCompare(a.end));
    const periods = (['annual', 'interim', 'quarter', 'ytd'] as const)
        .flatMap((kind) => harmonise(sorted.filter((p) => p.kind === kind), sourcePreference))
        .sort((a, b) => b.end.localeCompare(a.end));
    const annual = periods.filter((p) => p.kind === 'annual').slice(0, 5);
    const latest = annual[0];
    const shares = s?.sharesOutstanding ?? latest?.shares;
    const sameCurrency = !s || s.financialCurrency === s.currency;
    const financial = isFinancialCompany(s);

    // ---- Ratios and per-share figures
    const eps = s?.trailingEps ?? latest?.eps;
    const bookPerShare = s?.bookValuePerShare ?? ratio(latest?.equity, shares);
    const pe = num(price) && num(eps) && eps > 0 && sameCurrency ? price / eps : undefined;
    const pb = num(price) && num(bookPerShare) && bookPerShare > 0 && sameCurrency ? price / bookPerShare : undefined;
    // Negative for many banks and insurers (cash exceeds debt plus market value), where the ratio means nothing
    const evRaw = ratio(s?.enterpriseValue, s?.ebitda);
    const evEbitda = num(evRaw) && evRaw > 0 && num(s?.enterpriseValue) && s!.enterpriseValue! > 0 ? evRaw : undefined;
    const roeOf = (p: FinancialPeriod, prior?: FinancialPeriod) => ratio(p.netIncome, mean([p.equity, prior?.equity]));

    // ---- Balance sheet basics shared by the models
    const sheet = periods.find((p) => num(p.totalAssets));
    const debt = sheet?.totalDebt ?? s?.totalDebt;
    const cash = sheet?.cash ?? s?.totalCash;
    const netDebt = num(debt) && num(cash) ? debt - cash : undefined;
    const marketCap = s?.marketCap ?? (num(price) && num(shares) ? price * shares : undefined);
    const taxRate = taxRateOf(latest, market);

    // ---- Cash flows to the firm and to equity, by year
    const cashFlows = annual.map((p, i) => {
        const prior = annual[i + 1];
        const t = taxRateOf(p, market);
        const netBorrowing = num(p.totalDebt) && num(prior?.totalDebt) ? p.totalDebt - prior!.totalDebt! : undefined;
        const fcff = num(p.operatingCashFlow) ? p.operatingCashFlow + (p.interestExpense ?? 0) * (1 - t) - (p.capex ?? 0) : undefined;
        const fcfe = num(p.operatingCashFlow) ? p.operatingCashFlow - (p.capex ?? 0) + (netBorrowing ?? 0) : undefined;
        return { label: fiscalLabel(p), end: p.end, operatingCashFlow: p.operatingCashFlow, capex: p.capex, fcf: p.freeCashFlow, fcff, fcfe, netBorrowing, taxRate: t };
    });

    // ---- Fair value
    const rf = benchmarks?.riskFreeRate;
    const beta = clamp(s?.beta ?? 1, 0.8, 2);
    const costOfEquity = num(rf) ? rf + beta * EQUITY_RISK_PREMIUM[market] : undefined;
    const terminalGrowth = num(benchmarks?.riskFreeAverage) ? Math.min(benchmarks!.riskFreeAverage, TERMINAL_GROWTH_CAP[market]) : undefined;
    const fairValue: ValuationReport['fairValue'] = { method: null, models: [], inputs: [], projections: [] };
    const avgDebt = mean([latest?.totalDebt, annual[1]?.totalDebt]);
    const costOfDebt = num(latest?.interestExpense) && num(avgDebt) && avgDebt > 0
        ? clamp(latest.interestExpense / avgDebt, 0.02, 0.15)
        : num(rf) ? rf + 0.02 : undefined;
    const debtWeight = num(debt) && num(marketCap) && debt > 0 ? debt / (debt + marketCap) : 0;
    const wacc = num(costOfEquity) && num(costOfDebt) ? (1 - debtWeight) * costOfEquity + debtWeight * costOfDebt * (1 - taxRate) : undefined;
    const historicGrowth = cagr(annual[0]?.netIncome, annual[annual.length - 1]?.netIncome, annual.length - 1);
    const startGrowth = num(terminalGrowth) ? clamp(s?.earningsGrowthNextYear ?? historicGrowth ?? terminalGrowth, -0.05, 0.2) : 0;

    if (!num(costOfEquity) || !num(terminalGrowth)) {
        fairValue.reason = 'Market bond yields are unavailable right now, so the estimate can’t be calculated.';
    } else if (!sameCurrency) {
        fairValue.reason = `The company reports in ${s?.financialCurrency} but trades in ${s?.currency}, so the estimate isn’t comparable with the share price.`;
    } else if (!num(shares) || shares <= 0) {
        fairValue.reason = 'The number of shares in issue is unavailable.';
    } else {
        // Firm: free cash flow to the firm at the weighted cost of capital gives enterprise value; less net debt is equity
        const recentFcff = cashFlows.slice(0, 3).map((c) => c.fcff).filter(num);
        const fcffBase = mean(recentFcff);
        const ebitAfterTax = num(latest?.operatingIncome) && latest.operatingIncome > 0 ? latest.operatingIncome * (1 - taxRate) : undefined;
        const firmBase = num(fcffBase) && fcffBase > 0 ? fcffBase : ebitAfterTax;
        if (!financial && num(firmBase) && num(wacc) && wacc > terminalGrowth + 0.01) {
            const run = discountCashFlows(firmBase, startGrowth, terminalGrowth, wacc);
            const enterpriseValue = run.pvSum + run.terminalValuePv;
            const equityValue = enterpriseValue - (netDebt ?? 0);
            fairValue.models.push({
                key: 'fcff', label: 'Cash flow to the firm (FCFF)', perShare: equityValue / shares, enterpriseValue, equityValue,
                terminalValue: run.terminalValue, terminalValuePv: run.terminalValuePv, discountRate: wacc,
                note: num(netDebt) ? undefined : 'Net debt unavailable; enterprise value used as equity value',
            });
            if (!fairValue.projections.length) Object.assign(fairValue, { projections: run.projections, presentValueOfCashFlows: run.pvSum });
        }

        // Equity: free cash flow to equity (after debt flows) at the cost of equity gives equity value directly
        const recentFcfe = cashFlows.slice(0, 3).map((c) => c.fcfe).filter(num);
        const fcfeBase = mean(recentFcfe);
        const equityBase = num(fcfeBase) && fcfeBase > 0 ? fcfeBase : num(latest?.netIncome) && latest.netIncome > 0 ? latest.netIncome : undefined;
        if (!financial && num(equityBase) && costOfEquity > terminalGrowth + 0.01) {
            const run = discountCashFlows(equityBase, startGrowth, terminalGrowth, costOfEquity);
            const equityValue = run.pvSum + run.terminalValuePv;
            fairValue.models.push({
                key: 'fcfe', label: 'Cash flow to equity (FCFE)', perShare: equityValue / shares, equityValue,
                enterpriseValue: num(netDebt) ? equityValue + netDebt : undefined,
                terminalValue: run.terminalValue, terminalValuePv: run.terminalValuePv, discountRate: costOfEquity,
            });
            if (!fairValue.projections.length) Object.assign(fairValue, { projections: run.projections, presentValueOfCashFlows: run.pvSum });
        }

        // Banks and insurers: book value plus the value of returns earned above the cost of equity
        if (financial) {
            const roes = annual.map((p, i) => roeOf(p, annual[i + 1]));
            const roe = clamp(mean([...roes, s?.returnOnEquity]) ?? 0, 0, 0.4);
            if (num(bookPerShare) && bookPerShare > 0 && costOfEquity > terminalGrowth) {
                const excess = (roe - costOfEquity) * bookPerShare;
                const terminalPerShare = excess / (costOfEquity - terminalGrowth);
                const perShare = bookPerShare + terminalPerShare;
                fairValue.models.push({
                    key: 'residual', label: 'Residual income (book value plus excess returns)', perShare,
                    equityValue: perShare * shares, enterpriseValue: num(netDebt) ? perShare * shares + netDebt : undefined,
                    terminalValue: terminalPerShare * shares, terminalValuePv: terminalPerShare * shares, discountRate: costOfEquity,
                    note: 'The terminal value here is the value of all future returns above the cost of equity',
                });
                fairValue.inputs.push(
                    { label: 'Book value per share', value: bookPerShare.toFixed(2), learn: LEARN.pb },
                    { label: 'Return on equity (average)', value: pct(roe), learn: LEARN.roe },
                    { label: 'Excess return per share', value: excess.toFixed(2), learn: LEARN.residualIncome },
                );
            }
        }

        const headline = fairValue.models[0];
        if (headline) {
            fairValue.method = headline.key === 'residual' ? 'residual-income' : 'cash-flow';
            fairValue.value = headline.perShare;
            fairValue.costOfEquity = costOfEquity;
            fairValue.terminalGrowth = terminalGrowth;
            if (headline.key !== 'residual') {
                fairValue.inputs.push(
                    { label: headline.key === 'fcff' ? 'Free cash flow to the firm (average of recent years)' : 'Free cash flow to equity (average of recent years)', value: big(headline.key === 'fcff' ? firmBase! : equityBase!), learn: headline.key === 'fcff' ? LEARN.fcff : LEARN.fcfe },
                    { label: s?.earningsGrowthNextYear != null ? 'Starting growth (analyst forecast)' : 'Starting growth (past earnings trend)', value: pct(startGrowth) },
                    { label: 'Cost of debt (after tax)', value: pct(num(costOfDebt) ? costOfDebt * (1 - taxRate) : undefined) },
                    { label: 'Debt share of capital', value: pct(debtWeight) },
                    { label: 'Weighted cost of capital (WACC)', value: pct(wacc), learn: LEARN.wacc },
                    { label: 'Tax rate', value: pct(taxRate) },
                );
            }
            fairValue.inputs.push(
                { label: 'Long-term growth (bond yield, capped)', value: pct(terminalGrowth), learn: LEARN.terminalValue },
                { label: '10-year bond yield', value: pct(rf), learn: benchmarks?.riskFreeSource.url },
                { label: 'Beta (limited to 0.8 to 2)', value: beta.toFixed(2), learn: LEARN.beta },
                { label: 'Equity risk premium', value: pct(EQUITY_RISK_PREMIUM[market]) },
                { label: 'Cost of equity', value: pct(costOfEquity), learn: LEARN.capm },
                { label: 'Shares in issue', value: big(shares) },
            );
        } else {
            fairValue.reason = financial
                ? 'Book value is unavailable, so the residual-income estimate can’t be calculated.'
                : 'Cash flows and profits are negative, so a cash-flow estimate isn’t meaningful.';
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

    // ---- Analysts, with two years of prices for the target chart
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const analysts = {
        mean: s?.targetMean, high: s?.targetHigh, low: s?.targetLow, count: s?.analystCount, recommendation: s?.recommendation,
        upside: num(s?.targetMean) && num(price) ? s!.targetMean! / price - 1 : undefined,
        priceHistory: (s?.priceHistory ?? []).filter((p) => p.date >= twoYearsAgo),
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
    const withRoe = (list: FinancialPeriod[]) => list.map((p, i): StatementRow => ({ ...p, label: fiscalLabel(p), roe: p.kind === 'annual' ? roeOf(p, list[i + 1]) : undefined }));
    const quarters = periods.filter((p) => p.kind === 'quarter').slice(0, 8);
    const halves = periods.filter((p) => p.kind === 'interim').slice(0, 6);
    const ytd = periods.filter((p) => p.kind === 'ytd').slice(0, 2);
    // JSE companies report half-yearly: their latest half year (when newer than the last full year) is the year to date
    const toDate = ytd.length ? ytd : halves[0] && (!latest || halves[0].end > latest.end)
        ? halves.filter((h) => h.end === halves[0].end || h.end.slice(5) === halves[0].end.slice(5)).slice(0, 2)
        : [];
    const oldest = annual[annual.length - 1];
    const years = annual.length - 1;
    const flowOf = (p: FinancialPeriod): RevenueFlow | null => {
        if (!num(p.revenue) || p.revenue <= 0) return null;
        const costOfRevenue = num(p.grossProfit) ? p.revenue - p.grossProfit : undefined;
        const operatingExpenses = num(p.operatingIncome) ? (num(p.grossProfit) ? p.grossProfit : p.revenue) - p.operatingIncome : undefined;
        const otherItems = num(p.operatingIncome) && num(p.netIncome)
            ? p.operatingIncome - (p.interestExpense ?? 0) - (p.incomeTax ?? 0) - p.netIncome
            : undefined;
        return {
            label: fiscalLabel(p), end: p.end, kind: p.kind, segments: p.segments ?? [], revenue: p.revenue,
            costOfRevenue, grossProfit: p.grossProfit, operatingExpenses, operatingIncome: p.operatingIncome,
            financeCosts: p.interestExpense, tax: p.incomeTax, otherItems, netIncome: p.netIncome,
        };
    };
    const performance: ValuationReport['performance'] = {
        annual: withRoe(annual),
        toDate: withRoe(toDate),
        recent: withRoe(quarters.length ? quarters : halves),
        recentLabel: quarters.length ? 'Quarterly' : 'Half-yearly',
        revenueGrowth1y: annual[1] && num(ratio(latest?.revenue, annual[1].revenue)) ? ratio(latest?.revenue, annual[1].revenue)! - 1 : undefined,
        revenueCagr: cagr(latest?.revenue, oldest?.revenue, years),
        earningsGrowth1y: annual[1] && num(annual[1].netIncome) && annual[1].netIncome > 0 ? ratio(latest?.netIncome, annual[1].netIncome)! - 1 : undefined,
        earningsCagr: cagr(latest?.netIncome, oldest?.netIncome, years),
        cagrYears: years > 0 ? years : undefined,
        netMargin: ratio(latest?.netIncome, latest?.revenue),
        netMarginPrior: ratio(annual[1]?.netIncome, annual[1]?.revenue),
        roe: (latest ? roeOf(latest, annual[1]) : undefined) ?? s?.returnOnEquity,
        roa: ratio(latest?.netIncome, latest?.totalAssets),
        cashConversion: num(latest?.netIncome) && latest.netIncome > 0 ? ratio(latest.operatingCashFlow, latest.netIncome) : undefined,
        // Annual and half-year flows, newest first, for the year-by-year revenue breakdown
        flows: [...annual, ...halves].sort((a, b) => b.end.localeCompare(a.end)).map(flowOf).filter((f): f is RevenueFlow => !!f),
    };

    // ---- Balance sheet, now and for every reported period (so the charts can step between years)
    const earliest = [...annual].reverse().find((p) => num(p.equity) && p.equity > 0);
    const pointOf = (p: FinancialPeriod): HealthPoint => ({
        label: fiscalLabel(p), end: p.end, kind: p.kind,
        totalAssets: p.totalAssets, totalLiabilities: p.totalLiabilities, currentAssets: p.currentAssets, currentLiabilities: p.currentLiabilities,
        nonCurrentLiabilities: num(p.totalLiabilities) && num(p.currentLiabilities) ? p.totalLiabilities - p.currentLiabilities : undefined,
        nonCurrentAssets: num(p.totalAssets) && num(p.currentAssets) ? p.totalAssets - p.currentAssets : undefined,
        cash: p.cash, debt: p.totalDebt, equity: p.equity,
        debtToEquity: ratio(p.totalDebt, p.equity),
        netCash: num(p.cash) && num(p.totalDebt) ? p.cash - p.totalDebt : undefined,
        currentRatio: ratio(p.currentAssets, p.currentLiabilities),
        interestCover: num(p.interestExpense) && p.interestExpense > 0 ? ratio(p.operatingIncome, p.interestExpense) : undefined,
        // Cash flow over debt only means something for a full year
        cashFlowToDebt: p.kind === 'annual' && num(p.totalDebt) && p.totalDebt > 0 ? ratio(p.operatingCashFlow, p.totalDebt) : undefined,
    });
    const health: ValuationReport['health'] = {
        asOf: sheet?.end,
        totalAssets: sheet?.totalAssets, totalLiabilities: sheet?.totalLiabilities,
        currentAssets: sheet?.currentAssets, currentLiabilities: sheet?.currentLiabilities,
        nonCurrentLiabilities: num(sheet?.totalLiabilities) && num(sheet?.currentLiabilities) ? sheet!.totalLiabilities! - sheet!.currentLiabilities! : undefined,
        cash, debt, equity: sheet?.equity,
        debtToEquity: ratio(debt, sheet?.equity),
        debtToEquityEarliest: earliest && earliest !== sheet ? ratio(earliest.totalDebt, earliest.equity) : undefined,
        earliestYear: earliest?.end.slice(0, 4),
        netCash: num(netDebt) ? -netDebt : undefined,
        interestCover: num(latest?.interestExpense) && latest.interestExpense > 0 ? ratio(latest.operatingIncome, latest.interestExpense) : undefined,
        cashFlowToDebt: num(latest?.totalDebt) && latest.totalDebt > 0 ? ratio(latest.operatingCashFlow, latest.totalDebt) : undefined,
        currentRatio: ratio(sheet?.currentAssets, sheet?.currentLiabilities),
        series: periods.filter((p) => num(p.totalAssets) && p.kind !== 'ytd').map(pointOf).sort((a, b) => a.end.localeCompare(b.end)),
    };

    // ---- Dividends: every payment, totals by calendar year with the yield at that year's average price
    const payments = s?.dividendPayments ?? [];
    const prices = s?.priceHistory ?? [];
    const thisYear = new Date().getFullYear();
    const yearlyTotals = new Map<number, number>();
    for (const p of payments) yearlyTotals.set(Number(p.date.slice(0, 4)), (yearlyTotals.get(Number(p.date.slice(0, 4))) ?? 0) + p.amount);
    const annualDividends = [...yearlyTotals.entries()].sort((a, b) => a[0] - b[0]).map(([year, amount]) => {
        const avgPrice = mean(prices.filter((p) => p.date.startsWith(String(year))).map((p) => p.close));
        return { year, amount, yield: num(avgPrice) && avgPrice > 0 ? amount / avgPrice : undefined, partial: year === thisYear };
    });
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const trailingDps = payments.filter((p) => p.date >= yearAgo).reduce((a, p) => a + p.amount, 0) || s?.trailingDividendRate;
    const fullYears = annualDividends.filter((d) => !d.partial).slice(-6);
    const buybackYield = num(latest?.buybacks) && num(marketCap) && marketCap > 0 ? latest.buybacks / marketCap : undefined;
    const dividendYield = s?.dividendYield ?? (num(trailingDps) && num(price) && price > 0 ? trailingDps / price : undefined);
    const dividends: ValuationReport['dividends'] = {
        yield: dividendYield,
        trailingDps,
        forwardRate: s?.dividendRate,
        forwardYield: num(s?.dividendRate) && num(price) && price > 0 ? s!.dividendRate! / price : undefined,
        buybackYield,
        shareholderYield: num(dividendYield) || num(buybackYield) ? (dividendYield ?? 0) + (buybackYield ?? 0) : undefined,
        payoutRatio: s?.payoutRatio ?? ratio(latest?.dps, latest?.eps),
        cashPayoutRatio: num(latest?.freeCashFlow) && latest.freeCashFlow > 0 ? ratio(latest.dividendsPaid, latest.freeCashFlow) : undefined,
        marketLow: benchmarks?.dividendYieldP25, marketHigh: benchmarks?.dividendYieldP75,
        industryAverage: mean(peers.map((p) => p.dividendYield).filter((v) => num(v) && v! > 0)),
        exDate: s?.exDividendDate, payDate: s?.dividendDate,
        growth: fullYears.length > 1 ? cagr(fullYears[fullYears.length - 1].amount, fullYears[0].amount, fullYears.length - 1) : undefined,
        payments,
        annual: annualDividends,
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

    // ---- Shares worth a look: peers on the lowest P/E, and the market's highest dividend payers
    const discover = {
        cheapPeers: [...peers].filter((p) => num(p.pe) && p.pe! > 0).sort((a, b) => a.pe! - b.pe!).slice(0, 3),
        dividendPayers: (benchmarks?.topDividendPayers ?? []).filter((p) => p.symbol !== symbol).slice(0, 3),
        medianPe: benchmarks?.medianPe,
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
            check('Pays a dividend', num(dividends.yield) ? dividends.yield > 0 : num(dividends.trailingDps) ? dividends.trailingDps > 0 : null, pct(dividends.yield, 2), LEARN.dividendYield),
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
    if (s) sources.set('yahoo-summary', { kind: 'yahoo', label: 'Yahoo Finance quote, profile, analysts, ownership and dividends', url: `https://finance.yahoo.com/quote/${encodeURIComponent(s.yahooSymbol)}` });
    if (benchmarks) sources.set('bond', { kind: 'yahoo', label: benchmarks.riskFreeSource.label, url: benchmarks.riskFreeSource.url });

    return {
        market, symbol, company: data.company || s?.name || symbol,
        currency: s?.currency ?? (market === 'local' ? 'ZAR' : 'USD'),
        sourcePreference,
        phase: data.phase, message: data.message, websiteNote: data.websiteNote,
        collectedAt: data.collectedAt ? new Date(data.collectedAt).toISOString() : undefined,
        documents: data.documents ?? [],
        sources: [...sources.values()],
        snapshot: s, benchmarks, price,
        ratios: { pe, pb, evEbitda, dividendYield: s?.dividendYield, marketCap },
        perShare: { epsDiluted: latest?.eps ?? s?.trailingEps, epsBasic: latest?.epsBasic, bookValue: bookPerShare, dps: trailingDps, roe: performance.roe },
        enterprise: {
            marketEv: num(marketCap) ? marketCap + (netDebt ?? 0) : s?.enterpriseValue,
            marketCap, debt, cash, netDebt, wacc, costOfDebt, taxRate,
        },
        fairValue, cashFlows, analysts, relative, growth, performance, health, dividends, people, discover, indicators, highlights,
    };
};
