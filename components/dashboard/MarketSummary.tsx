'use client';

import {useEffect, useRef, useState, useTransition} from "react";
import PriceChart from "@/components/charts/PriceChart";
import {getPriceHistory, getYahooQuotes} from "@/lib/actions/yahoo.actions";
import {MARKETS, type MarketKey} from "@/lib/markets";
import {cn, formatChangePercent, formatPrice, getChangeColorClass} from "@/lib/utils";

const RANGES: HistoryRange[] = ['1D', '5D', '1M', '6M', '1Y', '5Y'];
const BADGE_COLORS = ['bg-red-500', 'bg-[#1E88E5]', 'bg-blue-500'];

// Index levels, yields and FX rates aren't currency amounts
const formatLevel = (quote: MarketQuote | null | undefined, symbol: string) => {
    if (!quote) return '—';
    if (symbol.startsWith('^') || symbol.includes('=')) {
        return quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return formatPrice(quote.price, quote.currency);
};

type MarketSummaryProps = {
    market: MarketKey;
    initialHistory: PriceHistory;
    initialQuotes: (MarketQuote | null)[];
};

const MarketSummary = ({ market, initialHistory, initialQuotes }: MarketSummaryProps) => {
    const tabs = MARKETS[market].summaryTabs;
    const [tabIndex, setTabIndex] = useState(0);
    const [symbolIndex, setSymbolIndex] = useState(0);
    const [range, setRange] = useState<HistoryRange>('1D');
    const [history, setHistory] = useState<PriceHistory>(initialHistory);
    const [quotes, setQuotes] = useState<(MarketQuote | null)[]>(initialQuotes);
    const [isLoading, startTransition] = useTransition();
    const isFirstRender = useRef(true);

    const symbols = tabs[tabIndex].symbols;
    const active = symbols[symbolIndex] ?? symbols[0];

    // The server renders the first tab; refetch whenever the selection changes
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        startTransition(async () => {
            setHistory(await getPriceHistory(active.symbol, range));
        });
    }, [active.symbol, range]);

    const selectTab = (index: number) => {
        setTabIndex(index);
        setSymbolIndex(0);
        setQuotes([]);
        startTransition(async () => {
            setQuotes(await getYahooQuotes(tabs[index].symbols.map((s) => s.symbol)));
        });
    };

    return (
        <section className="dash-panel flex flex-col gap-4">
            <div className="pill-tabs w-fit max-w-full overflow-x-auto scrollbar-hide" role="tablist" aria-label="Asset class">
                {tabs.map((tab, i) => (
                    <button
                        key={tab.label}
                        type="button"
                        role="tab"
                        aria-selected={i === tabIndex}
                        data-active={i === tabIndex}
                        className="pill-tab"
                        onClick={() => selectTab(i)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={cn("relative transition-opacity", isLoading && "opacity-50")}>
                <PriceChart
                    points={history.points}
                    height={250}
                    intraday={range === '1D' || range === '5D'}
                    positive={range === '1D' && history.quote?.changePercent != null ? history.quote.changePercent >= 0 : undefined}
                />
            </div>

            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Time range">
                {RANGES.map((r) => (
                    <button
                        key={r}
                        type="button"
                        data-active={r === range}
                        aria-pressed={r === range}
                        className="range-btn"
                        onClick={() => setRange(r)}
                    >
                        {r}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {symbols.map((s, i) => {
                    const quote = quotes[i];
                    return (
                        <button
                            key={s.symbol}
                            type="button"
                            data-active={i === symbolIndex}
                            className="summary-card"
                            onClick={() => setSymbolIndex(i)}
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm text-gray-400">{s.label}</span>
                                {s.badge && (
                                    <span className={cn("summary-badge", BADGE_COLORS[i % BADGE_COLORS.length])}>{s.badge}</span>
                                )}
                            </span>
                            <span className="mt-2 flex items-baseline gap-2">
                                <span className="text-lg font-bold text-gray-100">{formatLevel(quote, s.symbol)}</span>
                                <span className={cn("text-sm font-medium", getChangeColorClass(quote?.changePercent))}>
                                    {formatChangePercent(quote?.changePercent)}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

export default MarketSummary;
