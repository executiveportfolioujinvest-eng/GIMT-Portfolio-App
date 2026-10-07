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

// Lines over time for a few related figures (e.g. debt, equity and cash)
export const TrendLines = ({ points, series, format, height = 200 }: {
    points: { label: string; values: Record<string, number | undefined> }[];
    series: { key: string; label: string }[];
    format: (v: number) => string;
    height?: number;
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
