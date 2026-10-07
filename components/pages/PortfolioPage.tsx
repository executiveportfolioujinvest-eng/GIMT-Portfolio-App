import Link from "next/link";
import HoldingsManager from "@/components/portfolio/HoldingsManager";
import ProposalsPanel from "@/components/portfolio/ProposalsPanel";
import WatchlistNews from "@/components/WatchlistNews";
import MarketSwitcher from "@/components/MarketSwitcher";
import {getTeamPortfolio} from "@/lib/actions/portfolio.actions";
import {getNewsForStocks} from "@/lib/actions/news.actions";
import {getSessionUser} from "@/lib/better-auth/session";
import {marketHref, MARKETS, roleLabel, type MarketKey} from "@/lib/markets";
import {cn, formatChangePercent, formatPrice, getChangeColorClass} from "@/lib/utils";

const SummaryCard = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) => (
    <div className="dash-panel">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold text-gray-100", tone != null && getChangeColorClass(tone))}>{value}</p>
        {sub && <p className={cn("mt-1 text-sm", tone != null ? getChangeColorClass(tone) : 'text-gray-500')}>{sub}</p>}
    </div>
);

// A department's shared team portfolio with its approval queue and sign-off history
const PortfolioPage = async ({ market }: { market: MarketKey }) => {
    const config = MARKETS[market];
    const [user, view] = await Promise.all([getSessionUser(), getTeamPortfolio(market)]);

    if (!view.allowed || !view.authority) {
        return (
            <div className="dash-panel mx-auto max-w-xl py-12 text-center">
                <p className="empty-title">This portfolio belongs to the {config.teamName}</p>
                <p className="empty-description mx-auto">Only its members and the executive portfolio managers can view it.</p>
                <Link href={marketHref(user?.department ?? 'global', '/portfolio')} className="search-btn mx-auto">Go to your team portfolio</Link>
            </div>
        );
    }

    const { holdings, summary, authority } = view;
    const news = await getNewsForStocks(market, holdings.map((h) => ({ symbol: h.symbol, company: h.company })), 8);
    const money = (v: number) => formatPrice(v, summary.currency);

    return (
        <div className="flex flex-col gap-10">
            <div>
                <MarketSwitcher market={market} path="/portfolio" />
                <h1 className="text-3xl font-bold text-gray-100">Team Portfolio</h1>
                <p className="mt-1 text-gray-500">
                    {config.teamName} ({config.team}) &bull; {config.exchange} holdings in {config.currency}
                </p>
                <p className="mt-3 text-sm text-gray-400">
                    {authority === 'observer'
                        ? 'You are viewing another department’s portfolio as an executive portfolio manager (view only).'
                        : `Signed in as ${roleLabel(user?.teamRole)}. ${
                            authority === 'executive'
                                ? 'Your changes apply immediately, and you sign everyone else’s.'
                                : authority === 'deputy'
                                    ? 'You approve requests the executive delegates to you and can co-authorise new ones; your own changes need the executive’s signature.'
                                    : 'Your changes are sent to the executive portfolio manager for sign-off.'
                        }`}
                </p>
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

            <HoldingsManager market={market} authority={authority} holdings={holdings} />

            <ProposalsPanel pending={view.pending} history={view.history} />

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
