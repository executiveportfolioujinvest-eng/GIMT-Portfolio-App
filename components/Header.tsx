import Image from "next/image";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import MobileNav from "@/components/MobileNav";
import RollText from "@/components/RollText";
import HomeLink from "@/components/HomeLink";
import {searchStocks} from "@/lib/actions/finnhub.actions";

const Header = async ({ user }: { user: User }) => {
    const [initialStocks, initialLocalStocks] = await Promise.all([
        searchStocks(),
        searchStocks(undefined, 'local'),
    ]);

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
                            <NavItems initialStocks={initialStocks} initialLocalStocks={initialLocalStocks} />
                        </nav>
                        <UserDropdown user={user} />
                    </div>

                    <MobileNav user={user} initialStocks={initialStocks} initialLocalStocks={initialLocalStocks} />
                </div>
            </div>
        </header>
    )
}
export default Header
