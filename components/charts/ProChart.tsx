'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    AreaSeries,
    BarSeries,
    CandlestickSeries,
    ColorType,
    createChart,
    CrosshairMode,
    HistogramSeries,
    LineSeries,
    PriceScaleMode,
    type IChartApi,
    type ISeriesApi,
    type SeriesType,
    type UTCTimestamp,
} from "lightweight-charts";
import {Maximize2, Minimize2} from "lucide-react";
import {getChartSeries} from "@/lib/actions/yahoo.actions";
import {bollinger, macd, rsi, sma} from "@/lib/indicators";
import {cn} from "@/lib/utils";

const RANGES: ChartRange[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', '10Y', 'MAX'];
type ChartType = 'candles' | 'bars' | 'line' | 'area';
type Overlay = 'volume' | 'ma20' | 'ma50' | 'ma200' | 'bollinger';
type Pane = 'rsi' | 'macd';

const C = {
    up: '#0FEDBE', down: '#FF495B', text: '#9095A1', grid: 'rgba(48, 51, 58, 0.5)', border: '#30333A',
    accent: '#5862FF', amber: '#FDD458', navy: '#215D8B', pink: '#E879F9', muted: 'rgba(144,149,161,0.6)',
};
const OVERLAYS: { key: Overlay; label: string; color: string }[] = [
    { key: 'volume', label: 'Volume', color: C.muted },
    { key: 'ma20', label: 'MA 20', color: C.amber },
    { key: 'ma50', label: 'MA 50', color: C.accent },
    { key: 'ma200', label: 'MA 200', color: C.pink },
    { key: 'bollinger', label: 'Bollinger', color: C.navy },
];
const PANES: { key: Pane; label: string }[] = [{ key: 'rsi', label: 'RSI 14' }, { key: 'macd', label: 'MACD' }];

// JSE trades 09:00 to 17:00 South African time on weekdays
const jseOpen = () => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    return !['Sat', 'Sun'].includes(get('weekday')) && minutes >= 9 * 60 && minutes <= 17 * 60 + 5;
};

const fmt = (v?: number | null, digits = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const compact = (v?: number | null) => (v == null ? '—' : Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v));

type Props = {
    yahooSymbol: string;
    label: string;
    currency?: string;
    initialRange?: ChartRange;
    initialData?: PricePoint[];
    height?: number;
    // Compact hides the indicator panels and comparison, for smaller cards
    compact?: boolean;
    benchmark?: { yahooSymbol: string; label: string };
};

// A full price chart for JSE shares: TradingView's open-source Lightweight Charts library fed with
// Yahoo Finance bars (delayed up to 15 minutes, as on TradingView's free tier)
const ProChart = ({ yahooSymbol, label, currency = 'R', initialRange = '1Y', initialData, height = 520, compact: isCompact = false, benchmark }: Props) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [range, setRange] = useState<ChartRange>(initialRange);
    const [points, setPoints] = useState<PricePoint[]>(initialData ?? []);
    const [comparePoints, setComparePoints] = useState<PricePoint[]>([]);
    const [loading, setLoading] = useState(!initialData?.length);
    const [chartType, setChartType] = useState<ChartType>('candles');
    const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(['volume', 'ma50']));
    const [panes, setPanes] = useState<Set<Pane>>(new Set());
    const [logScale, setLogScale] = useState(false);
    const [compare, setCompare] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(initialData?.length ? new Date() : null);
    const skipFirstFetch = useRef(!!initialData?.length);
    const intraday = range === '1D' || range === '5D' || range === '1M';

    const load = useCallback(async (r: ChartRange, fresh = false) => {
        const result = await getChartSeries(yahooSymbol, r, fresh);
        setPoints(result.points);
        setUpdatedAt(new Date());
        setLoading(false);
    }, [yahooSymbol]);

    useEffect(() => {
        if (skipFirstFetch.current) {
            skipFirstFetch.current = false;
            return;
        }
        setLoading(true);
        load(range).catch(() => setLoading(false));
    }, [range, load]);

    // Benchmark bars for the comparison line
    useEffect(() => {
        if (!compare || !benchmark) return;
        getChartSeries(benchmark.yahooSymbol, range).then((r) => setComparePoints(r.points)).catch(() => setComparePoints([]));
    }, [compare, benchmark, range]);

    // Short ranges refresh every minute while the JSE is trading
    useEffect(() => {
        if (range !== '1D' && range !== '5D') return;
        const timer = setInterval(() => { if (jseOpen()) load(range, true).catch(() => null); }, 60_000);
        return () => clearInterval(timer);
    }, [range, load]);

    const closes = useMemo(() => points.map((p) => p.close), [points]);
    const studies = useMemo(() => ({
        ma20: sma(closes, 20), ma50: sma(closes, 50), ma200: sma(closes, 200),
        bollinger: bollinger(closes), rsi: rsi(closes), macd: macd(closes),
    }), [closes]);

    // Escape leaves full screen
    useEffect(() => {
        if (!fullscreen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fullscreen]);

    const chartHeight = fullscreen ? Math.max(400, (typeof window !== 'undefined' ? window.innerHeight : 800) - 150) : height;

    useEffect(() => {
        const container = containerRef.current;
        if (!container || points.length === 0) return;
        const extraPanes = isCompact ? [] : PANES.filter((p) => panes.has(p.key)).map((p) => p.key);
        const chart: IChartApi = createChart(container, {
            height: chartHeight,
            autoSize: true,
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: C.text, fontFamily: 'inherit', attributionLogo: false, panes: { separatorColor: C.border } },
            grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
            rightPriceScale: { borderColor: C.border },
            // A low minimum bar spacing lets decades of daily bars fit the width, then zoom in to the daily detail
            timeScale: { borderColor: C.border, timeVisible: intraday, secondsVisible: false, rightOffset: 4, minBarSpacing: 0.01 },
            crosshair: { mode: CrosshairMode.Normal },
        });

        const time = (p: PricePoint) => p.time as UTCTimestamp;
        const line = (data: (number | null)[], color: string, pane = 0, width: 1 | 2 = 1) => {
            const s = chart.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, pane);
            s.setData(points.flatMap((p, i) => (data[i] != null ? [{ time: time(p), value: data[i]! }] : [])));
            return s;
        };

        let main: ISeriesApi<SeriesType>;
        if (chartType === 'candles' || chartType === 'bars') {
            main = chart.addSeries(chartType === 'candles' ? CandlestickSeries : BarSeries, chartType === 'candles'
                ? { upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down }
                : { upColor: C.up, downColor: C.down });
            main.setData(points.map((p) => ({ time: time(p), open: p.open, high: p.high, low: p.low, close: p.close })));
        } else {
            const rising = points[points.length - 1].close >= points[0].close;
            main = chartType === 'area'
                ? chart.addSeries(AreaSeries, { lineColor: rising ? C.up : C.down, topColor: rising ? 'rgba(15,237,190,0.25)' : 'rgba(255,73,91,0.25)', bottomColor: 'rgba(5,5,5,0)', lineWidth: 2 })
                : chart.addSeries(LineSeries, { color: rising ? C.up : C.down, lineWidth: 2 });
            main.setData(points.map((p) => ({ time: time(p), value: p.close })));
        }

        if (overlays.has('volume')) {
            const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', priceLineVisible: false, lastValueVisible: false });
            chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            volume.setData(points.map((p) => ({ time: time(p), value: p.volume, color: p.close >= p.open ? 'rgba(15,237,190,0.30)' : 'rgba(255,73,91,0.30)' })));
        }
        if (overlays.has('ma20')) line(studies.ma20, C.amber);
        if (overlays.has('ma50')) line(studies.ma50, C.accent);
        if (overlays.has('ma200')) line(studies.ma200, C.pink);
        if (overlays.has('bollinger')) {
            line(studies.bollinger.map((b) => b.upper), C.navy);
            line(studies.bollinger.map((b) => b.middle), 'rgba(33,93,139,0.6)');
            line(studies.bollinger.map((b) => b.lower), C.navy);
        }
        if (compare && benchmark && comparePoints.length) {
            const bench = chart.addSeries(LineSeries, { color: C.amber, lineWidth: 2, priceLineVisible: false, title: benchmark.label });
            // Only bars both series share, so both lines start from the same day
            const own = new Set(points.map((p) => p.time));
            bench.setData(comparePoints.filter((p) => own.has(p.time)).map((p) => ({ time: time(p), value: p.close })));
        }

        extraPanes.forEach((pane, i) => {
            const index = i + 1;
            if (pane === 'rsi') {
                const s = line(studies.rsi, C.accent, index, 2);
                // Always the full 0-100 scale, so the 30 and 70 lines stay in view
                s.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
                s.createPriceLine({ price: 70, color: C.down, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '70' });
                s.createPriceLine({ price: 30, color: C.up, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '30' });
            } else {
                const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, index);
                hist.setData(points.flatMap((p, k) => {
                    const h = studies.macd[k].histogram;
                    return h != null ? [{ time: time(p), value: h, color: h >= 0 ? 'rgba(15,237,190,0.5)' : 'rgba(255,73,91,0.5)' }] : [];
                }));
                line(studies.macd.map((m) => m.macd), C.accent, index, 2);
                line(studies.macd.map((m) => m.signal), C.amber, index);
            }
            chart.panes()[index]?.setHeight(120);
        });

        // Log and percentage scales apply to the price pane only; RSI and MACD keep their own values
        chart.panes()[0]?.priceScale('right').applyOptions({ mode: compare && benchmark ? PriceScaleMode.Percentage : logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal });

        const indexByTime = new Map(points.map((p, i) => [p.time, i]));
        chart.subscribeCrosshairMove((param) => {
            setHoverIndex(param.time != null ? indexByTime.get(param.time as number) ?? null : null);
        });
        chart.timeScale().fitContent();
        return () => chart.remove();
    }, [points, comparePoints, chartType, overlays, panes, logScale, compare, benchmark, intraday, chartHeight, isCompact, studies]);

    const toggle = <T,>(set: Set<T>, value: T, apply: (s: Set<T>) => void) => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        apply(next);
    };

    const shown = hoverIndex != null ? points[hoverIndex] : points[points.length - 1];
    const shownIndex = hoverIndex ?? points.length - 1;
    const prev = shownIndex > 0 ? points[shownIndex - 1] : undefined;
    const change = shown && prev ? shown.close / prev.close - 1 : undefined;
    const when = shown ? new Date(shown.time * 1000).toLocaleString('en-ZA', intraday
        ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }
        : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    const rangeChange = points.length > 1 ? points[points.length - 1].close / points[0].close - 1 : undefined;

    return (
        <div className={cn('flex flex-col gap-3', fullscreen && 'fixed inset-0 z-50 overflow-auto bg-gray-900 p-4')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="pill-tabs flex-wrap" role="group" aria-label="Chart range">
                    {RANGES.map((r) => (
                        <button key={r} type="button" className="pill-tab" data-active={r === range} aria-pressed={r === range} onClick={() => setRange(r)}>{r}</button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Chart style" value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)}
                        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-gray-100">
                        <option value="candles">Candles</option>
                        <option value="bars">OHLC bars</option>
                        <option value="line">Line</option>
                        <option value="area">Area</option>
                    </select>
                    <button type="button" onClick={() => setLogScale((v) => !v)} data-active={logScale} className="pill-tab border border-gray-600 text-xs" disabled={compare}>Log</button>
                    <button type="button" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => setFullscreen((v) => !v)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-gray-600 text-gray-100 hover:bg-gray-700">
                        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {OVERLAYS.map((o) => (
                    <button key={o.key} type="button" onClick={() => toggle(overlays, o.key, setOverlays)} data-active={overlays.has(o.key)}
                        className="pill-tab flex items-center gap-1.5 border border-gray-700">
                        <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />{o.label}
                    </button>
                ))}
                {!isCompact && PANES.map((p) => (
                    <button key={p.key} type="button" onClick={() => toggle(panes, p.key, setPanes)} data-active={panes.has(p.key)} className="pill-tab border border-gray-700">{p.label}</button>
                ))}
                {!isCompact && benchmark && (
                    <button type="button" onClick={() => setCompare((v) => !v)} data-active={compare} className="pill-tab border border-gray-700">Compare with {benchmark.label}</button>
                )}
            </div>

            {/* Values for the bar under the pointer (or the latest bar) */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs tabular-nums">
                <span className="font-semibold text-gray-100">{label}</span>
                <span className="text-gray-500">{when}</span>
                {shown && (
                    <>
                        <span className="text-gray-400">O <span className="text-gray-100">{fmt(shown.open)}</span></span>
                        <span className="text-gray-400">H <span className="text-gray-100">{fmt(shown.high)}</span></span>
                        <span className="text-gray-400">L <span className="text-gray-100">{fmt(shown.low)}</span></span>
                        <span className="text-gray-400">C <span className="text-gray-100">{fmt(shown.close)}</span></span>
                        <span className={(change ?? 0) >= 0 ? 'text-teal-400' : 'text-red-500'}>{change != null ? `${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%` : ''}</span>
                        <span className="text-gray-400">Vol <span className="text-gray-100">{compact(shown.volume)}</span></span>
                        {overlays.has('ma50') && <span style={{ color: C.accent }}>MA50 {fmt(studies.ma50[shownIndex])}</span>}
                        {overlays.has('ma200') && <span style={{ color: C.pink }}>MA200 {fmt(studies.ma200[shownIndex])}</span>}
                        {panes.has('rsi') && <span style={{ color: C.accent }}>RSI {fmt(studies.rsi[shownIndex], 1)}</span>}
                    </>
                )}
            </div>

            <div className={cn('relative transition-opacity', loading && 'opacity-50')}>
                {points.length === 0 && !loading ? (
                    <div className="flex items-center justify-center text-sm text-gray-500" style={{ height: chartHeight }}>No price data for this range</div>
                ) : (
                    <div ref={containerRef} style={{ height: chartHeight }} />
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                    {rangeChange != null && <>{range === '1D' ? 'Since the open' : range === 'MAX' ? 'Over all available history' : `Over ${range}`}: <span className={rangeChange >= 0 ? 'text-teal-400' : 'text-red-500'}>{rangeChange >= 0 ? '+' : ''}{(rangeChange * 100).toFixed(1)}%</span> · </>}
                    {points.length.toLocaleString('en-US')} bars{points.length ? ` from ${new Date(points[0].time * 1000).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}
                </span>
                <span>
                    Prices in {currency} · delayed up to 15 minutes · source Yahoo Finance
                    {updatedAt && ` · updated ${updatedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`}
                    {(range === '1D' || range === '5D') && jseOpen() && <span className="ml-1 text-teal-400">· live</span>}
                </span>
            </div>
        </div>
    );
};

export default ProChart;
