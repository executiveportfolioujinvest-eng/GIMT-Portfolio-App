import TradingViewWidget from "@/components/TradingViewWidget";
import {MARKET_OVERVIEW_WIDGET_CONFIG, HEATMAP_WIDGET_CONFIG, TOP_STORIES_WIDGET_CONFIG, MARKET_DATA_WIDGET_CONFIG} from "@/lib/constants";
import {Suspense} from "react";
import DashboardSections, {DashboardSectionsSkeleton} from "@/components/dashboard/DashboardSections";
import MarketSwitcher from "@/components/MarketSwitcher";
import Announcements from "@/components/dashboard/Announcements";
import {getDashboardConfig} from "@/lib/dashboard-config";

// A section left alone in its row (the other was hidden by the administrator) takes the full width
const FULL_ROW = "md:col-span-2 xl:col-span-3";

const Home = async () => {
    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`
    const { hiddenSections } = await getDashboardConfig('global');
    const show = (key: string) => !hiddenSections.includes(key);

    return (
        <div className="w-full">
        <MarketSwitcher market="global" path="/" />
        <Announcements market="global" />
        <div className="flex min-h-screen home-wrapper">
           {(show('overview') || show('heatmap')) && (
           <section className="grid w-full gap-8 home-section">
               {show('overview') && (
               <div className={show('heatmap') ? "md:col-span-1 xl:col-span-1" : FULL_ROW}>
                   <TradingViewWidget
                       title="Market Overview"
                       scriptUrl={`${scriptUrl}market-overview.js`}
                       config={MARKET_OVERVIEW_WIDGET_CONFIG}
                       className="custom-chart"
                   />
               </div>
               )}
               {show('heatmap') && (
               <div className={show('overview') ? "md-col-span xl:col-span-2" : FULL_ROW}>
                   <TradingViewWidget
                       title="Market Cap"
                       scriptUrl={`${scriptUrl}stock-heatmap.js`}
                       config={HEATMAP_WIDGET_CONFIG}
                       className="custom-chart"
                   />
               </div>
               )}
           </section>
           )}
            {(show('stories') || show('quotes')) && (
            <section className="grid w-full gap-8 home-section">
                {show('stories') && (
                <div className={show('quotes') ? "h-full md:col-span-1 xl:col-span-1" : `h-full ${FULL_ROW}`}>
                    <TradingViewWidget
                        scriptUrl={`${scriptUrl}timeline.js`}
                        config={TOP_STORIES_WIDGET_CONFIG}
                    />
                </div>
                )}
                {show('quotes') && (
                <div className={show('stories') ? "h-full md:col-span-1 xl:col-span-2" : `h-full ${FULL_ROW}`}>
                    <TradingViewWidget
                        scriptUrl={`${scriptUrl}market-quotes.js`}
                        config={MARKET_DATA_WIDGET_CONFIG}
                    />
                </div>
                )}
            </section>
            )}
            <Suspense fallback={<DashboardSectionsSkeleton />}>
                <DashboardSections market="global" />
            </Suspense>
        </div>
        </div>
    )
}
export default Home
