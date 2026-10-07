'use client';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {usePathname, useRouter} from "next/navigation";
import {Briefcase, ChevronsUpDown, LogOut} from "lucide-react";
import RollText from "@/components/RollText";
import {signOut} from "@/lib/actions/auth.actions";
import {marketFromPathname, marketHref} from "@/lib/markets";

export const UserInitial = ({ name, className }: { name: string; className?: string }) => (
    <span className={`nav-avatar ${className ?? ''}`} aria-hidden="true">
        {name?.[0]?.toUpperCase()}
    </span>
)

const UserDropdown = ({ user }: {user: User}) => {
    const router = useRouter();
    const pathname = usePathname();
    const portfolioHref = marketHref(marketFromPathname(pathname), '/portfolio');

    const handleSignOut = async () => {
        await signOut();
        router.push("/sign-in");
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" className="nav-cta" aria-label={`Account menu for ${user.name}`}>
                    <span className="nav-fill" aria-hidden="true" />
                    <UserInitial name={user.name} />
                    <RollText className="max-w-40">{user.name}</RollText>
                    <ChevronsUpDown className="relative h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="nav-menu min-w-56 rounded-none border-0 bg-blue-500 p-1.5 text-white shadow-xl">
                <DropdownMenuLabel className="p-0">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <UserInitial name={user.name} className="h-8 w-8 text-sm" />
                        <div className="flex flex-col min-w-0">
                            <span className="nav-menu-name">{user.name}</span>
                            <span className="nav-menu-email">{user.email}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-900/40 mx-0"/>
                <DropdownMenuItem onClick={() => router.push(portfolioHref)} className="nav-menu-item rounded-none px-2 pt-2 pb-1.5 text-sm cursor-pointer focus:bg-transparent focus:text-white">
                    <span className="nav-fill" aria-hidden="true" />
                    <Briefcase className="relative h-4 w-4 text-white" />
                    <RollText>Portfolio</RollText>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="nav-menu-item rounded-none px-2 pt-2 pb-1.5 text-sm cursor-pointer focus:bg-transparent focus:text-white">
                    <span className="nav-fill" aria-hidden="true" />
                    <LogOut className="relative h-4 w-4 text-white" />
                    <RollText>Logout</RollText>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
export default UserDropdown
