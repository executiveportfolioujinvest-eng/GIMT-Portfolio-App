import {Suspense} from "react";
import LocalMarketOverview from "@/components/local/LocalMarketOverview";
import LocalHeatmap from "@/components/local/LocalHeatmap";
import LocalQuotesTable from "@/components/local/LocalQuotesTable";
import NewsList from "@/components/dashboard/NewsList";
import DashboardSections, {DashboardSectionsSkeleton} from "@/components/dashboard/DashboardSections";
import MarketSwitcher from "@/components/MarketSwitcher";
import Announcements from "@/components/dashboard/Announcements";
import {getJseQuotes, getPriceHistory} from "@/lib/actions/yahoo.actions";
import {getMarketNews} from "@/lib/actions/news.actions";
import {getDashboardConfig} from "@/lib/dashboard-config";
import {LOCAL_OVERVIEW_TABS} from "@/lib/markets";

// A section left alone in its row (the other was hidden by the administrator) takes the full width
const FULL_ROW = "md:col-span-2 xl:col-span-3";

// LMIT dashboard: the same layout as the global dashboard, built on JSE data
const LocalDashboardPage = async () => {
    const { hiddenSections, localStocks } = await getDashboardConfig('local');
    const show = (key: string) => !hiddenSections.includes(key);

    // The overview panel opens on the first stock of its first sector tab
    const firstTab = LOCAL_OVERVIEW_TABS.find((t) => localStocks.some((s) => t.sectors.includes(s.sector)));
    const firstStock = (firstTab && localStocks.find((s) => firstTab.sectors.includes(s.sector))) ?? localStocks[0];
    const needsQuotes = show('overview') || show('heatmap') || show('quotes');
    const [quotes, history, stories] = await Promise.all([
        needsQuotes ? getJseQuotes() : {},
        show('overview') ? getPriceHistory(`${firstStock.symbol}.JO`, '1Y') : null,
        show('stories') ? getMarketNews('local', 'local', 12) : [],
    ]);

    return (
        <div className="w-full">
            <MarketSwitcher market="local" path="/" />
            <Announcements market="local" />
            <div className="flex min-h-screen home-wrapper">
                {(show('overview') || show('heatmap')) && (
                <section className="grid w-full gap-8 home-section">
                    {show('overview') && history && (
                    <div className={show('heatmap') ? "md:col-span-1 xl:col-span-1" : FULL_ROW}>
                        <h3 className="font-semibold text-2xl text-gray-100 mb-5">Market Overview</h3>
                        <LocalMarketOverview stocks={localStocks} quotes={quotes} initialHistory={history} />
                    </div>
                    )}
                    {show('heatmap') && (
                    <div className={show('overview') ? "md-col-span xl:col-span-2" : FULL_ROW}>
                        <h3 className="font-semibold text-2xl text-gray-100 mb-5">Market Cap</h3>
                        <LocalHeatmap stocks={localStocks} quotes={quotes} />
                    </div>
                    )}
                </section>
                )}
                {(show('stories') || show('quotes')) && (
                <section className="grid w-full gap-8 home-section">
                    {show('stories') && (
                    <div className={show('quotes') ? "h-full md:col-span-1 xl:col-span-1" : `h-full ${FULL_ROW}`}>
                        <div className="local-widget h-[600px] overflow-y-auto px-4 scrollbar-hide-default">
                            <h3 className="sticky top-0 z-10 bg-gray-800 py-4 text-2xl font-semibold text-gray-100">Top Stories</h3>
                            <NewsList articles={stories} />
                        </div>
                    </div>
                    )}
                    {show('quotes') && (
                    <div className={show('stories') ? "h-full md:col-span-1 xl:col-span-2" : `h-full ${FULL_ROW}`}>
                        <LocalQuotesTable stocks={localStocks} quotes={quotes} />
                    </div>
                    )}
                </section>
                )}
                <Suspense fallback={<DashboardSectionsSkeleton />}>
                    <DashboardSections market="local" />
                </Suspense>
            </div>
        </div>
    );
};

export default LocalDashboardPage;
