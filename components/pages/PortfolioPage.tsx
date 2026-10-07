import Link from "next/link";
import HoldingsManager from "@/components/portfolio/HoldingsManager";
import WatchlistNews from "@/components/WatchlistNews";
import {getPortfolio} from "@/lib/actions/portfolio.actions";
import {getNewsForStocks} from "@/lib/actions/news.actions";
import {marketHref, MARKETS, type MarketKey} from "@/lib/markets";
import {cn, formatChangePercent, formatPrice, getChangeColorClass} from "@/lib/utils";

const SummaryCard = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) => (
    <div className="dash-panel">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold text-gray-100", tone != null && getChangeColorClass(tone))}>{value}</p>
        {sub && <p className={cn("mt-1 text-sm", tone != null ? getChangeColorClass(tone) : 'text-gray-500')}>{sub}</p>}
    </div>
);

const PortfolioPage = async ({ market }: { market: MarketKey }) => {
    const config = MARKETS[market];
    const { holdings, summary } = await getPortfolio(market);
    const news = await getNewsForStocks(market, holdings.map((h) => ({ symbol: h.symbol, company: h.company })), 8);
    const money = (v: number) => formatPrice(v, summary.currency);

    return (
        <div className="flex flex-col gap-10">
            <div>
                <h1 className="text-3xl font-bold text-gray-100">Portfolio</h1>
                <p className="mt-1 text-gray-500">{config.teamName} ({config.team}) &bull; {config.exchange} holdings in {config.currency}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Total value" value={money(summary.totalValue)} sub={`${holdings.length} holding${holdings.length === 1 ? '' : 's'}`} />
                <SummaryCard label="Total cost" value={money(summary.totalCost)} />
                <SummaryCard
                    label="Total gain / loss"
                    value={money(summary.totalGain)}
                    sub={formatChangePercent(summary.totalGainPercent) || '0.00%'}
                    tone={summary.totalGain}
                />
                <SummaryCard label="Today's change" value={money(summary.dayChange)} tone={summary.dayChange} />
            </div>

            <HoldingsManager market={market} holdings={holdings} />

            {holdings.length > 0 && (
                <section className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="watchlist-title">Holdings News</h2>
                        <Link href={marketHref(market, '/news')} className="dash-view-all">All news</Link>
                    </div>
                    <WatchlistNews news={news} />
                </section>
            )}
        </div>
    );
};

export default PortfolioPage;
