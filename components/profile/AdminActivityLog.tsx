import {ShieldAlert} from "lucide-react";

const when = (iso: string) =>
    new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' });

// Every change made in administrator mode, who made it and with which administrator account
const AdminActivityLog = ({ activity }: { activity: AdminActivityView[] }) => (
    <section className="flex flex-col gap-4">
        <div>
            <h2 className="watchlist-title">Administrator Activity</h2>
            <p className="mt-1 text-sm text-gray-400">
                Everything done in administrator mode and to administrator accounts, newest first. &ldquo;Signed in directly&rdquo; means
                someone used the administrator account&apos;s own login instead of entering from a profile page.
            </p>
        </div>

        {activity.length === 0 ? (
            <div className="dash-panel py-10 text-center">
                <p className="empty-title">No administrator activity yet</p>
            </div>
        ) : (
            <ol className="dash-panel flex max-h-[560px] flex-col divide-y divide-gray-700 overflow-y-auto py-0 scrollbar-hide-default">
                {activity.map((a) => (
                    <li key={a.id} className="flex gap-3 py-3">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-gray-100">{a.summary}</p>
                            <p className="mt-1 text-xs text-gray-500">
                                {when(a.at)} &bull;{' '}
                                {a.actor ? `${a.actor}${a.actorRole ? ` (${a.actorRole})` : ''}` : 'Signed in directly'}
                                {a.admin ? ` • administrator account: ${a.admin}` : ''}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
        )}
    </section>
);

export default AdminActivityLog;
