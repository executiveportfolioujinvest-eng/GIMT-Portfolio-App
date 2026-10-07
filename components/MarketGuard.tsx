import {redirect} from "next/navigation";
import {getSessionUser} from "@/lib/better-auth/session";
import {canAccessMarket, homeHref, type MarketKey} from "@/lib/markets";

// Keeps members inside their own department's section; the executives, President and Vice President can enter both
const MarketGuard = async ({ market, children }: { market: MarketKey; children: React.ReactNode }) => {
    const user = await getSessionUser();
    if (!user) redirect('/sign-in');
    if (!canAccessMarket(user, market)) redirect(homeHref(user));

    return <>{children}</>;
};

export default MarketGuard;
