import Link from "next/link";
import FinancialNews from "@/components/dashboard/FinancialNews";
import NewsList from "@/components/dashboard/NewsList";
import WatchlistNews from "@/components/WatchlistNews";
import TradingViewWidget from "@/components/TradingViewWidget";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {getGoogleNews, getMarketNews, getNewsForStocks} from "@/lib/actions/news.actions";
import {getHoldingStocks} from "@/lib/actions/portfolio.actions";
import {getWatchlistWithData} from "@/lib/actions/watchlist.actions";
import {TOP_STORIES_WIDGET_CONFIG} from "@/lib/constants";
import {marketHref, MARKETS, type MarketKey} from "@/lib/markets";

// Every news source in the app in one place: Finnhub, Google News, TradingView,
// plus news for the user's portfolio holdings and watchlist
const NewsPage = async ({ market }: { market: MarketKey }) => {
    const other: MarketKey = market === 'global' ? 'local' : 'global';
    const config = MARKETS[market];

    const [top, home, world, holdings, watchlist, economy] = await Promise.all([
        getMarketNews('top', market, 15),
        market === 'local' ? getMarketNews('local', 'local', 15) : Promise.resolve([]),
        getMarketNews('world', market, 15),
        getHoldingStocks(market),
        getWatchlistWithData(market),
        market === 'local' ? getGoogleNews('"South African Reserve Bank" OR rand OR "South African economy" when:3d', 8) : Promise.resolve([]),
    ]);

    const [holdingsNews, watchlistNews] = await Promise.all([
        getNewsForStocks(market, holdings, 8),
        getNewsForStocks(market, watchlist.map((s) => ({ symbol: s.symbol, company: s.company })), 8),
    ]);

    // Local market lives on the LIMT route; global markets on the GMIT route
    const tabs = market === 'global'
        ? [
            { key: 'top' as const, label: 'Top stories' },
            { label: 'Local market', href: marketHref('local', '/news') },
            { key: 'world' as const, label: 'Global markets' },
        ]
        : [
            { key: 'top' as const, label: 'Top stories' },
            { key: 'local' as const, label: 'Local market' },
            { label: 'Global markets', href: marketHref('global', '/news') },
        ];

    return (
        <div className="flex flex-col gap-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-100">News</h1>
                    <p className="mt-1 text-gray-500">{config.teamName} ({config.team})</p>
                </div>
                <Link href={marketHref(other, '/news')} className="dash-view-all">
                    {MARKETS[other].teamName} news &rarr;
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                <div className="min-w-0 xl:col-span-2">
                    <FinancialNews news={{ top, local: home, world }} tabs={tabs} maxItems={15} className="max-h-[720px]" />
                </div>

                <div className="min-w-0">
                    {market === 'global' ? (
                        <>
                            <SectionHeader title="TradingView Headlines" />
                            <TradingViewWidget
                                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
                                config={TOP_STORIES_WIDGET_CONFIG}
                                height={660}
                            />
                        </>
                    ) : (
                        <>
                            <SectionHeader title="Economy & Rand" />
                            <div className="dash-panel max-h-[660px] overflow-y-auto scrollbar-hide-default">
                                <NewsList articles={economy} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <section>
                <SectionHeader
                    title="Portfolio Holdings"
                    action={<Link href={marketHref(market, '/portfolio')} className="dash-view-all">Manage holdings</Link>}
                />
                {holdings.length === 0 ? (
                    <div className="dash-panel py-10 text-center">
                        <p className="text-gray-400">Add your holdings to see news about the companies in your portfolio.</p>
                        <Link href={marketHref(market, '/portfolio')} className="search-btn mx-auto mt-4">Go to Portfolio</Link>
                    </div>
                ) : (
                    <WatchlistNews news={holdingsNews} />
                )}
            </section>

            <section>
                <SectionHeader title="Watchlist" href={marketHref(market, '/watchlist')} />
                {watchlist.length === 0 ? (
                    <div className="dash-panel py-10 text-center">
                        <p className="text-gray-400">Star stocks to follow news about your watchlist here.</p>
                    </div>
                ) : (
                    <WatchlistNews news={watchlistNews} />
                )}
            </section>
        </div>
    );
};

export default NewsPage;
