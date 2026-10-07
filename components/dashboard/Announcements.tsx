import {Megaphone} from "lucide-react";
import {getDashboardAnnouncements} from "@/lib/dashboard-config";
import type {MarketKey} from "@/lib/markets";

const when = (iso: string) =>
    new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });

// Notices the administrator posted for this department, at the top of its dashboard
const Announcements = async ({ market }: { market: MarketKey }) => {
    const announcements = await getDashboardAnnouncements(market);
    if (announcements.length === 0) return null;

    return (
        <section className="mb-8 flex flex-col gap-3" aria-label="Announcements">
            {announcements.map((a) => (
                <article key={a.id} className="dash-panel flex gap-4 border-l-4 border-l-blue-500">
                    <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" />
                    <div className="min-w-0">
                        <h2 className="font-semibold text-gray-100">{a.title}</h2>
                        <p className="mt-1 whitespace-pre-line text-sm text-gray-400">{a.message}</p>
                        <p className="mt-2 text-xs text-gray-500">{a.postedBy} &bull; {when(a.createdAt)}</p>
                    </div>
                </article>
            ))}
        </section>
    );
};

export default Announcements;
