import type { FinancialPeriod, PeriodField, PeriodKind } from '@/lib/valuation/types';

// Yahoo Finance's free statements feed: about four financial years, plus recent quarters where the company
// reports them (JSE companies report half-yearly, so they have none)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TIMESERIES_URL = 'https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';

// Our field -> Yahoo's names, in order of preference
const FIELDS: [PeriodField, string[]][] = [
    ['revenue', ['TotalRevenue']],
    ['grossProfit', ['GrossProfit']],
    ['operatingIncome', ['OperatingIncome', 'EBIT']],
    ['netIncome', ['NetIncomeCommonStockholders', 'NetIncome']],
    ['eps', ['DilutedEPS', 'BasicEPS']],
    ['epsBasic', ['BasicEPS']],
    ['buybacks', ['RepurchaseOfCapitalStock']],
    ['incomeTax', ['TaxProvision']],
    ['pretaxIncome', ['PretaxIncome']],
    ['totalAssets', ['TotalAssets']],
    ['totalLiabilities', ['TotalLiabilitiesNetMinorityInterest']],
    ['currentAssets', ['CurrentAssets']],
    ['currentLiabilities', ['CurrentLiabilities']],
    ['cash', ['CashCashEquivalentsAndShortTermInvestments', 'CashAndCashEquivalents']],
    ['totalDebt', ['TotalDebt']],
    ['equity', ['StockholdersEquity']],
    ['operatingCashFlow', ['OperatingCashFlow']],
    ['capex', ['CapitalExpenditure']],
    ['freeCashFlow', ['FreeCashFlow']],
    ['interestExpense', ['InterestExpense']],
    ['dividendsPaid', ['CashDividendsPaid']],
    ['depreciation', ['ReconciledDepreciation', 'DepreciationAndAmortization']],
    ['shares', ['DilutedAverageShares', 'OrdinarySharesNumber']],
];

// Outflows Yahoo reports as negatives that we keep as positive amounts
const OUTFLOWS = new Set<PeriodField>(['capex', 'dividendsPaid', 'buybacks']);

type Point = { asOfDate: string; reportedValue?: { raw?: number } };

export const fetchYahooPeriods = async (yahooSymbol: string): Promise<FinancialPeriod[]> => {
    const prefixes: { prefix: string; kind: PeriodKind; months: number }[] = [
        { prefix: 'annual', kind: 'annual', months: 12 },
        { prefix: 'quarterly', kind: 'quarter', months: 3 },
    ];
    const names = [...new Set(FIELDS.flatMap(([, n]) => n))];
    const types = prefixes.flatMap(({ prefix }) => names.map((n) => `${prefix}${n}`));
    const now = Math.floor(Date.now() / 1000);
    const url = `${TIMESERIES_URL}/${encodeURIComponent(yahooSymbol)}?type=${types.join(',')}&period1=${now - 8 * 365 * 86400}&period2=${now}`;

    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' });
        if (!res.ok) return [];
        const json = (await res.json()) as { timeseries?: { result?: Record<string, unknown>[] } };

        // type name -> date -> value
        const values = new Map<string, Map<string, number>>();
        for (const result of json.timeseries?.result ?? []) {
            const type = (result.meta as { type?: string[] } | undefined)?.type?.[0];
            if (!type) continue;
            const points = ((result[type] as (Point | null)[] | undefined) ?? []).filter((p): p is Point => !!p);
            values.set(type, new Map(points.flatMap((p) => (p.reportedValue?.raw != null ? [[p.asOfDate, p.reportedValue.raw] as const] : []))));
        }

        const source = { kind: 'yahoo' as const, label: 'Yahoo Finance financial statements', url: `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}/financials` };

        return prefixes.flatMap(({ prefix, kind, months }) => {
            const dates = [...new Set(names.flatMap((n) => [...(values.get(`${prefix}${n}`)?.keys() ?? [])]))].sort().reverse();
            return dates.map((end) => {
                const period: FinancialPeriod = { kind, end, months, sources: [source] };
                for (const [field, yahooNames] of FIELDS) {
                    const value = yahooNames.map((n) => values.get(`${prefix}${n}`)?.get(end)).find((v) => v != null);
                    if (value != null) period[field] = (OUTFLOWS.has(field) ? Math.abs(value) : value) as never;
                }
                if (period.freeCashFlow == null && period.operatingCashFlow != null) period.freeCashFlow = period.operatingCashFlow - (period.capex ?? 0);
                return period;
            }).filter((p) => p.revenue != null || p.netIncome != null);
        });
    } catch (e) {
        console.error('fetchYahooPeriods error:', yahooSymbol, e);
        return [];
    }
};
