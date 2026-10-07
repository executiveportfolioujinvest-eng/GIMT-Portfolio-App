import {Star} from "lucide-react";
import SearchCommand from "@/components/SearchCommand";
import WatchlistTable from "@/components/WatchlistTable";
import AlertsList from "@/components/AlertsList";
import WatchlistNews from "@/components/WatchlistNews";
import {getWatchlistWithData} from "@/lib/actions/watchlist.actions";
import {getUserAlerts} from "@/lib/actions/alert.actions";
import {searchStocks} from "@/lib/actions/finnhub.actions";
import {getNewsForStocks} from "@/lib/actions/news.actions";
import type {MarketKey} from "@/lib/markets";

const WatchlistPage = async ({ market }: { market: MarketKey }) => {
    const [watchlist, alerts, initialStocks] = await Promise.all([
        getWatchlistWithData(market),
        getUserAlerts(market),
        searchStocks(undefined, market),
    ]);
    const news = await getNewsForStocks(market, watchlist.map((s) => ({ symbol: s.symbol, company: s.company })), 8);

    if (watchlist.length === 0) {
        return (
            <section className="flex watchlist-empty-container">
                <div className="watchlist-empty">
                    <Star className="watchlist-star" />
                    <h2 className="empty-title">Your watchlist is empty</h2>
                    <p className="empty-description">
                        Start building your watchlist by searching for stocks and clicking the star icon to add them.
                    </p>
                </div>
                <SearchCommand renderAs="button" label="Add Stock" market={market} initialStocks={initialStocks} />
            </section>
        );
    }

    return (
        <div className="flex flex-col gap-10">
            <div className="watchlist-container">
                <section className="watchlist">
                    <div className="flex items-center justify-between">
                        <h2 className="watchlist-title">Watchlist</h2>
                        <SearchCommand renderAs="button" label="Add Stock" market={market} initialStocks={initialStocks} />
                    </div>
                    <WatchlistTable watchlist={watchlist} market={market} />
                </section>

                <section className="watchlist-alerts flex">
                    <AlertsList
                        market={market}
                        alertData={alerts}
                        watchlist={watchlist.map((s) => ({ symbol: s.symbol, company: s.company, currentPrice: s.currentPrice }))}
                    />
                </section>
            </div>

            <section className="flex flex-col gap-6">
                <h2 className="watchlist-title">News</h2>
                <WatchlistNews news={news} />
            </section>
        </div>
    );
};

export default WatchlistPage;
