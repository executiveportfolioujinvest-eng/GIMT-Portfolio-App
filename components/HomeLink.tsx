'use client';

import Link from "next/link";
import {usePathname} from "next/navigation";
import {marketFromPathname, marketHref} from "@/lib/markets";

// The logo returns to the dashboard of whichever team section you're in
const HomeLink = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const pathname = usePathname();
    const market = marketFromPathname(pathname);

    return (
        <Link href={marketHref(market, '/')} className={className} aria-label={`${market === 'local' ? 'LMIT' : 'GMIT'} Portfolio home`}>
            {children}
        </Link>
    )
}

export default HomeLink
