'use client';

import {useState} from "react";
import TradingViewWidget from "@/components/TradingViewWidget";
import ProChart from "@/components/charts/ProChart";
import {STOCK_OVERVIEW_CHART_CONFIG} from "@/lib/constants";
import type {MarketKey} from "@/lib/markets";

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
    const points = initialHistory?.points ?? [];

    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

    return (
        <section className="dash-panel flex h-full flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-600 pb-5">
                {header}
                {market === 'global' && <div className="pill-tabs" role="group" aria-label="Chart range">
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
                </div>}
            </div>

            <div className="mt-5 flex-1">
                {market === 'global' ? (
                    <TradingViewWidget
                        key={`${symbol}-${range}`}
                        scriptUrl={`${scriptUrl}advanced-chart.js`}
                        config={STOCK_OVERVIEW_CHART_CONFIG(symbol, range)}
                        className="custom-chart"
                        height={440}
                    />
                ) : (
                    <ProChart yahooSymbol={`${symbol}.JO`} label={symbol} initialRange="1D" initialData={points} height={420} compact />
                )}
            </div>
        </section>
    );
};

export default StockChartPanel;
