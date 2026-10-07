'use client';

import {useState} from "react";
import {ExternalLink} from "lucide-react";
import {PeriodColumns} from "@/components/valuation/charts";
import {money} from "@/components/valuation/format";
import type {StatementRow} from "@/lib/valuation/model";

type View = 'annual' | 'toDate' | 'recent';

const ROWS: { key: keyof StatementRow; label: string; perShare?: boolean; ratio?: boolean }[] = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'grossProfit', label: 'Gross profit' },
    { key: 'operatingIncome', label: 'Operating profit' },
    { key: 'netIncome', label: 'Net profit (to shareholders)' },
    { key: 'eps', label: 'Diluted earnings per share', perShare: true },
    { key: 'epsBasic', label: 'Basic earnings per share', perShare: true },
    { key: 'dps', label: 'Dividend per share', perShare: true },
    { key: 'operatingCashFlow', label: 'Operating cash flow' },
    { key: 'capex', label: 'Capital expenditure' },
    { key: 'freeCashFlow', label: 'Free cash flow' },
    { key: 'totalAssets', label: 'Total assets' },
    { key: 'totalLiabilities', label: 'Total liabilities' },
    { key: 'equity', label: 'Shareholders’ equity' },
    { key: 'totalDebt', label: 'Debt' },
    { key: 'cash', label: 'Cash and equivalents' },
    { key: 'roe', label: 'Return on equity', ratio: true },
];

const SOURCE_TAG: Record<string, { short: string; title: string }> = {
    sec: { short: 'SEC', title: 'From the company’s SEC filing' },
    company: { short: 'CO', title: 'Read from the company’s own results document' },
    yahoo: { short: 'YF', title: 'From Yahoo Finance' },
};

// The reported figures by period, as a chart and a table, with where each figure came from
const StatementsPanel = ({ annual, toDate, recent, recentLabel, currency }: {
    annual: StatementRow[];
    toDate: StatementRow[];
    recent: StatementRow[];
    recentLabel: string;
    currency: string;
}) => {
    const views: { key: View; label: string; rows: StatementRow[] }[] = [
        { key: 'annual', label: `${annual.length || 5}-year`, rows: annual },
        { key: 'toDate', label: 'Year to date', rows: toDate },
        { key: 'recent', label: recentLabel, rows: recent },
    ];
    const [view, setView] = useState<View>('annual');
    const active = views.find((v) => v.key === view)!;
    // Oldest first reads left to right
    const columns = [...active.rows].reverse();
    const shown = ROWS.filter((r) => columns.some((c) => typeof c[r.key] === 'number'));

    return (
        <div className="dash-panel flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="pill-tabs w-fit" role="tablist" aria-label="Period">
                    {views.map((v) => (
                        <button key={v.key} type="button" role="tab" aria-selected={view === v.key} data-active={view === v.key}
                            className="pill-tab disabled:cursor-not-allowed disabled:opacity-40" disabled={!v.rows.length} onClick={() => setView(v.key)}>
                            {v.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-500">Figures in {currency}. Tags show the source of each figure.</p>
            </div>

            {columns.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No figures are available for this view yet.</p>
            ) : (
                <>
                    <PeriodColumns
                        periods={columns.map((c) => ({ label: c.label, values: { revenue: c.revenue, netIncome: c.netIncome, freeCashFlow: c.freeCashFlow } }))}
                        series={[{ key: 'revenue', label: 'Revenue' }, { key: 'netIncome', label: 'Net profit' }, { key: 'freeCashFlow', label: 'Free cash flow' }]}
                        format={(v) => money(v, currency)}
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-left text-xs text-gray-500">
                                    <th className="py-2 pr-4 font-medium">Figure</th>
                                    {columns.map((c) => {
                                        const source = c.sources[0];
                                        return (
                                            <th key={c.label} className="py-2 pl-4 text-right font-medium">
                                                {source?.url ? (
                                                    <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.label} className="inline-flex items-center gap-1 hover:text-blue-700">
                                                        {c.label} <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                ) : c.label}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((row) => (
                                    <tr key={row.key} className="border-b border-gray-800">
                                        <td className="py-2 pr-4 text-gray-400">{row.label}</td>
                                        {columns.map((c) => {
                                            const value = c[row.key] as number | undefined;
                                            const tag = SOURCE_TAG[c.fieldSources?.[row.key as string] ?? c.sources[0]?.kind ?? ''];
                                            return (
                                                <td key={c.label} className="py-2 pl-4 text-right tabular-nums text-gray-100">
                                                    {typeof value === 'number' ? (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {row.ratio ? `${(value * 100).toFixed(1)}%` : row.perShare ? money(value, currency, false) : money(value, currency)}
                                                            {tag && !row.ratio && <span title={tag.title} className="rounded bg-gray-700 px-1 text-[10px] text-gray-400">{tag.short}</span>}
                                                        </span>
                                                    ) : <span className="text-gray-600">—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default StatementsPanel;
