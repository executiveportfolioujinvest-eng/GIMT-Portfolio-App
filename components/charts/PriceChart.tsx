'use client';

import {useEffect, useRef} from "react";
import {
    AreaSeries,
    CandlestickSeries,
    ColorType,
    createChart,
    CrosshairMode,
    HistogramSeries,
    type IChartApi,
    type UTCTimestamp,
} from "lightweight-charts";

type PriceChartProps = {
    points: PricePoint[];
    variant?: 'area' | 'candles';
    height?: number;
    intraday?: boolean;
    showVolume?: boolean;
    // Overrides the colour, e.g. so a 1D chart follows the day's change vs. previous close
    positive?: boolean;
    className?: string;
};

const COLORS = {
    up: '#0FEDBE',
    down: '#FF495B',
    text: '#9095A1',
    grid: 'rgba(48, 51, 58, 0.5)',
    border: '#30333A',
};

// Area or candlestick price chart drawn with TradingView's open-source Lightweight Charts
const PriceChart = ({ points, variant = 'area', height = 300, intraday = false, showVolume = false, positive, className }: PriceChartProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const chart = createChart(container, {
            height,
            autoSize: true,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: COLORS.text,
                fontFamily: 'inherit',
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: variant === 'candles' ? COLORS.grid : 'transparent' },
                horzLines: { color: COLORS.grid },
            },
            rightPriceScale: { borderColor: COLORS.border },
            timeScale: { borderColor: COLORS.border, timeVisible: intraday, secondsVisible: false },
            crosshair: { mode: CrosshairMode.Magnet },
            handleScroll: variant === 'candles',
            handleScale: variant === 'candles',
        });
        chartRef.current = chart;

        const data = points.map((p) => ({ ...p, time: p.time as UTCTimestamp }));

        if (variant === 'candles') {
            const candles = chart.addSeries(CandlestickSeries, {
                upColor: COLORS.up,
                downColor: COLORS.down,
                borderUpColor: COLORS.up,
                borderDownColor: COLORS.down,
                wickUpColor: COLORS.up,
                wickDownColor: COLORS.down,
            });
            candles.setData(data);
        } else {
            const rising = positive ?? (data.length < 2 || data[data.length - 1].close >= data[0].close);
            const line = rising ? COLORS.up : COLORS.down;
            const area = chart.addSeries(AreaSeries, {
                lineColor: line,
                topColor: rising ? 'rgba(15, 237, 190, 0.28)' : 'rgba(255, 73, 91, 0.28)',
                bottomColor: 'rgba(5, 5, 5, 0)',
                lineWidth: 2,
                priceLineVisible: false,
            });
            area.setData(data.map((p) => ({ time: p.time, value: p.close })));
        }

        if (showVolume) {
            const volume = chart.addSeries(HistogramSeries, {
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });
            chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            volume.setData(data.map((p) => ({
                time: p.time,
                value: p.volume,
                color: p.close >= p.open ? 'rgba(15, 237, 190, 0.35)' : 'rgba(255, 73, 91, 0.35)',
            })));
        }

        chart.timeScale().fitContent();

        return () => {
            chart.remove();
            chartRef.current = null;
        };
    }, [points, variant, height, intraday, showVolume, positive]);

    return (
        <div className={className}>
            {points.length === 0 ? (
                <div className="flex items-center justify-center text-sm text-gray-500" style={{ height }}>
                    No price data available
                </div>
            ) : (
                <div ref={containerRef} style={{ height }} />
            )}
        </div>
    );
}

export default PriceChart
