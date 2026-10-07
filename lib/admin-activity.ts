import { cookies } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { AdminActivity } from '@/database/models/admin-activity.model';
import { getAuth } from '@/lib/better-auth/auth';
import { ADMIN_RETURN_COOKIE } from '@/lib/admin-mode';

type Person = { id: string; name: string; teamRole?: string | null };

// The portfolio manager working in the administrator account right now (null when it was signed into directly)
export const getAdminModeActor = async (): Promise<Person | null> => {
    const ownSession = (await cookies()).get(ADMIN_RETURN_COOKIE)?.value;
    if (!ownSession) return null;
    try {
        const auth = await getAuth();
        const name = (await auth.$context).authCookies.sessionToken.name;
        const session = await auth.api.getSession({ headers: new Headers({ cookie: `${name}=${encodeURIComponent(ownSession)}` }) });
        if (!session?.user) return null;
        return { id: session.user.id, name: session.user.name, teamRole: session.user.teamRole as string | undefined };
    } catch {
        return null;
    }
};

const person = (p?: Person | null) => (p ? { id: p.id, name: p.name, role: p.teamRole ?? undefined } : undefined);

// Records a change for the activity log. Logging never blocks the change itself.
export const recordAdminActivity = async (
    { action, summary, admin, actor }: { action: string; summary: string; admin?: Person | null; actor?: Person | null }
) => {
    try {
        await connectToDatabase();
        await AdminActivity.create({
            action,
            summary,
            admin: person(admin),
            // Changes made inside an administrator account are attributed to whoever is behind it
            actor: person(actor === undefined ? await getAdminModeActor() : actor),
        });
    } catch (e) {
        console.error('recordAdminActivity error:', e);
    }
};
