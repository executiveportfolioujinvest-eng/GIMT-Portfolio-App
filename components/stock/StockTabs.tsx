import Link from "next/link";
import {marketHref, type MarketKey} from "@/lib/markets";

// Overview (company snapshot) / Analysis (full charting) switch on the stock pages
const StockTabs = ({ market, symbol, active }: { market: MarketKey; symbol: string; active: 'overview' | 'analysis' }) => {
    const base = marketHref(market, `/stocks/${encodeURIComponent(symbol)}`);

    return (
        <nav className="pill-tabs mb-6 w-fit" aria-label="Stock views">
            <Link href={base} className="pill-tab" data-active={active === 'overview'} aria-current={active === 'overview' ? 'page' : undefined}>
                Overview
            </Link>
            <Link href={`${base}/analysis`} className="pill-tab" data-active={active === 'analysis'} aria-current={active === 'analysis' ? 'page' : undefined}>
                Analysis
            </Link>
        </nav>
    );
};

export default StockTabs;
