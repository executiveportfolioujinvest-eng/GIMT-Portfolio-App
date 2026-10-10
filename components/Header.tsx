import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import MobileNav from "@/components/MobileNav";
import TeamLogo from "@/components/TeamLogo";
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
                        <TeamLogo department={user.department} />
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
