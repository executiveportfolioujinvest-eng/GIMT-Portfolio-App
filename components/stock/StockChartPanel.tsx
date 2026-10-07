'use client';

import {useEffect, useRef, useState, useTransition} from "react";
import TradingViewWidget from "@/components/TradingViewWidget";
import PriceChart from "@/components/charts/PriceChart";
import {getPriceHistory} from "@/lib/actions/yahoo.actions";
import {STOCK_OVERVIEW_CHART_CONFIG} from "@/lib/constants";
import type {MarketKey} from "@/lib/markets";
import {cn} from "@/lib/utils";

const RANGES: HistoryRange[] = ['1D', '5D', '1M', '1Y'];

type StockChartPanelProps = {
    market: MarketKey;
    symbol: string;
    header: React.ReactNode;
    initialHistory?: PriceHistory;
};

// Price header + range tabs + candlestick chart for the stock overview page
const StockChartPanel = ({ market, symbol, header, initialHistory }: StockChartPanelProps) => {
    const [range, setRange] = useState<HistoryRange>('1D');
    const [points, setPoints] = useState<PricePoint[]>(initialHistory?.points ?? []);
    const [isLoading, startTransition] = useTransition();
    const isFirstRender = useRef(true);

    // JSE prices come from Yahoo Finance (TradingView embeds have no JSE data)
    useEffect(() => {
        if (market !== 'local') return;
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        startTransition(async () => {
            const history = await getPriceHistory(`${symbol}.JO`, range);
            setPoints(history.points);
        });
    }, [market, symbol, range]);

    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

    return (
        <section className="dash-panel flex h-full flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-600 pb-5">
                {header}
                <div className="pill-tabs" role="group" aria-label="Chart range">
                    {RANGES.map((r) => (
                        <button
                            key={r}
                            type="button"
                            className="pill-tab"
                            data-active={r === range}
                            aria-pressed={r === range}
                            onClick={() => setRange(r)}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div className={cn("mt-5 flex-1 transition-opacity", isLoading && "opacity-50")}>
                {market === 'global' ? (
                    <TradingViewWidget
                        key={`${symbol}-${range}`}
                        scriptUrl={`${scriptUrl}advanced-chart.js`}
                        config={STOCK_OVERVIEW_CHART_CONFIG(symbol, range)}
                        className="custom-chart"
                        height={440}
                    />
                ) : (
                    <PriceChart points={points} variant="candles" height={440} intraday={range === '1D' || range === '5D'} showVolume />
                )}
            </div>
        </section>
    );
};

export default StockChartPanel;
