import Link from "next/link";
import {redirect} from "next/navigation";
import {GraduationCap} from "lucide-react";
import AdministratorPanel from "@/components/profile/AdministratorPanel";
import ExitAdminModeButton from "@/components/profile/ExitAdminModeButton";
import BirthdayEditor from "@/components/profile/BirthdayEditor";
import AdminActivityLog from "@/components/profile/AdminActivityLog";
import {getAdminActivity, getAdministrators, getMyProfile} from "@/lib/actions/profile.actions";
import {isInAdminMode} from "@/lib/admin-mode";
import {canCreateAdministrators, departmentLabel, isAdminRole, roleLabel} from "@/lib/markets";
import {YEAR_OF_STUDY_OPTIONS} from "@/lib/member-profile";
import {getFlagEmoji} from "@/lib/utils";

const yearLabel = (value?: string) => YEAR_OF_STUDY_OPTIONS.find((o) => o.value === value)?.label ?? '—';

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="min-w-0">
        <dt className="text-sm text-gray-500">{label}</dt>
        <dd className="mt-1 break-words text-gray-100">{children}</dd>
    </div>
);

const Goal = ({ title, text }: { title: string; text?: string }) => (
    <div>
        <h3 className="text-sm font-semibold text-gray-400">{title}</h3>
        <p className="mt-1 whitespace-pre-line text-gray-100">{text || <span className="text-gray-500">Not provided</span>}</p>
    </div>
);

// Your account, your background from sign-up, and (for the executives, President and Vice President) administrator mode
const ProfilePage = async () => {
    const [profile, adminMode] = await Promise.all([getMyProfile(), isInAdminMode()]);
    if (!profile) redirect('/sign-in');

    const isAdmin = isAdminRole(profile.teamRole);
    const canManageAdmins = canCreateAdministrators(profile.teamRole);
    const [administrators, activity] = canManageAdmins ? await Promise.all([getAdministrators(), getAdminActivity()]) : [[], []];
    const joined = profile.joinedAt
        ? new Date(profile.joinedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })
        : '—';

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-100">Profile</h1>
                <p className="mt-1 text-gray-500">{roleLabel(profile.teamRole)}</p>
            </div>

            <section className="dash-panel">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Detail label="Name">{profile.name}</Detail>
                    <Detail label="Email">{profile.email}</Detail>
                    <Detail label="Role">{roleLabel(profile.teamRole)}</Detail>
                    <Detail label="Department">{isAdmin ? 'Both departments (administrator)' : departmentLabel(profile.department)}</Detail>
                    <Detail label="Member since">{joined}</Detail>
                    {!isAdmin && (
                        <Detail label="Birthday">
                            <BirthdayEditor birthday={profile.birthday} />
                        </Detail>
                    )}
                    {!isAdmin && (
                        <Detail label="LinkedIn">
                            {profile.linkedinUrl ? (
                                <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                    {profile.linkedinUrl.replace(/^https:\/\/www\./, '')}
                                </a>
                            ) : <span className="text-gray-500">Not provided</span>}
                        </Detail>
                    )}
                </dl>
            </section>

            {isAdmin ? (
                <section className="dash-panel flex flex-col gap-4">
                    <div>
                        <h2 className="watchlist-title">Administrator Account</h2>
                        <p className="mt-1 text-sm text-gray-400">
                            Manage members, the dashboards and announcements for both departments from the admin console.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/admin" className="search-btn">Open the admin console</Link>
                        {adminMode && <ExitAdminModeButton />}
                    </div>
                </section>
            ) : (
                <section className="flex flex-col gap-4">
                    <h2 className="watchlist-title">Background</h2>
                    <div className="dash-panel flex flex-col gap-4">
                        <h3 className="text-sm font-semibold text-gray-400">Education</h3>
                        {profile.education?.length ? (
                            <ul className="flex flex-col gap-3">
                                {profile.education.map((e, i) => (
                                    <li key={i} className="flex gap-3">
                                        <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" />
                                        <div>
                                            <p className="text-gray-100">{e.degree}</p>
                                            <p className="text-sm text-gray-400">
                                                {e.institutionCountry && <span className="mr-1">{getFlagEmoji(e.institutionCountry)}</span>}
                                                {e.institution} &bull; {yearLabel(e.yearOfStudy)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500">Not provided</p>}
                    </div>
                    <div className="dash-panel flex flex-col gap-5">
                        <Goal title="Career goals" text={profile.careerGoals} />
                        <Goal title="Goals for this year" text={profile.yearGoals} />
                        <Goal title="What I'd like to learn from this experience" text={profile.learningGoals} />
                    </div>
                </section>
            )}

            {canManageAdmins && <AdministratorPanel administrators={administrators} />}
            {canManageAdmins && <AdminActivityLog activity={activity} />}
        </div>
    );
};

export default ProfilePage;
