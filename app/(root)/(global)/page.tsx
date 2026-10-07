import {Button} from "@/components/ui/button";
import TradingViewWidget from "@/components/TradingViewWidget";
import {MARKET_OVERVIEW_WIDGET_CONFIG, HEATMAP_WIDGET_CONFIG, TOP_STORIES_WIDGET_CONFIG, MARKET_DATA_WIDGET_CONFIG} from "@/lib/constants";
import TickerTape from "@/components/TickerTape";
import {Suspense} from "react";
import DashboardSections, {DashboardSectionsSkeleton} from "@/components/dashboard/DashboardSections";
import MarketSwitcher from "@/components/MarketSwitcher";


const Home = () => {
    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`
    return (
        <div className="w-full">
        <MarketSwitcher market="global" path="/" />
        <div className="flex min-h-screen home-wrapper">
           <section className="grid w-full gap-8 home-section">
               <div className="md:col-span-1 xl:col-span-1">
                   <TradingViewWidget
                       title="Market Overview"
                       scriptUrl={`${scriptUrl}market-overview.js`}
                       config={MARKET_OVERVIEW_WIDGET_CONFIG}
                       className="custom-chart"
                   />
               </div>
               <div className="md-col-span xl:col-span-2">
                   <TradingViewWidget
                       title="Market Cap"
                       scriptUrl={`${scriptUrl}stock-heatmap.js`}
                       config={HEATMAP_WIDGET_CONFIG}
                       className="custom-chart"
                   />
               </div>
           </section>
            <section className="grid w-full gap-8 home-section">
                <div className="h-full md:col-span-1 xl:col-span-1">
                    <TradingViewWidget
                        scriptUrl={`${scriptUrl}timeline.js`}
                        config={TOP_STORIES_WIDGET_CONFIG}
                    />
                </div>
                <div className="h-full md:col-span-1 xl:col-span-2">
                    <TradingViewWidget
                        scriptUrl={`${scriptUrl}market-quotes.js`}
                        config={MARKET_DATA_WIDGET_CONFIG}
                    />
                </div>
            </section>
            <Suspense fallback={<DashboardSectionsSkeleton />}>
                <DashboardSections market="global" />
            </Suspense>
        </div>
        </div>
    )
}
export default Home
