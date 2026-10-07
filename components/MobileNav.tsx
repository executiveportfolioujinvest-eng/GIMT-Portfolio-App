'use client';

import {useEffect, useState} from "react";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {LogOut, Menu, X} from "lucide-react";
import NavItems from "@/components/NavItems";
import RollText, {NavLinkContent} from "@/components/RollText";
import {UserInitial} from "@/components/UserDropdown";
import {signOut} from "@/lib/actions/auth.actions";
import {marketFromPathname, marketHref} from "@/lib/markets";

type MobileNavProps = {
    user: User;
    initialStocks: StockWithWatchlistStatus[];
    initialLocalStocks: StockWithWatchlistStatus[];
};

const MobileNav = ({ user, initialStocks, initialLocalStocks }: MobileNavProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const portfolioHref = marketHref(marketFromPathname(pathname), '/portfolio');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    const handleSignOut = async () => {
        await signOut();
        router.push("/sign-in");
    }

    return (
        <div className="md:hidden">
            <button
                type="button"
                className="nav-burger"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((v) => !v)}
            >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {open && (
                <div
                    id="mobile-nav"
                    className="nav-panel"
                    // Close the menu once a link inside it is followed
                    onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false) }}
                >
                    <nav>
                        <NavItems initialStocks={initialStocks} initialLocalStocks={initialLocalStocks} className="nav-list-mobile" />
                    </nav>

                    <Link href={portfolioHref} className="nav-link w-full justify-center" aria-label="Portfolio" data-active={pathname.startsWith(portfolioHref)}>
                        <NavLinkContent label="Portfolio" />
                    </Link>

                    <div className="flex items-center justify-center gap-3 py-1">
                        <UserInitial name={user.name} className="h-8 w-8 text-sm" />
                        <div className="flex flex-col min-w-0">
                            <span className="nav-menu-name">{user.name}</span>
                            <span className="nav-menu-email">{user.email}</span>
                        </div>
                    </div>

                    <button type="button" onClick={handleSignOut} className="nav-cta w-full justify-center" aria-label="Logout">
                        <span className="nav-fill" aria-hidden="true" />
                        <LogOut className="relative h-4 w-4" aria-hidden="true" />
                        <RollText>Logout</RollText>
                    </button>
                </div>
            )}
        </div>
    )
}
export default MobileNav
