'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { getAuth } from '@/lib/better-auth/auth';
import { getSessionUser } from '@/lib/better-auth/session';
import { ADMIN_RETURN_COOKIE } from '@/lib/admin-mode';
import { getAdminModeActor, recordAdminActivity } from '@/lib/admin-activity';
import { connectToDatabase } from '@/database/mongoose';
import { AdminActivity } from '@/database/models/admin-activity.model';
import { createAccount, deleteAccount, getUserCollection, toObjectId, toProfileView, validateNewAccount } from '@/lib/accounts';
import { ADMIN_ROLE, canCreateAdministrators, isAdminRole, roleLabel } from '@/lib/markets';
import { parseBirthday } from '@/lib/member-profile';

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// The signed-in member's own profile, including the background they gave at sign-up
export async function getMyProfile(): Promise<MyProfileView | null> {
    try {
        const user = await getSessionUser();
        const id = user && toObjectId(user.id);
        if (!id) return null;
        const doc = await (await getUserCollection()).findOne({ _id: id });
        return doc ? toProfileView(doc) : null;
    } catch (e) {
        unstable_rethrow(e);
        console.error('getMyProfile error:', e);
        return null;
    }
}

// Administrator accounts, for the executives, President and Vice President
export async function getAdministrators(): Promise<AdministratorView[]> {
    try {
        const user = await getSessionUser();
        if (!canCreateAdministrators(user?.teamRole)) return [];
        const admins = await (await getUserCollection()).find({ teamRole: ADMIN_ROLE }).sort({ createdAt: 1 }).toArray();
        return admins.map((a) => ({
            id: String(a._id),
            name: String(a.name ?? ''),
            email: String(a.email ?? ''),
            addedBy: a.addedBy?.name,
            joinedAt: a.createdAt ? new Date(a.createdAt).toISOString() : null,
        }));
    } catch (e) {
        unstable_rethrow(e);
        console.error('getAdministrators error:', e);
        return [];
    }
}

export async function createAdministrator(input: { name: string; email: string; password: string }) {
    try {
        const user = await getSessionUser();
        if (!user || !canCreateAdministrators(user.teamRole)) {
            return { success: false, error: 'Only executive portfolio managers, the President and Vice President can add administrators' };
        }
        const invalid = validateNewAccount(input);
        if (invalid) return { success: false, error: invalid };

        const admin = await createAccount({ ...input, department: 'both', teamRole: ADMIN_ROLE });
        await (await getUserCollection()).updateOne({ _id: toObjectId(admin.id)! }, { $set: { addedBy: { id: user.id, name: user.name } } });
        await recordAdminActivity({
            action: 'admin.create',
            summary: `Added the administrator account ${admin.name} (${admin.email})`,
            admin: { id: admin.id, name: admin.name },
            actor: user,
        });

        revalidatePath('/profile');
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('createAdministrator error:', e);
        return { success: false, error: errorMessage(e, 'Failed to add the administrator') };
    }
}

export async function removeAdministrator(adminId: string) {
    try {
        const user = await getSessionUser();
        if (!user || !canCreateAdministrators(user.teamRole)) return { success: false, error: 'You can’t remove administrators' };

        const id = toObjectId(adminId);
        const admin = id && (await (await getUserCollection()).findOne({ _id: id }));
        if (!admin || !isAdminRole(admin.teamRole)) return { success: false, error: 'Administrator not found' };

        await deleteAccount(adminId);
        await recordAdminActivity({
            action: 'admin.remove',
            summary: `Removed the administrator account ${admin.name} (${admin.email})`,
            admin: { id: adminId, name: String(admin.name) },
            actor: user,
        });
        revalidatePath('/profile');
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('removeAdministrator error:', e);
        return { success: false, error: 'Failed to remove the administrator' };
    }
}

// Signs a portfolio manager into an administrator account with its password, keeping their own session to return to
export async function enterAdminMode({ adminId, password }: { adminId: string; password: string }) {
    try {
        const user = await getSessionUser();
        if (!user || !canCreateAdministrators(user.teamRole)) {
            return { success: false, error: 'Only executive portfolio managers, the President and Vice President can enter administrator mode' };
        }

        const id = toObjectId(adminId);
        const admin = id && (await (await getUserCollection()).findOne({ _id: id }));
        if (!admin || !isAdminRole(admin.teamRole)) return { success: false, error: 'Administrator not found' };

        const auth = await getAuth();
        const sessionCookie = (await auth.$context).authCookies.sessionToken;
        const cookieStore = await cookies();
        const ownSession = cookieStore.get(sessionCookie.name)?.value;
        if (!ownSession) return { success: false, error: 'Your session has expired. Sign in again.' };

        try {
            await auth.api.signInEmail({ body: { email: String(admin.email), password }, headers: await headers() });
        } catch {
            return { success: false, error: 'Incorrect administrator password' };
        }

        await recordAdminActivity({
            action: 'admin-mode.enter',
            summary: 'Entered administrator mode',
            admin: { id: adminId, name: String(admin.name) },
            actor: user,
        });
        cookieStore.set(ADMIN_RETURN_COOKIE, ownSession, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 12,
        });
        return { success: true, home: '/admin' };
    } catch (e) {
        unstable_rethrow(e);
        console.error('enterAdminMode error:', e);
        return { success: false, error: 'Failed to enter administrator mode' };
    }
}

// Signs out of the administrator account and back into the portfolio manager's own session
export async function exitAdminMode() {
    try {
        const auth = await getAuth();
        const sessionCookie = (await auth.$context).authCookies.sessionToken;
        const cookieStore = await cookies();
        const ownSession = cookieStore.get(ADMIN_RETURN_COOKIE)?.value;

        const admin = await getSessionUser();
        if (admin && isAdminRole(admin.teamRole)) {
            await recordAdminActivity({ action: 'admin-mode.exit', summary: 'Left administrator mode', admin, actor: await getAdminModeActor() });
        }

        await auth.api.signOut({ headers: await headers() }).catch(() => null);
        cookieStore.delete(ADMIN_RETURN_COOKIE);

        if (ownSession) {
            const own = await auth.api.getSession({
                headers: new Headers({ cookie: `${sessionCookie.name}=${encodeURIComponent(ownSession)}` }),
            });
            if (own?.user) {
                const { sameSite, ...attributes } = sessionCookie.attributes;
                cookieStore.set(sessionCookie.name, ownSession, {
                    ...attributes,
                    sameSite: typeof sameSite === 'string' ? (sameSite.toLowerCase() as 'lax' | 'strict' | 'none') : sameSite,
                });
                return { success: true, home: '/profile' };
            }
        }
        return { success: true, home: '/sign-in' };
    } catch (e) {
        unstable_rethrow(e);
        console.error('exitAdminMode error:', e);
        return { success: false, error: 'Failed to exit administrator mode' };
    }
}

// Everything done in administrator mode and to administrator accounts, newest first (executives, President, Vice President)
export async function getAdminActivity(): Promise<AdminActivityView[]> {
    try {
        const user = await getSessionUser();
        if (!canCreateAdministrators(user?.teamRole)) return [];
        await connectToDatabase();
        const rows = await AdminActivity.find({}).sort({ at: -1 }).limit(100).lean();
        return rows.map((r) => ({
            id: String(r._id),
            action: r.action,
            summary: r.summary,
            admin: r.admin?.name,
            actor: r.actor?.name,
            actorRole: r.actor?.role ? roleLabel(r.actor.role) : undefined,
            at: new Date(r.at).toISOString(),
        }));
    } catch (e) {
        unstable_rethrow(e);
        console.error('getAdminActivity error:', e);
        return [];
    }
}

// Members add or change their own birthday on the profile page
export async function updateMyBirthday(birthday: string) {
    try {
        const user = await getSessionUser();
        const id = user && toObjectId(user.id);
        if (!id) return { success: false, error: 'You need to be signed in' };
        if (isAdminRole(user.teamRole)) return { success: false, error: 'Administrator accounts don’t have birthdays' };

        let value: string;
        try {
            value = parseBirthday(birthday);
        } catch (e) {
            return { success: false, error: errorMessage(e, 'Select your birthday') };
        }
        await (await getUserCollection()).updateOne({ _id: id }, { $set: { birthday: value, updatedAt: new Date() } });
        revalidatePath('/profile');
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('updateMyBirthday error:', e);
        return { success: false, error: 'Failed to save your birthday' };
    }
}
