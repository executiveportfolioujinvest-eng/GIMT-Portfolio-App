import {redirect} from "next/navigation";
import {getSessionUser} from "@/lib/better-auth/session";
import {canAccessMarket, marketForDepartment, marketHref, type MarketKey} from "@/lib/markets";

// Keeps members inside their own department's section; only the executives can enter the other one
const MarketGuard = async ({ market, children }: { market: MarketKey; children: React.ReactNode }) => {
    const user = await getSessionUser();
    if (!user) redirect('/sign-in');
    if (!canAccessMarket(user, market)) redirect(marketHref(marketForDepartment(user.department), '/'));

    return <>{children}</>;
};

export default MarketGuard;
