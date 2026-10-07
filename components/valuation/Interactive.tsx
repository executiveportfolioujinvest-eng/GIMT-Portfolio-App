'use client';

import {useMemo, useState, useTransition} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {ChevronLeft, ChevronRight, RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {CompareBars, FlowDiagram, TrendLines} from "@/components/valuation/charts";
import {date, isNum, money, pct, times} from "@/components/valuation/format";
import {refreshMarketData} from "@/lib/actions/valuation.actions";
import type {HealthPoint, RevenueFlow, SourcePreference} from "@/lib/valuation/model";
import type {MarketKey} from "@/lib/markets";

const KIND_LABEL: Record<string, string> = { annual: 'Full year', interim: 'Half year', quarter: 'Quarter' };

// Previous / next buttons around a list of period labels
const Stepper = ({ labels, index, onChange }: { labels: string[]; index: number; onChange: (i: number) => void }) => (
    <div className="flex items-center gap-1">
        <Button type="button" aria-label="Earlier period" disabled={index <= 0} onClick={() => onChange(index - 1)}
            className="h-8 w-8 rounded border border-gray-600 bg-transparent p-0 text-gray-100 hover:bg-gray-700 disabled:opacity-30">
            <ChevronLeft className="mx-auto h-4 w-4" />
        </Button>
        <select aria-label="Period" value={index} onChange={(e) => onChange(Number(e.target.value))}
            className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-gray-100">
            {labels.map((l, i) => <option key={`${l}${i}`} value={i}>{l}</option>)}
        </select>
        <Button type="button" aria-label="Later period" disabled={index >= labels.length - 1} onClick={() => onChange(index + 1)}
            className="h-8 w-8 rounded border border-gray-600 bg-transparent p-0 text-gray-100 hover:bg-gray-700 disabled:opacity-30">
            <ChevronRight className="mx-auto h-4 w-4" />
        </Button>
    </div>
);

const KindFilter = ({ kinds, value, onChange }: { kinds: string[]; value: string; onChange: (k: string) => void }) => (
    <div className="pill-tabs w-fit" role="tablist" aria-label="Period type">
        {kinds.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={value === k} data-active={value === k} className="pill-tab" onClick={() => onChange(k)}>
                {KIND_LABEL[k] ?? k}
            </button>
        ))}
    </div>
);

// Balance sheet health for any reported period: pick full years or half years, then step through them
export const HealthExplorer = ({ series, currency }: { series: HealthPoint[]; currency: string }) => {
    const kinds = useMemo(() => ['annual', 'interim', 'quarter'].filter((k) => series.some((p) => p.kind === k)), [series]);
    const [kind, setKind] = useState(kinds[0] ?? 'annual');
    const points = useMemo(() => series.filter((p) => p.kind === kind), [series, kind]);
    const [index, setIndex] = useState(points.length - 1);
    const safeIndex = Math.min(Math.max(index, 0), points.length - 1);
    const point = points[safeIndex];
    const m = (v?: number) => money(v, currency);

    if (!points.length || !point) return <p className="dash-panel text-sm text-gray-500">No balance sheet figures yet.</p>;

    return (
        <div className="dash-panel flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <KindFilter kinds={kinds} value={kind} onChange={(k) => { setKind(k); setIndex(series.filter((p) => p.kind === k).length - 1); }} />
                <Stepper labels={points.map((p) => p.label)} index={safeIndex} onChange={setIndex} />
            </div>
            <p className="text-xs text-gray-500">Balance sheet at {date(point.end)}</p>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                    ['Debt to equity', pct(point.debtToEquity)],
                    [isNum(point.netCash) && point.netCash < 0 ? 'Net debt' : 'Net cash', m(isNum(point.netCash) ? Math.abs(point.netCash) : undefined)],
                    ['Current ratio', isNum(point.currentRatio) ? point.currentRatio.toFixed(2) : '—'],
                    ['Interest cover', times(point.interestCover)],
                    ['Cash flow / debt', pct(point.cashFlowToDebt)],
                    ['Equity', m(point.equity)],
                ].map(([label, value]) => (
                    <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-gray-100">{value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                    <h4 className="mb-3 text-sm font-semibold text-gray-100">What it owns and owes</h4>
                    <CompareBars format={m} rows={[
                        { label: 'Short-term assets', value: point.currentAssets, highlight: true },
                        { label: 'Short-term liabilities', value: point.currentLiabilities },
                        { label: 'Long-term assets', value: point.nonCurrentAssets, highlight: true },
                        { label: 'Long-term liabilities', value: point.nonCurrentLiabilities },
                        { label: 'Total assets', value: point.totalAssets, highlight: true },
                        { label: 'Total liabilities', value: point.totalLiabilities },
                    ]} />
                    {!isNum(point.currentAssets) && (
                        <p className="mt-3 text-xs text-gray-500">This company doesn’t split its balance sheet into short and long term (common for banks and insurers).</p>
                    )}
                </div>
                <div>
                    <h4 className="mb-3 text-sm font-semibold text-gray-100">Debt, equity and cash over time</h4>
                    <TrendLines format={m} highlight={safeIndex}
                        points={points.map((p) => ({ label: p.label.replace('FY ', ''), values: { equity: p.equity, cash: p.cash, debt: p.debt } }))}
                        series={[{ key: 'equity', label: 'Equity' }, { key: 'cash', label: 'Cash' }, { key: 'debt', label: 'Debt' }]} />
                    <div className="mt-2 flex flex-wrap gap-1">
                        {points.map((p, i) => (
                            <button key={p.end} type="button" onClick={() => setIndex(i)} data-active={i === safeIndex}
                                className="pill-tab text-xs">{p.label.replace('FY ', '')}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// How revenue turned into profit, period by period
export const RevenueFlowExplorer = ({ flows, currency }: { flows: RevenueFlow[]; currency: string }) => {
    const kinds = useMemo(() => ['annual', 'interim'].filter((k) => flows.some((f) => f.kind === k)), [flows]);
    const [kind, setKind] = useState(kinds[0] ?? 'annual');
    // Oldest first, so the stepper reads left to right in time
    const list = useMemo(() => flows.filter((f) => f.kind === kind).reverse(), [flows, kind]);
    const [index, setIndex] = useState(list.length - 1);
    const safeIndex = Math.min(Math.max(index, 0), list.length - 1);
    const flow = list[safeIndex];
    if (!flow) return <p className="dash-panel text-sm text-gray-500">No revenue figures yet.</p>;
    const margin = (v?: number) => (isNum(v) ? pct(v / flow.revenue) : '—');

    return (
        <div className="dash-panel flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <KindFilter kinds={kinds} value={kind} onChange={(k) => { setKind(k); setIndex(flows.filter((f) => f.kind === k).length - 1); }} />
                <Stepper labels={list.map((f) => f.label)} index={safeIndex} onChange={setIndex} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400">
                <span>Gross margin <span className="text-gray-100">{margin(flow.grossProfit)}</span></span>
                <span>Operating margin <span className="text-gray-100">{margin(flow.operatingIncome)}</span></span>
                <span>Net margin <span className="text-gray-100">{margin(flow.netIncome)}</span></span>
                {flow.segments.length < 2 && <span className="text-gray-500">Segment split not reported for this period</span>}
            </div>
            <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                    <FlowDiagram flow={flow} format={(v) => money(v, currency)} />
                </div>
            </div>
        </div>
    );
};

// Payments as bars, the yearly total and the yield as lines; hover a year for its figures
export const DividendHistoryChart = ({ annual, payments, forwardRate, forwardYield, currency }: {
    annual: { year: number; amount: number; yield?: number; partial: boolean }[];
    payments: { date: string; amount: number }[];
    forwardRate?: number;
    forwardYield?: number;
    currency: string;
}) => {
    const [span, setSpan] = useState<5 | 10>(10);
    const [hover, setHover] = useState<number | null>(null);
    const thisYear = new Date().getFullYear();
    const years = Array.from({ length: span }, (_, i) => thisYear - span + 1 + i);
    const rows = years.map((year) => annual.find((a) => a.year === year) ?? { year, amount: 0, yield: undefined, partial: year === thisYear });
    const yearPayments = (year: number) => payments.filter((p) => p.date.startsWith(String(year)));
    if (!payments.length) return <p className="py-8 text-center text-sm text-gray-500">No dividend payments in the last ten years.</p>;

    const width = 760;
    const height = 260;
    const pad = { top: 20, bottom: 28, left: 10, right: 46 };
    const colW = (width - pad.left - pad.right) / (years.length + 1);
    const maxAmount = Math.max(...rows.map((r) => r.amount), forwardRate ?? 0) * 1.15 || 1;
    const maxPayment = Math.max(...payments.map((p) => p.amount)) * 1.15 || 1;
    const maxYield = Math.max(...rows.map((r) => r.yield ?? 0), forwardYield ?? 0) * 1.15 || 1;
    const plotH = height - pad.top - pad.bottom;
    const cx = (i: number) => pad.left + colW * i + colW / 2;
    const yAmount = (v: number) => pad.top + plotH - (v / maxAmount) * plotH;
    const yYield = (v: number) => pad.top + plotH - (v / maxYield) * plotH;
    const amountLine = rows.map((r, i) => (r.amount > 0 ? `${cx(i)},${yAmount(r.amount)}` : null)).filter(Boolean).join(' ');
    const yieldLine = rows.map((r, i) => (isNum(r.yield) ? `${cx(i)},${yYield(r.yield!)}` : null)).filter(Boolean).join(' ');
    const forwardX = cx(years.length);
    const hovered = hover != null ? rows[hover] : null;

    return (
        <div>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-400" /> Payments</span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#5862FF]" /> Yearly total</span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#FDD458]" /> Yield</span>
                </div>
                <div className="pill-tabs" role="tablist" aria-label="Years shown">
                    {[5, 10].map((n) => (
                        <button key={n} type="button" role="tab" aria-selected={span === n} data-active={span === n} className="pill-tab" onClick={() => setSpan(n as 5 | 10)}>{n} years</button>
                    ))}
                </div>
            </div>
            <div className="relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Dividend history" onMouseLeave={() => setHover(null)}>
                    <rect x={forwardX - colW / 2} y={pad.top} width={colW} height={plotH} fill="rgba(253,212,88,0.06)" />
                    <text x={forwardX} y={pad.top - 6} textAnchor="middle" fontSize={10} fill="#9095A1">Next 12m</text>
                    {rows.map((r, i) => {
                        const pays = yearPayments(r.year);
                        const barW = Math.min(12, (colW * 0.7) / Math.max(pays.length, 1));
                        return (
                            <g key={r.year} onMouseEnter={() => setHover(i)}>
                                <rect x={cx(i) - colW / 2} y={pad.top} width={colW} height={plotH} fill={hover === i ? 'rgba(88,98,255,0.10)' : 'transparent'} />
                                {pays.map((p, j) => {
                                    const h = (p.amount / maxPayment) * plotH * 0.45;
                                    return <rect key={p.date} x={cx(i) - (pays.length * barW) / 2 + j * barW} y={pad.top + plotH - h} width={barW - 2} height={h} rx={2} fill="#0FEDBE" opacity={0.85} />;
                                })}
                                <text x={cx(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#9095A1">{r.year}{r.partial ? '*' : ''}</text>
                            </g>
                        );
                    })}
                    <polyline points={amountLine} fill="none" stroke="#5862FF" strokeWidth={2.5} />
                    <polyline points={yieldLine} fill="none" stroke="#FDD458" strokeWidth={2} />
                    {isNum(forwardRate) && (
                        <>
                            {rows[rows.length - 1].amount > 0 && <line x1={cx(rows.length - 1)} y1={yAmount(rows[rows.length - 1].amount)} x2={forwardX} y2={yAmount(forwardRate)} stroke="#5862FF" strokeWidth={2} strokeDasharray="5 4" />}
                            <circle cx={forwardX} cy={yAmount(forwardRate)} r={4} fill="#5862FF" />
                        </>
                    )}
                    {isNum(forwardYield) && <circle cx={forwardX} cy={yYield(forwardYield)} r={4} fill="#FDD458" />}
                </svg>
                {hovered && (
                    <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-gray-600 bg-gray-800/95 px-3 py-2 text-xs">
                        <p className="font-semibold text-gray-100">{hovered.year}{hovered.partial ? ' (so far)' : ''}</p>
                        <p className="text-gray-400">Payments: <span className="text-gray-100">{yearPayments(hovered.year).length || 'None'}</span></p>
                        <p className="text-gray-400">Total: <span className="text-gray-100">{hovered.amount > 0 ? money(hovered.amount, currency, false) : '—'}</span></p>
                        <p className="text-gray-400">Yield: <span className="text-gray-100">{pct(hovered.yield, 2)}</span></p>
                    </div>
                )}
            </div>
            <p className="mt-1 text-xs text-gray-500">* Current year so far. Next 12 months uses the company’s indicated annual dividend.</p>
        </div>
    );
};

const SOURCE_OPTIONS: { value: SourcePreference; label: string }[] = [
    { value: 'auto', label: 'Best available' },
    { value: 'company', label: 'Company reports first' },
    { value: 'sec', label: 'SEC filings first' },
    { value: 'yahoo', label: 'Yahoo Finance first' },
];

// Which source the figures come from, and a refresh of the live market data (price, dividends, peers, market figures)
export const ValuationFilters = ({ market, symbol, source, collectedAt }: { market: MarketKey; symbol: string; source: SourcePreference; collectedAt?: string }) => {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [note, setNote] = useState<string>();

    const setSource = (value: string) => {
        const next = new URLSearchParams(params.toString());
        if (value === 'auto') next.delete('source'); else next.set('source', value);
        router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    };

    return (
        <div className="dash-panel mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <label htmlFor="source-filter" className="text-gray-400">Figures from</label>
                <select id="source-filter" value={source} onChange={(e) => setSource(e.target.value)}
                    className="h-9 rounded border border-gray-600 bg-gray-800 px-2 text-gray-100">
                    {SOURCE_OPTIONS.filter((o) => market === 'global' || o.value !== 'sec').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="text-xs text-gray-500">Other sources only fill gaps; tags in the tables show where each figure came from.</span>
            </div>
            <div className="flex items-center gap-3">
                {note && <span className="text-xs text-gray-400">{note}</span>}
                {collectedAt && <span className="text-xs text-gray-500">Figures collected {date(collectedAt)}</span>}
                <Button type="button" disabled={isPending} className="h-9 rounded border border-gray-600 bg-transparent px-3 text-sm text-gray-100 hover:bg-gray-700"
                    onClick={() => startTransition(async () => {
                        const result = await refreshMarketData(market, symbol);
                        setNote(result.error ?? 'Market data refreshed');
                        router.refresh();
                    })}>
                    <RefreshCw className={`mr-1.5 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} /> Refresh market data
                </Button>
            </div>
        </div>
    );
};
