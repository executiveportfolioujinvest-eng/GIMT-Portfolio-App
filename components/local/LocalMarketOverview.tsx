'use client';

import {useEffect, useMemo, useRef, useState, useTransition} from "react";
import PriceChart from "@/components/charts/PriceChart";
import StockLogo from "@/components/StockLogo";
import {getChartSeries} from "@/lib/actions/yahoo.actions";
import {LOCAL_OVERVIEW_TABS, type LocalStock} from "@/lib/markets";
import {cn, formatChangePercent, formatChangeValue, formatPrice, getChangeColorClass} from "@/lib/utils";

// Daily bars for the long ranges, back to 2000 for most JSE shares
const RANGES: ChartRange[] = ['1D', '1M', '1Y', '5Y', 'MAX'];
// JSE take on TradingView's Market Overview widget: sector tabs, a price chart and the sector's stocks
const LocalMarketOverview = ({ stocks: allStocks, quotes, initialHistory }: { stocks: LocalStock[]; quotes: Record<string, MarketQuote | null>; initialHistory: PriceHistory }) => {
    // Sector tabs with no stocks in the administrator's JSE list are left out
    const TABS = useMemo(() => LOCAL_OVERVIEW_TABS.filter((t) => allStocks.some((s) => t.sectors.includes(s.sector))), [allStocks]);
    const [tabIndex, setTabIndex] = useState(0);
    const stocks = useMemo(() => allStocks.filter((s) => TABS[tabIndex].sectors.includes(s.sector)), [allStocks, TABS, tabIndex]);
    const [selected, setSelected] = useState(stocks[0].symbol);
    const [range, setRange] = useState<ChartRange>('1Y');
    const [points, setPoints] = useState<PricePoint[]>(initialHistory.points);
    const [isLoading, startTransition] = useTransition();
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        startTransition(async () => {
            const history = await getChartSeries(`${selected}.JO`, range);
            setPoints(history.points);
        });
    }, [selected, range]);

    const selectTab = (index: number) => {
        setTabIndex(index);
        setSelected(allStocks.find((s) => TABS[index].sectors.includes(s.sector))!.symbol);
    };

    return (
        <div className="local-widget flex h-[600px] flex-col">
            <div className="flex flex-wrap gap-1 p-3" role="tablist" aria-label="Sector">
                {TABS.map((tab, i) => (
                    <button key={tab.label} type="button" role="tab" aria-selected={i === tabIndex} data-active={i === tabIndex} className="pill-tab" onClick={() => selectTab(i)}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={cn("px-2 transition-opacity", isLoading && "opacity-50")}>
                <PriceChart points={points} height={220} intraday={range === '1D' || range === '1M'} />
            </div>

            <div className="flex gap-1 px-3 py-2">
                {RANGES.map((r) => (
                    <button key={r} type="button" className="range-btn" data-active={r === range} aria-pressed={r === range} onClick={() => setRange(r)}>{r}</button>
                ))}
            </div>

            <ul className="flex-1 overflow-y-auto scrollbar-hide-default px-2 pb-2">
                {stocks.map((stock) => {
                    const quote = quotes[stock.symbol];
                    return (
                        <li key={stock.symbol}>
                            <button
                                type="button"
                                data-active={stock.symbol === selected}
                                onClick={() => setSelected(stock.symbol)}
                                className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-gray-700/60 data-[active=true]:bg-gray-700"
                            >
                                <StockLogo symbol={stock.symbol} size={32} />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium text-gray-100">{stock.symbol}</span>
                                    <span className="block truncate text-xs text-gray-500">{stock.name}</span>
                                </span>
                                <span className="text-right">
                                    <span className="block text-sm text-gray-100">{quote ? formatPrice(quote.price, 'ZAR') : '—'}</span>
                                    <span className={cn("block text-xs", getChangeColorClass(quote?.changePercent))}>
                                        {quote?.change != null ? `${formatChangeValue(quote.change)} ${formatChangePercent(quote.changePercent)}` : '—'}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default LocalMarketOverview;
