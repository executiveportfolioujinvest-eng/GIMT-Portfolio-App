import Image from "next/image";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import MobileNav from "@/components/MobileNav";
import RollText from "@/components/RollText";
import HomeLink from "@/components/HomeLink";
import {searchStocks} from "@/lib/actions/finnhub.actions";
import {canAccessMarket, isAdminRole} from "@/lib/markets";
import {isInAdminMode} from "@/lib/admin-mode";

const Header = async ({ user }: { user: User }) => {
    // Only load search lists for the sections this member can open
    const [initialStocks, initialLocalStocks, adminMode] = await Promise.all([
        canAccessMarket(user, 'global') ? searchStocks() : Promise.resolve([]),
        canAccessMarket(user, 'local') ? searchStocks(undefined, 'local') : Promise.resolve([]),
        isInAdminMode(),
    ]);
    const isAdmin = isAdminRole(user.teamRole);
    // A portfolio manager working in an administrator account can return to their own
    const canExitAdminMode = isAdmin && adminMode;

    return (
        <header className="nav-shell">
            <div className="container">
                <div className="nav-bar">
                    <HomeLink className="nav-logo">
                        <Image src="/assets/icons/gmit-mark.svg" alt="" width={28} height={31} className="h-[26px] w-auto" priority />
                        <RollText className="h-4">
                            <Image src="/assets/icons/gmit-wordmark.svg" alt="GMIT Portfolio" width={149} height={19} className="block h-4 w-auto" priority />
                        </RollText>
                    </HomeLink>

                    <div className="hidden md:flex items-center gap-6">
                        <nav>
                            <NavItems initialStocks={initialStocks} initialLocalStocks={initialLocalStocks} showAdmin={isAdmin} />
                        </nav>
                        <UserDropdown user={user} canExitAdminMode={canExitAdminMode} />
                    </div>

                    <MobileNav user={user} initialStocks={initialStocks} initialLocalStocks={initialLocalStocks} showAdmin={isAdmin} canExitAdminMode={canExitAdminMode} />
                </div>
            </div>
        </header>
    )
}
export default Header
