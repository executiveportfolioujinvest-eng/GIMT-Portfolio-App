import {Suspense} from "react";
import LocalMarketOverview from "@/components/local/LocalMarketOverview";
import LocalHeatmap from "@/components/local/LocalHeatmap";
import LocalQuotesTable from "@/components/local/LocalQuotesTable";
import NewsList from "@/components/dashboard/NewsList";
import DashboardSections, {DashboardSectionsSkeleton} from "@/components/dashboard/DashboardSections";
import {getJseQuotes, getPriceHistory} from "@/lib/actions/yahoo.actions";
import {getMarketNews} from "@/lib/actions/news.actions";
import {LOCAL_OVERVIEW_TABS, LOCAL_STOCKS} from "@/lib/markets";

// LIMT dashboard: the same layout as the global dashboard, built on JSE data
const LocalDashboardPage = async () => {
    // The overview panel opens on the first stock of its first sector tab
    const firstStock = LOCAL_STOCKS.find((s) => LOCAL_OVERVIEW_TABS[0].sectors.includes(s.sector)) ?? LOCAL_STOCKS[0];
    const [quotes, history, stories] = await Promise.all([
        getJseQuotes(),
        getPriceHistory(`${firstStock.symbol}.JO`, '1Y'),
        getMarketNews('local', 'local', 12),
    ]);

    return (
        <div className="w-full">
            <div className="flex min-h-screen home-wrapper">
                <section className="grid w-full gap-8 home-section">
                    <div className="md:col-span-1 xl:col-span-1">
                        <h3 className="font-semibold text-2xl text-gray-100 mb-5">Market Overview</h3>
                        <LocalMarketOverview quotes={quotes} initialHistory={history} />
                    </div>
                    <div className="md-col-span xl:col-span-2">
                        <h3 className="font-semibold text-2xl text-gray-100 mb-5">Market Cap</h3>
                        <LocalHeatmap quotes={quotes} />
                    </div>
                </section>
                <section className="grid w-full gap-8 home-section">
                    <div className="h-full md:col-span-1 xl:col-span-1">
                        <div className="local-widget h-[600px] overflow-y-auto px-4 scrollbar-hide-default">
                            <h3 className="sticky top-0 z-10 bg-gray-800 py-4 text-2xl font-semibold text-gray-100">Top Stories</h3>
                            <NewsList articles={stories} />
                        </div>
                    </div>
                    <div className="h-full md:col-span-1 xl:col-span-2">
                        <LocalQuotesTable quotes={quotes} />
                    </div>
                </section>
                <Suspense fallback={<DashboardSectionsSkeleton />}>
                    <DashboardSections market="local" />
                </Suspense>
            </div>
        </div>
    );
};

export default LocalDashboardPage;
