// Shapes shared by the financial data collectors, the valuation model and the Valuation tab

export type PeriodKind = 'annual' | 'interim' | 'quarter' | 'ytd';

export type SourceKind = 'sec' | 'company' | 'yahoo';

export type DataSource = { kind: SourceKind; label: string; url?: string };

// One reporting period's figures, in the company's reporting currency (whole units, not millions)
export type FinancialPeriod = {
    kind: PeriodKind;
    end: string; // YYYY-MM-DD
    months: number;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    eps?: number;
    epsBasic?: number;
    dps?: number;
    totalAssets?: number;
    totalLiabilities?: number;
    currentAssets?: number;
    currentLiabilities?: number;
    cash?: number;
    totalDebt?: number;
    equity?: number;
    operatingCashFlow?: number;
    capex?: number;
    freeCashFlow?: number;
    interestExpense?: number;
    dividendsPaid?: number;
    depreciation?: number;
    shares?: number;
    buybacks?: number;
    incomeTax?: number;
    pretaxIncome?: number;
    // Revenue by business segment, when the company's own results show it
    segments?: { name: string; revenue: number }[];
    sources: DataSource[];
    // Which source each figure came from, when sources were combined
    fieldSources?: Partial<Record<string, DataSource['kind']>>;
    // Every source's own figures for this period, so a series can be shown from one consistent source
    bySource?: Partial<Record<DataSource['kind'], Partial<Record<string, number>>>>;
};

export const PERIOD_FIELDS = [
    'revenue', 'grossProfit', 'operatingIncome', 'netIncome', 'eps', 'epsBasic', 'dps',
    'totalAssets', 'totalLiabilities', 'currentAssets', 'currentLiabilities', 'cash', 'totalDebt', 'equity',
    'operatingCashFlow', 'capex', 'freeCashFlow', 'interestExpense', 'dividendsPaid', 'depreciation', 'shares',
    'buybacks', 'incomeTax', 'pretaxIncome',
] as const;

export type PeriodField = (typeof PERIOD_FIELDS)[number];

export type Officer = { name: string; title: string; age?: number; pay?: number };
export type Holder = { name: string; pctHeld?: number; shares?: number; value?: number; reportDate?: string };
export type InsiderTrade = { name: string; relation?: string; date?: string; shares?: number; value?: number; text?: string };

// Market data and company facts from Yahoo Finance (prices already in main currency units, e.g. rand not cents)
export type CompanySnapshot = {
    name: string;
    yahooSymbol: string;
    currency: string;           // trading currency
    financialCurrency: string;  // reporting currency
    price?: number;
    marketCap?: number;
    sharesOutstanding?: number;
    beta?: number;
    trailingEps?: number;
    forwardEps?: number;
    bookValuePerShare?: number;
    enterpriseValue?: number;
    ebitda?: number;
    revenueTtm?: number;
    netIncomeTtm?: number;
    freeCashFlowTtm?: number;
    operatingCashFlowTtm?: number;
    totalCash?: number;
    totalDebt?: number;
    returnOnEquity?: number;
    profitMargin?: number;
    dividendRate?: number;          // indicated (forward) annual dividend
    trailingDividendRate?: number;  // dividends paid over the last 12 months
    dividendYield?: number;
    payoutRatio?: number;
    exDividendDate?: string;
    dividendDate?: string;
    nextEarningsDate?: string;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    change52w?: number;
    targetMean?: number;
    targetHigh?: number;
    targetLow?: number;
    analystCount?: number;
    recommendation?: string;
    earningsGrowthNextYear?: number;
    revenueGrowthNextYear?: number;
    earningsGrowthThisYear?: number;
    revenueGrowthThisYear?: number;
    epsNextYear?: number;
    sector?: string;
    industry?: string;
    website?: string;
    employees?: number;
    summary?: string;
    address?: string;
    exchange?: string;
    insidersPct?: number;
    institutionsPct?: number;
    institutionsCount?: number;
    officers: Officer[];
    holders: Holder[];
    insiderTrades: InsiderTrade[];
    // Weekly closing prices and every dividend payment over about ten years (main currency units)
    priceHistory?: { date: string; close: number }[];
    dividendPayments?: { date: string; amount: number }[];
};

export type PeerSnapshot = {
    symbol: string;
    name: string;
    pe?: number;
    pb?: number;
    dividendYield?: number;
    earningsGrowthNextYear?: number;
    revenueGrowthNextYear?: number;
    change52w?: number;
    marketCap?: number;
    price?: number;
    sector?: string;
};

export type MarketBenchmarks = {
    market: 'global' | 'local';
    riskFreeRate: number;        // current 10-year government bond yield
    riskFreeAverage: number;     // 5-year average of that yield
    riskFreeSource: { label: string; url: string };
    indexSymbol: string;
    indexName: string;
    indexReturn1y?: number;
    indexWeeklyMove?: number;
    medianPe?: number;
    earningsGrowthNextYear?: number;
    revenueGrowthNextYear?: number;
    dividendYieldP25?: number;
    dividendYieldP75?: number;
    // Highest-yielding shares in the market universe, for the dividends section's suggestions
    topDividendPayers?: PeerSnapshot[];
    updatedAt: string;
};

export type ReportDocument = {
    url: string;
    title: string;
    year?: number;
    type: 'annual' | 'interim';
    status: 'pending' | 'read' | 'failed' | 'skipped';
    note?: string;
};

export type CollectionPhase = 'basics' | 'discover' | 'read' | 'done';
