import Link from "next/link";
import StockTabs from "@/components/stock/StockTabs";
import StockChartPanel from "@/components/stock/StockChartPanel";
import CreateAlertButton from "@/components/stock/CreateAlertButton";
import WatchlistButton from "@/components/WatchlistButton";
import StockLogo from "@/components/StockLogo";
import NewsList from "@/components/dashboard/NewsList";
import {getStockOverview} from "@/lib/actions/market.actions";
import {getStockNews} from "@/lib/actions/news.actions";
import {getPriceHistory} from "@/lib/actions/yahoo.actions";
import {isStockInWatchlist} from "@/lib/actions/watchlist.actions";
import {marketHref, type MarketKey} from "@/lib/markets";
import {
    cn,
    formatChangePercent,
    formatChangeValue,
    formatMarketCapValue,
    formatPrice,
    getChangeColorClass,
} from "@/lib/utils";

const RATING_STYLES: Record<string, string> = {
    'Strong Buy': 'bg-green-500/15 text-green-400',
    Buy: 'bg-green-500/15 text-green-400',
    Positive: 'bg-green-500/15 text-green-400',
    Hold: 'bg-yellow-400/15 text-yellow-400',
    Neutral: 'bg-yellow-400/15 text-yellow-400',
    Sell: 'bg-red-500/15 text-red-500',
    'Strong Sell': 'bg-red-500/15 text-red-500',
    Negative: 'bg-red-500/15 text-red-500',
};

const InfoRow = ({ label, value, dot, valueClassName }: { label: string; value: React.ReactNode; dot?: string; valueClassName?: string }) => (
    <li className="flex items-center justify-between gap-4 py-2">
        <span className="flex items-center gap-3 text-gray-400">
            {dot && <span className={cn("h-2.5 w-2.5 rounded-full", dot)} aria-hidden="true" />}
            {label}:
        </span>
        <span className={cn("text-right font-medium text-gray-100", valueClassName)}>{value}</span>
    </li>
);

const Badge = ({ value }: { value?: string }) =>
    value ? <span className={cn("rounded px-2 py-1 text-sm font-medium", RATING_STYLES[value] ?? 'bg-gray-600 text-gray-400')}>{value}</span> : <span className="text-gray-500">—</span>;

const StockOverviewPage = async ({ market, symbol: rawSymbol }: { market: MarketKey; symbol: string }) => {
    const symbol = decodeURIComponent(rawSymbol).toUpperCase();

    const [overview, inWatchlist, initialHistory] = await Promise.all([
        getStockOverview(market, symbol),
        isStockInWatchlist(symbol, market),
        market === 'local' ? getPriceHistory(`${symbol}.JO`, '1D') : Promise.resolve(undefined),
    ]);
    const news = await getStockNews(market, symbol, overview.company);

    const { quote, currency } = overview;
    const money = (value?: number) => (value != null ? formatPrice(value, currency) : '—');
    const descriptor = [overview.company, overview.symbol, overview.exchange, overview.industry].filter(Boolean);

    const header = (
        <div className="flex min-w-0 items-center gap-4">
            <StockLogo logo={overview.logo} symbol={overview.symbol} company={overview.company} size={64} />
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-400">
                    {descriptor.map((part, i) => (
                        <span key={`${part}-${i}`} className="flex items-center gap-2">
                            {i > 0 && <span className="text-gray-500" aria-hidden="true">&bull;</span>}
                            <span className={i === 0 ? 'text-gray-100' : undefined}>{part}</span>
                        </span>
                    ))}
                    <WatchlistButton key={symbol} type="icon" market={market} symbol={symbol} company={overview.company} isInWatchlist={inWatchlist} />
                </div>
                <p className="mt-1 flex flex-wrap items-baseline gap-3">
                    <span className="text-3xl font-bold text-gray-100">{money(quote?.price)}</span>
                    {quote?.change != null && (
                        <span className={cn("text-lg font-medium", getChangeColorClass(quote.changePercent))}>
                            {formatChangeValue(quote.change)} ({formatChangePercent(quote.changePercent)})
                        </span>
                    )}
                </p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col">
            <StockTabs market={market} symbol={symbol} active="overview" />

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-8">
                    <StockChartPanel market={market} symbol={symbol} header={header} initialHistory={initialHistory} />
                </div>

                <section className="dash-panel xl:col-span-4">
                    <div className="flex items-center justify-between gap-4 border-b border-gray-600 pb-5">
                        <h2 className="text-2xl text-gray-100">Overview</h2>
                        <CreateAlertButton market={market} symbol={symbol} company={overview.company} />
                    </div>

                    <h3 className="mt-5 text-xl font-bold text-gray-100">Today&apos;s Range</h3>
                    <ul className="mt-2 border-b border-gray-600 pb-4">
                        <InfoRow label="Open" value={money(quote?.open)} dot="bg-yellow-400" />
                        <InfoRow label="High" value={money(quote?.high)} dot="bg-teal-400" valueClassName="text-teal-400" />
                        <InfoRow label="Low" value={money(quote?.low)} dot="bg-red-500" valueClassName="text-red-500" />
                    </ul>

                    <h3 className="mt-5 text-xl font-bold text-gray-100">More Info</h3>
                    <ul className="mt-2">
                        <InfoRow label="Market Cap" value={overview.marketCap ? formatMarketCapValue(overview.marketCap, currency) : '—'} dot="bg-blue-700" />
                        <InfoRow label="P/E Ratio" value={overview.peRatio ? overview.peRatio.toFixed(1) : '—'} dot="bg-orange-500" />
                        <InfoRow label="EPS" value={money(overview.eps)} dot="bg-yellow-400" />
                        <InfoRow label="Previous Close" value={money(quote?.prevClose)} dot="bg-purple-500" />
                        <InfoRow label="Currency" value={currency} dot="bg-teal-400" />
                    </ul>
                </section>

                <div className="flex flex-col gap-8 xl:col-span-3">
                    <section className="dash-panel">
                        <h2 className="border-b border-gray-600 pb-4 text-xl font-bold text-gray-100">Analysis</h2>
                        <ul className="mt-3">
                            <InfoRow label="Rating" value={<Badge value={overview.rating} />} dot="bg-teal-400" />
                            <InfoRow label="Sentiment" value={<Badge value={overview.sentiment} />} dot="bg-gray-500" />
                        </ul>
                        {market === 'local' && (
                            <p className="mt-3 text-xs text-gray-500">Analyst ratings aren&apos;t available for JSE stocks on the free data plan.</p>
                        )}
                    </section>

                    <section className="dash-panel">
                        <h2 className="border-b border-gray-600 pb-4 text-xl font-bold text-gray-100">Company Info</h2>
                        <ul className="mt-3">
                            <InfoRow label="IPO" value={overview.info.ipo || '—'} />
                            <InfoRow label="Country" value={overview.info.country || '—'} />
                            <InfoRow label="Shares" value={overview.info.shares ? `${(overview.info.shares / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })}M` : '—'} />
                            <InfoRow label="Employees (FY)" value={overview.info.employees ? overview.info.employees.toLocaleString('en-US') : '—'} />
                            <InfoRow label="ISIN" value={overview.info.isin || '—'} />
                            <InfoRow
                                label="Website"
                                value={overview.info.website ? (
                                    <a href={overview.info.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-gray-100">
                                        {overview.info.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                    </a>
                                ) : '—'}
                            />
                        </ul>
                    </section>
                </div>

                <section className="dash-panel min-w-0 xl:col-span-5">
                    <h2 className="border-b border-gray-600 pb-4 text-xl font-bold text-gray-100">Latest News</h2>
                    <NewsList articles={news} variant="readmore" emptyText={`No recent news for ${overview.company}.`} />
                </section>

                <section className="dash-panel xl:col-span-4">
                    <h2 className="border-b border-gray-600 pb-4 text-xl font-bold text-gray-100">Related stocks</h2>
                    {overview.related.length === 0 ? (
                        <p className="py-8 text-center text-gray-500">No related stocks found.</p>
                    ) : (
                        <ul>
                            {overview.related.map((stock) => (
                                <li key={stock.symbol} className="border-b border-gray-600 last:border-b-0">
                                    <Link href={marketHref(market, `/stocks/${encodeURIComponent(stock.symbol)}`)} className="flex items-center gap-4 py-4 transition-colors hover:bg-gray-700/40">
                                        <StockLogo logo={stock.logo} symbol={stock.symbol} company={stock.company} size={52} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-gray-400">{stock.company}</p>
                                            <p className="text-lg font-bold text-gray-100">{stock.price ? formatPrice(stock.price, stock.currency) : '—'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-gray-100">{stock.symbol}</p>
                                            <p className={cn("font-medium", getChangeColorClass(stock.changePercent))}>{formatChangePercent(stock.changePercent) || '—'}</p>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default StockOverviewPage;
