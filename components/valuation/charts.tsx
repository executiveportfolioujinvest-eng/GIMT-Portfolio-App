// Small SVG charts for the Valuation tab, drawn in the GMIT palette

const C = {
    accent: '#5862FF',
    navy: '#215D8B',
    up: '#0FEDBE',
    down: '#FF495B',
    amber: '#FDD458',
    grid: '#30333A',
    muted: '#9095A1',
    text: '#CCDADC',
};
export const SERIES_COLORS = [C.accent, C.up, C.amber, C.navy, C.down];

const ok = (v?: number | null): v is number => typeof v === 'number' && Number.isFinite(v);

// Horizontal bars comparing one value across items (e.g. a P/E against peers and the market)
export const CompareBars = ({ rows, format }: {
    rows: { label: string; value?: number | null; highlight?: boolean }[];
    format: (v: number) => string;
}) => {
    const values = rows.map((r) => r.value).filter(ok);
    const max = Math.max(...values.map(Math.abs), 0) || 1;
    return (
        <div className="flex flex-col gap-2.5">
            {rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(6rem,9rem)_1fr_4.5rem] items-center gap-3 text-sm">
                    <span className={row.highlight ? 'font-semibold text-gray-100' : 'text-gray-400'}>{row.label}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-gray-700">
                        {ok(row.value) && (
                            <span
                                className="block h-full rounded-full"
                                style={{ width: `${Math.max(2, (Math.abs(row.value) / max) * 100)}%`, background: row.highlight ? C.accent : row.value < 0 ? C.down : C.navy }}
                            />
                        )}
                    </span>
                    <span className={`text-right tabular-nums ${row.highlight ? 'text-gray-100' : 'text-gray-400'}`}>{ok(row.value) ? format(row.value) : '—'}</span>
                </div>
            ))}
        </div>
    );
};

// Share price against the fair value estimate, on a scale shaded from "below" through "near" to "above" the estimate
export const FairValueTrack = ({ price, fairValue, format }: { price?: number; fairValue?: number; format: (v: number) => string }) => {
    if (!ok(price) || !ok(fairValue) || fairValue <= 0) return null;
    const top = Math.max(price, fairValue) * 1.35;
    const x = (v: number) => `${Math.min(100, Math.max(0, (v / top) * 100))}%`;
    const near = { from: fairValue * 0.8, to: fairValue * 1.2 };
    return (
        <div className="py-2">
            <div className="relative h-14">
                <div className="absolute inset-x-0 top-5 h-4 overflow-hidden rounded-full bg-gray-700">
                    <span className="absolute inset-y-0 left-0" style={{ width: x(near.from), background: 'rgba(15,237,190,0.35)' }} />
                    <span className="absolute inset-y-0" style={{ left: x(near.from), width: `calc(${x(near.to)} - ${x(near.from)})`, background: 'rgba(144,149,161,0.35)' }} />
                    <span className="absolute inset-y-0 right-0" style={{ left: x(near.to), background: 'rgba(255,73,91,0.35)' }} />
                </div>
                {[{ v: fairValue, label: `Estimate ${format(fairValue)}`, color: C.text, top: true }, { v: price, label: `Price ${format(price)}`, color: C.accent, top: false }].map((m) => (
                    <div key={m.label} className="absolute -translate-x-1/2" style={{ left: x(m.v), top: m.top ? 0 : 20 }}>
                        <span className="block h-4 w-0.5 rounded" style={{ background: m.color, marginTop: m.top ? 4 : 0, height: m.top ? 16 : 24 }} />
                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium" style={{ color: m.color, top: m.top ? -14 : 26 }}>{m.label}</span>
                    </div>
                ))}
            </div>
            <div className="mt-5 flex justify-between text-xs text-gray-500">
                <span className="text-teal-400">Below estimate</span>
                <span>Within 20% of estimate</span>
                <span className="text-red-500">Above estimate</span>
            </div>
        </div>
    );
};

// Grouped columns per period (e.g. revenue, profit and free cash flow by year), with a zero line for losses
export const PeriodColumns = ({ periods, series, format, height = 220 }: {
    periods: { label: string; values: Record<string, number | undefined> }[];
    series: { key: string; label: string }[];
    format: (v: number) => string;
    height?: number;
}) => {
    const all = periods.flatMap((p) => series.map((s) => p.values[s.key])).filter(ok);
    if (!all.length) return <p className="py-8 text-center text-sm text-gray-500">No figures for this view.</p>;
    const max = Math.max(...all, 0);
    const min = Math.min(...all, 0);
    const span = max - min || 1;
    const width = 640;
    const pad = { top: 12, bottom: 28, left: 8, right: 8 };
    const plot = height - pad.top - pad.bottom;
    const y = (v: number) => pad.top + ((max - v) / span) * plot;
    const groupWidth = (width - pad.left - pad.right) / periods.length;
    const barWidth = Math.min(28, (groupWidth * 0.75) / series.length);

    return (
        <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Figures by period">
                <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke={C.grid} />
                {periods.map((p, i) => {
                    const groupX = pad.left + i * groupWidth + (groupWidth - barWidth * series.length) / 2;
                    return (
                        <g key={p.label}>
                            {series.map((s, j) => {
                                const v = p.values[s.key];
                                if (!ok(v)) return null;
                                const top = Math.min(y(v), y(0));
                                return (
                                    <rect key={s.key} x={groupX + j * barWidth} y={top} width={barWidth - 3} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={3}
                                        fill={v < 0 ? C.down : SERIES_COLORS[j % SERIES_COLORS.length]}>
                                        <title>{`${p.label} ${s.label}: ${format(v)}`}</title>
                                    </rect>
                                );
                            })}
                            <text x={pad.left + i * groupWidth + groupWidth / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={C.muted}>{p.label}</text>
                        </g>
                    );
                })}
            </svg>
            <Legend series={series} />
        </div>
    );
};

// Lines over time for a few related figures (e.g. debt, equity and cash); `highlight` marks one point in time
export const TrendLines = ({ points, series, format, height = 200, highlight }: {
    points: { label: string; values: Record<string, number | undefined> }[];
    series: { key: string; label: string }[];
    format: (v: number) => string;
    height?: number;
    highlight?: number;
}) => {
    const all = points.flatMap((p) => series.map((s) => p.values[s.key])).filter(ok);
    if (points.length < 2 || !all.length) return <p className="py-8 text-center text-sm text-gray-500">Not enough history to chart.</p>;
    const max = Math.max(...all, 0);
    const min = Math.min(...all, 0);
    const span = max - min || 1;
    const width = 640;
    const pad = { top: 12, bottom: 28, left: 12, right: 12 };
    const x = (i: number) => pad.left + (i / (points.length - 1)) * (width - pad.left - pad.right);
    const y = (v: number) => pad.top + ((max - v) / span) * (height - pad.top - pad.bottom);

    return (
        <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Trend over time">
                <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke={C.grid} />
                {highlight != null && highlight >= 0 && highlight < points.length && (
                    <rect x={x(highlight) - 14} y={pad.top - 6} width={28} height={height - pad.top - pad.bottom + 12} rx={6} fill="rgba(88,98,255,0.12)" />
                )}
                {series.map((s, j) => {
                    const pts = points.map((p, i) => (ok(p.values[s.key]) ? `${x(i)},${y(p.values[s.key]!)}` : null)).filter(Boolean);
                    return (
                        <g key={s.key}>
                            <polyline points={pts.join(' ')} fill="none" stroke={SERIES_COLORS[j % SERIES_COLORS.length]} strokeWidth={2.5} strokeLinejoin="round" />
                            {points.map((p, i) => ok(p.values[s.key]) && (
                                <circle key={i} cx={x(i)} cy={y(p.values[s.key]!)} r={3.5} fill={SERIES_COLORS[j % SERIES_COLORS.length]}>
                                    <title>{`${p.label} ${s.label}: ${format(p.values[s.key]!)}`}</title>
                                </circle>
                            ))}
                        </g>
                    );
                })}
                {points.map((p, i) => (
                    <text key={p.label} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={C.muted}>{p.label}</text>
                ))}
            </svg>
            <Legend series={series} />
        </div>
    );
};

// One bar split into parts that add up to 100% (e.g. who owns the shares)
export const SplitBar = ({ parts }: { parts: { label: string; value?: number }[] }) => {
    const shown = parts.filter((p) => ok(p.value) && p.value! > 0);
    const total = shown.reduce((a, p) => a + p.value!, 0) || 1;
    return (
        <div>
            <div className="flex h-5 overflow-hidden rounded-full bg-gray-700">
                {shown.map((p, i) => (
                    <span key={p.label} style={{ width: `${(p.value! / total) * 100}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }} title={`${p.label}: ${(p.value! * 100).toFixed(1)}%`} />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {shown.map((p, i) => (
                    <span key={p.label} className="flex items-center gap-2 text-gray-400">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                        {p.label} <span className="text-gray-100">{(p.value! * 100).toFixed(1)}%</span>
                    </span>
                ))}
            </div>
        </div>
    );
};

const Legend = ({ series }: { series: { key: string; label: string }[] }) => (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
        {series.map((s, j) => (
            <span key={s.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[j % SERIES_COLORS.length] }} />
                {s.label}
            </span>
        ))}
    </div>
);

// Vertical columns with the value on top (e.g. a dividend yield against the market's ranges)
export const ColumnCompare = ({ columns, format, height = 180 }: {
    columns: { label: string; value?: number | null; highlight?: boolean }[];
    format: (v: number) => string;
    height?: number;
}) => {
    const values = columns.map((c) => c.value).filter(ok);
    const max = Math.max(...values, 0) || 1;
    return (
        <div className="flex items-end gap-2" style={{ height }}>
            {columns.map((c, i) => {
                const h = ok(c.value) ? Math.max(4, (c.value / max) * (height - 44)) : 0;
                return (
                    <div key={c.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                        <span className={`text-sm font-semibold tabular-nums ${c.highlight ? 'text-gray-100' : 'text-gray-400'}`}>{ok(c.value) ? format(c.value) : '—'}</span>
                        <span className="w-full rounded-t-md" style={{ height: h, background: c.highlight ? C.accent : SERIES_COLORS[(i % (SERIES_COLORS.length - 1)) + 1], opacity: c.highlight ? 1 : 0.75 }} />
                        <span className="w-full truncate text-center text-xs text-gray-500" title={c.label}>{c.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

// Share price over two years, then a 12-month band from the lowest to the highest analyst target
export const PriceTargetChart = ({ history, mean, high, low, format, height = 240 }: {
    history: { date: string; close: number }[];
    mean?: number; high?: number; low?: number;
    format: (v: number) => string;
    height?: number;
}) => {
    if (history.length < 10) return <p className="py-8 text-center text-sm text-gray-500">Not enough price history to chart.</p>;
    const width = 720;
    const pad = { top: 16, bottom: 26, left: 8, right: 64 };
    const plotW = width - pad.left - pad.right;
    const pastW = plotW * 0.7; // the forecast year takes the right 30% of the plot
    const closes = history.map((p) => p.close);
    const values = [...closes, ...[mean, high, low].filter(ok)];
    const max = Math.max(...values) * 1.05;
    const min = Math.min(...values) * 0.95;
    const y = (v: number) => pad.top + ((max - v) / (max - min || 1)) * (height - pad.top - pad.bottom);
    const x = (i: number) => pad.left + (i / (history.length - 1)) * pastW;
    const lastX = x(history.length - 1);
    const endX = pad.left + plotW;
    const last = closes[closes.length - 1];
    const years = [...new Set(history.map((p) => p.date.slice(0, 4)))];

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Share price and analyst targets">
            <rect x={lastX} y={pad.top} width={endX - lastX} height={height - pad.top - pad.bottom} fill="rgba(253,212,88,0.06)" />
            <text x={lastX + 6} y={pad.top + 12} fontSize={11} fill={C.muted}>Next 12 months</text>
            {ok(high) && ok(low) && (
                <polygon points={`${lastX},${y(last)} ${endX},${y(high)} ${endX},${y(low)}`} fill="rgba(88,98,255,0.18)">
                    <title>{`Analyst targets from ${format(low)} to ${format(high)}`}</title>
                </polygon>
            )}
            {ok(mean) && (
                <>
                    <line x1={lastX} y1={y(last)} x2={endX} y2={y(mean)} stroke={C.accent} strokeWidth={2} strokeDasharray="6 5" />
                    <circle cx={endX} cy={y(mean)} r={4} fill={C.accent} />
                    <text x={endX + 6} y={y(mean) + 4} fontSize={11} fill={C.text}>{format(mean)}</text>
                </>
            )}
            {ok(high) && <text x={endX + 6} y={y(high) + 4} fontSize={10} fill={C.muted}>{format(high)}</text>}
            {ok(low) && <text x={endX + 6} y={y(low) + 4} fontSize={10} fill={C.muted}>{format(low)}</text>}
            <polyline points={history.map((p, i) => `${x(i)},${y(p.close)}`).join(' ')} fill="none" stroke={C.up} strokeWidth={2} strokeLinejoin="round" />
            <circle cx={lastX} cy={y(last)} r={4} fill={C.up}><title>{`Latest close ${format(last)}`}</title></circle>
            {years.map((yr) => {
                const i = history.findIndex((p) => p.date.startsWith(yr));
                return <text key={yr} x={x(i)} y={height - 8} fontSize={11} fill={C.muted}>{yr}</text>;
            })}
        </svg>
    );
};

type FlowInput = {
    segments: { name: string; revenue: number }[]; revenue: number; costOfRevenue?: number; grossProfit?: number;
    operatingExpenses?: number; operatingIncome?: number; financeCosts?: number; tax?: number; otherItems?: number; netIncome?: number;
};

// How revenue becomes profit: segments flow into revenue, which splits into costs and profit at each stage
export const FlowDiagram = ({ flow, format }: { flow: FlowInput; format: (v: number) => string }) => {
    const width = 980;
    const height = 420;
    const nodeW = 14;
    const scale = (height - 90) / flow.revenue;
    type Node = { id: string; label: string; value: number; x: number; y: number; color: string };
    const nodes: Node[] = [];
    const links: { from: Node; to: Node; value: number; fromOffset: number; toOffset: number; color: string }[] = [];
    const col = (i: number) => 20 + i * 210;
    const positive = (v?: number) => (ok(v) && v > 0 ? v : 0);
    const linkColor = (n: { color: string }) => (n.color === C.up ? 'rgba(15,237,190,0.30)' : n.color === C.down ? 'rgba(255,73,91,0.25)' : 'rgba(253,212,88,0.28)');

    const stack = (items: { id: string; label: string; value: number; color: string }[], x: number, top?: number, room?: number, gap = 10) => {
        const total = items.reduce((a, b) => a + b.value * scale, 0) + gap * Math.max(0, items.length - 1);
        let y = top != null && room != null ? top + (room - total) / 2 : (height - total) / 2;
        return items.map((it) => {
            const n = { ...it, x, y };
            y += it.value * scale + gap;
            nodes.push(n);
            return n;
        });
    };
    const connect = (from: Node, targets: Node[]) => {
        let fromOffset = 0;
        for (const t of targets) {
            links.push({ from, to: t, value: t.value, fromOffset, toOffset: 0, color: linkColor(t) });
            fromOffset += t.value * scale;
        }
    };
    const belowProfit = (suffix: string) => [
        { id: `ni${suffix}`, label: 'Net profit', value: positive(flow.netIncome), color: C.up },
        { id: `fin${suffix}`, label: 'Finance costs', value: positive(flow.financeCosts), color: C.down },
        { id: `tax${suffix}`, label: 'Tax', value: positive(flow.tax), color: C.down },
        { id: `oth${suffix}`, label: 'Other items', value: positive(flow.otherItems), color: C.muted },
    ].filter((n) => n.value > 0);

    const [revenue] = stack([{ id: 'revenue', label: 'Revenue', value: flow.revenue, color: C.accent }], col(1));

    // Segments are scaled to the revenue figure when the company reports them on a different basis
    const segmentTotal = flow.segments.reduce((a, s) => a + s.revenue, 0);
    if (flow.segments.length >= 2 && segmentTotal > 0) {
        const segs = stack(flow.segments.map((s) => ({ id: `seg-${s.name}`, label: s.name, value: (s.revenue / segmentTotal) * flow.revenue, color: C.navy })), col(0), undefined, undefined, 6);
        let toOffset = 0;
        for (const s of segs) {
            links.push({ from: s, to: revenue, value: s.value, fromOffset: 0, toOffset, color: 'rgba(33,93,139,0.45)' });
            toOffset += s.value * scale;
        }
    }

    const stage2 = (ok(flow.grossProfit)
        ? [{ id: 'gross', label: 'Gross profit', value: positive(flow.grossProfit), color: C.up }, { id: 'cost', label: 'Cost of revenue', value: positive(flow.costOfRevenue), color: C.amber }]
        : [{ id: 'op', label: 'Operating profit', value: positive(flow.operatingIncome), color: C.up }, { id: 'opex', label: 'Operating costs', value: positive(flow.operatingExpenses), color: C.amber }]
    ).filter((n) => n.value > 0);
    const s2 = stack(stage2, col(2));
    connect(revenue, s2);

    const profit = s2.find((n) => n.id === 'gross' || n.id === 'op');
    if (profit) {
        const stage3 = profit.id === 'gross'
            ? [{ id: 'op3', label: 'Operating profit', value: positive(flow.operatingIncome), color: C.up }, { id: 'opex3', label: 'Operating expenses', value: positive(flow.operatingExpenses), color: C.amber }].filter((n) => n.value > 0)
            : belowProfit('3');
        const s3 = stack(stage3, col(3));
        connect(profit, s3);

        const op3 = s3.find((n) => n.id === 'op3');
        if (op3) {
            const s4 = stack(belowProfit('4'), col(4), op3.y - 40, op3.value * scale + 80, 6);
            connect(op3, s4);
        }
    }

    return (
        <svg viewBox={`0 0 ${width + 140} ${height}`} className="h-auto w-full" role="img" aria-label="Revenue breakdown">
            {links.map((l, i) => {
                const h = l.value * scale;
                const x0 = l.from.x + nodeW;
                const x1 = l.to.x;
                const y0 = l.from.y + l.fromOffset;
                const y1 = l.to.y + l.toOffset;
                const mid = (x0 + x1) / 2;
                return (
                    <path key={i} d={`M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1} L${x1},${y1 + h} C${mid},${y1 + h} ${mid},${y0 + h} ${x0},${y0 + h} Z`} fill={l.color}>
                        <title>{`${l.from.label} → ${l.to.label}: ${format(l.value)}`}</title>
                    </path>
                );
            })}
            {nodes.map((n) => {
                const h = Math.max(2, n.value * scale);
                return (
                    <g key={n.id}>
                        <rect x={n.x} y={n.y} width={nodeW} height={h} rx={3} fill={n.color} />
                        <text x={n.x + nodeW + 6} y={n.y + h / 2 - 2} fontSize={12} fill={C.text}>{n.label}</text>
                        <text x={n.x + nodeW + 6} y={n.y + h / 2 + 12} fontSize={11} fill={C.muted}>{format(n.value)}</text>
                    </g>
                );
            })}
        </svg>
    );
};
