import Link from "next/link";
import {getSessionUser} from "@/lib/better-auth/session";
import {isExecutiveRole, marketHref, MARKETS, type MarketKey} from "@/lib/markets";

// Executive portfolio managers can move between the Global (GMIT) and Local (LIMT) sections; nobody else sees this
const MarketSwitcher = async ({ market, path }: { market: MarketKey; path: string }) => {
    const user = await getSessionUser();
    if (!isExecutiveRole(user?.teamRole)) return null;

    return (
        <nav className="pill-tabs mb-8 w-fit" aria-label="Switch department">
            {(['global', 'local'] as MarketKey[]).map((m) => (
                <Link
                    key={m}
                    href={marketHref(m, path)}
                    className="pill-tab"
                    data-active={m === market}
                    aria-current={m === market ? 'page' : undefined}
                >
                    {m === 'global' ? 'Global Markets' : 'Local Markets'} ({MARKETS[m].team})
                </Link>
            ))}
        </nav>
    );
};

export default MarketSwitcher;
