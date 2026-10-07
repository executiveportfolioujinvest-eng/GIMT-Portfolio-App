import Link from "next/link";
import WatchlistButton from "@/components/WatchlistButton";
import SearchCommand from "@/components/SearchCommand";
import StockLogo from "@/components/StockLogo";
import {marketHref, type MarketKey} from "@/lib/markets";
import {cn, formatChangePercent, formatChangeValue, getChangeColorClass} from "@/lib/utils";

type WatchlistCardsProps = {
    market: MarketKey;
    watchlist: StockWithData[];
    initialStocks: StockWithWatchlistStatus[];
};

// "Your Watchlist" cards on the dashboard
const WatchlistCards = ({ market, watchlist, initialStocks }: WatchlistCardsProps) => {
    if (watchlist.length === 0) {
        return (
            <div className="dash-panel flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
                <p className="empty-title">Your watchlist is empty</p>
                <p className="empty-description mb-0">Star stocks from search to follow them here.</p>
                <SearchCommand renderAs="button" label="Add Stock" market={market} initialStocks={initialStocks} />
            </div>
        );
    }

    return (
        <div className="dash-panel grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {watchlist.slice(0, 6).map((stock) => (
                <div key={stock.symbol} className="watch-card">
                    <Link
                        href={marketHref(market, `/stocks/${encodeURIComponent(stock.symbol)}`)}
                        className="absolute inset-0 rounded-lg"
                        aria-label={`Open ${stock.company}`}
                    />
                    <div className="flex items-start justify-between">
                        <StockLogo logo={stock.logo} symbol={stock.symbol} company={stock.company} size={44} />
                        <div className="relative z-10">
                            <WatchlistButton type="icon" market={market} symbol={stock.symbol} company={stock.company} isInWatchlist />
                        </div>
                    </div>
                    <p className="mt-4 truncate text-sm text-gray-400">{stock.company}</p>
                    <p className="mt-2 text-lg font-semibold text-gray-100">{stock.priceFormatted}</p>
                    <p className={cn("mt-1 text-sm font-medium", getChangeColorClass(stock.changePercent))}>
                        {stock.change != null ? `${formatChangeValue(stock.change)} (${formatChangePercent(stock.changePercent)})` : '—'}
                    </p>
                </div>
            ))}
        </div>
    );
};

export default WatchlistCards;
