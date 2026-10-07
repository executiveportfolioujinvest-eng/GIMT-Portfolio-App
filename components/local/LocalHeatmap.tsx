import Link from "next/link";
import {LOCAL_STOCKS, marketHref} from "@/lib/markets";
import {formatChangePercent} from "@/lib/utils";

// Tile colour scales with the day's move, like TradingView's heatmap (±3% is full strength)
const tileColor = (changePercent?: number) => {
    if (changePercent == null) return 'rgb(48, 51, 58)';
    const strength = Math.min(Math.abs(changePercent) / 3, 1);
    const alpha = 0.25 + strength * 0.65;
    return changePercent >= 0 ? `rgba(8, 153, 129, ${alpha})` : `rgba(242, 54, 69, ${alpha})`;
};

// JSE stocks grouped by sector and coloured by today's change
const LocalHeatmap = ({ quotes }: { quotes: Record<string, MarketQuote | null> }) => {
    const sectors = [...new Set(LOCAL_STOCKS.map((s) => s.sector))];

    return (
        <div className="local-widget grid h-[600px] auto-rows-fr grid-cols-2 gap-1 overflow-y-auto p-1 scrollbar-hide-default md:grid-cols-3">
            {sectors.map((sector) => (
                <div key={sector} className="flex min-h-[150px] flex-col">
                    <p className="px-1 py-1 text-xs text-gray-400">{sector} &rsaquo;</p>
                    <div className="grid flex-1 grid-cols-2 gap-1">
                        {LOCAL_STOCKS.filter((s) => s.sector === sector).map((stock) => {
                            const change = quotes[stock.symbol]?.changePercent;
                            return (
                                <Link
                                    key={stock.symbol}
                                    href={marketHref('local', `/stocks/${stock.symbol}`)}
                                    title={stock.name}
                                    className="flex min-h-[64px] flex-col items-center justify-center rounded-sm text-center text-gray-100 transition-[filter] hover:brightness-125"
                                    style={{ backgroundColor: tileColor(change) }}
                                >
                                    <span className="text-sm font-semibold">{stock.symbol}</span>
                                    <span className="text-xs">{formatChangePercent(change) || '0.00%'}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LocalHeatmap;
