import Link from "next/link";
import {marketHref, type MarketKey} from "@/lib/markets";

// Overview (company snapshot) / Technical Analysis (full charting) / Valuation (fundamentals) on the stock pages
const StockTabs = ({ market, symbol, active }: { market: MarketKey; symbol: string; active: 'overview' | 'analysis' | 'valuation' }) => {
    const base = marketHref(market, `/stocks/${encodeURIComponent(symbol)}`);

    return (
        <nav className="pill-tabs mb-6 w-fit" aria-label="Stock views">
            <Link href={base} className="pill-tab" data-active={active === 'overview'} aria-current={active === 'overview' ? 'page' : undefined}>
                Overview
            </Link>
            <Link href={`${base}/analysis`} className="pill-tab" data-active={active === 'analysis'} aria-current={active === 'analysis' ? 'page' : undefined}>
                Technical Analysis
            </Link>
            <Link href={`${base}/valuation`} className="pill-tab" data-active={active === 'valuation'} aria-current={active === 'valuation' ? 'page' : undefined}>
                Valuation
            </Link>
        </nav>
    );
};

export default StockTabs;
