import SectionHeader from "@/components/dashboard/SectionHeader";
import MarketSummary from "@/components/dashboard/MarketSummary";
import WatchlistCards from "@/components/dashboard/WatchlistCards";
import TopStocksTable from "@/components/dashboard/TopStocksTable";
import FinancialNews from "@/components/dashboard/FinancialNews";
import SearchCommand from "@/components/SearchCommand";
import {getPriceHistory, getYahooQuotes} from "@/lib/actions/yahoo.actions";
import {getWatchlistWithData} from "@/lib/actions/watchlist.actions";
import {getTopStocks} from "@/lib/actions/market.actions";
import {getMarketNews} from "@/lib/actions/news.actions";
import {searchStocks} from "@/lib/actions/finnhub.actions";
import {getDashboardConfig} from "@/lib/dashboard-config";
import {marketHref, type MarketKey} from "@/lib/markets";

// Market Summary, Your Watchlist, Today's Top Stocks and Today's Financial News (Figma dashboard design).
// Sections the administrator hid are skipped, and their data isn't fetched.
const DashboardSections = async ({ market }: { market: MarketKey }) => {
    const { hiddenSections, summaryTabs } = await getDashboardConfig(market);
    const show = (key: string) => !hiddenSections.includes(key);
    const firstTab = summaryTabs[0];

    const [history, quotes, watchlist, topStocks, topNews, localNews, worldNews, initialStocks] = await Promise.all([
        show('summary') ? getPriceHistory(firstTab.symbols[0].symbol, '1D') : null,
        show('summary') ? getYahooQuotes(firstTab.symbols.map((s) => s.symbol)) : [],
        show('watchlist') ? getWatchlistWithData(market) : [],
        show('top-stocks') ? getTopStocks(market) : [],
        show('news') ? getMarketNews('top', market) : [],
        show('news') ? getMarketNews('local', market) : [],
        show('news') ? getMarketNews('world', market) : [],
        show('watchlist') || show('top-stocks') ? searchStocks(undefined, market) : [],
    ]);

    if (!['summary', 'watchlist', 'top-stocks', 'news'].some(show)) return null;

    return (
        <div className="grid w-full grid-cols-1 gap-x-8 gap-y-10 xl:grid-cols-2">
            {show('summary') && history && (
                <div className="min-w-0">
                    <SectionHeader title="Market Summary" />
                    <MarketSummary market={market} tabs={summaryTabs} initialHistory={history} initialQuotes={quotes} />
                </div>
            )}

            {show('watchlist') && (
                <div className="min-w-0">
                    <SectionHeader title="Your Watchlist" href={marketHref(market, '/watchlist')} />
                    <WatchlistCards market={market} watchlist={watchlist} initialStocks={initialStocks} />
                </div>
            )}

            {show('top-stocks') && (
                <div className="min-w-0">
                    <SectionHeader
                        title="Today's Top Stocks"
                        action={<SearchCommand renderAs="text" label="View all" className="dash-view-all" market={market} initialStocks={initialStocks} />}
                    />
                    <TopStocksTable market={market} stocks={topStocks} />
                </div>
            )}

            {show('news') && (
                <div className="min-w-0">
                    <SectionHeader title="Today's Financial News" href={marketHref(market, '/news')} />
                    <FinancialNews news={{ top: topNews, local: localNews, world: worldNews }} />
                </div>
            )}
        </div>
    );
};

export const DashboardSectionsSkeleton = () => (
    <div className="grid w-full grid-cols-1 gap-x-8 gap-y-10 xl:grid-cols-2" aria-busy="true" aria-label="Loading dashboard">
        {["Market Summary", "Your Watchlist", "Today's Top Stocks", "Today's Financial News"].map((title) => (
            <div key={title}>
                <SectionHeader title={title} />
                <div className="dash-panel h-[420px] animate-pulse" />
            </div>
        ))}
    </div>
);

export default DashboardSections;
