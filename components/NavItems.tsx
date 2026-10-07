'use client'

import {NAV_ITEMS} from "@/lib/constants";
import Link from "next/link";
import {usePathname} from "next/navigation";
import SearchCommand from "@/components/SearchCommand";
import {NavLinkContent} from "@/components/RollText";
import {cn} from "@/lib/utils";
import {marketFromPathname, marketHref} from "@/lib/markets";

type NavItemsProps = {
    initialStocks: StockWithWatchlistStatus[];
    initialLocalStocks: StockWithWatchlistStatus[];
    className?: string;
};

const NavItems = ({ initialStocks, initialLocalStocks, className }: NavItemsProps) => {
    const pathname = usePathname()
    // Links stay inside the Local Markets (LIMT) section while you're in it
    const market = marketFromPathname(pathname)

    const isActive = (path: string) => {
        const href = marketHref(market, path);
        if (path === '/') return pathname === href;

        return pathname.startsWith(href);
    }

    return (
        <ul className={cn("nav-list", className)}>
            {NAV_ITEMS.map(({ href, label }) => {
                if(href === '/search') return (
                    <li key="search-trigger">
                        <SearchCommand
                            key={market}
                            renderAs="text"
                            label={<NavLinkContent label={label} />}
                            ariaLabel={label}
                            className="nav-link"
                            market={market}
                            initialStocks={market === 'local' ? initialLocalStocks : initialStocks}
                        />
                    </li>
                )

                return <li key={href}>
                    <Link
                        href={marketHref(market, href)}
                        className="nav-link"
                        aria-label={label}
                        data-active={isActive(href)}
                        aria-current={isActive(href) ? 'page' : undefined}
                    >
                        <NavLinkContent label={label} />
                    </Link>
                </li>
            })}
        </ul>
    )
}
export default NavItems
