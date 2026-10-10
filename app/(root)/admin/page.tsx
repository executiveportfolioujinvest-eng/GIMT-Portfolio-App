import Link from "next/link";
import {redirect} from "next/navigation";
import MembersManager from "@/components/admin/MembersManager";
import DashboardEditor from "@/components/admin/DashboardEditor";
import AnnouncementsManager from "@/components/admin/AnnouncementsManager";
import {getSessionUser} from "@/lib/better-auth/session";
import {getAllAnnouncements, getMembers} from "@/lib/actions/admin.actions";
import {getDashboardConfig} from "@/lib/dashboard-config";
import {homeHref, isAdminRole, isMarketKey, MARKETS, type MarketKey} from "@/lib/markets";

export const metadata = { title: "Admin | GMIT Portfolio" };

const TABS = [
    { key: 'members', label: 'Members' },
    { key: 'dashboards', label: 'Dashboards' },
    { key: 'announcements', label: 'Announcements' },
] as const;

type Tab = (typeof TABS)[number]['key'];

// The administrator console: members, dashboard contents and announcements for both departments
export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; market?: string }> }) {
    const user = await getSessionUser();
    if (!user) redirect('/sign-in');
    if (!isAdminRole(user.teamRole)) redirect(homeHref(user));

    const params = await searchParams;
    const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : 'members';
    const market: MarketKey = isMarketKey(params.market) ? params.market : 'global';

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-100">Admin Console</h1>
                <p className="mt-1 text-gray-500">Members, dashboards and announcements for the Global (GMIT) and Local (LMIT) departments</p>
            </div>

            <nav className="pill-tabs w-fit" aria-label="Admin sections">
                {TABS.map((t) => (
                    <Link key={t.key} href={`/admin?tab=${t.key}`} className="pill-tab" data-active={t.key === tab} aria-current={t.key === tab ? 'page' : undefined}>
                        {t.label}
                    </Link>
                ))}
            </nav>

            {tab === 'members' && <MembersManager members={await getMembers()} />}

            {tab === 'dashboards' && (
                <div className="flex flex-col gap-6">
                    <nav className="pill-tabs w-fit" aria-label="Department">
                        {(['global', 'local'] as MarketKey[]).map((m) => (
                            <Link key={m} href={`/admin?tab=dashboards&market=${m}`} className="pill-tab" data-active={m === market} aria-current={m === market ? 'page' : undefined}>
                                {m === 'global' ? 'Global Markets' : 'Local Markets'} ({MARKETS[m].team})
                            </Link>
                        ))}
                    </nav>
                    {/* Keyed by department so the editors start from that department's settings */}
                    <DashboardEditor key={market} market={market} config={await getDashboardConfig(market)} />
                </div>
            )}

            {tab === 'announcements' && <AnnouncementsManager announcements={await getAllAnnouncements()} />}
        </div>
    );
}
