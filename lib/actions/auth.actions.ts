'use server';

import {getAuth} from "@/lib/better-auth/auth";
import {inngest} from "@/lib/inngest/client";
import {cookies, headers} from "next/headers";
import {ADMIN_RETURN_COOKIE} from "@/lib/admin-mode";
import {recordAdminActivity} from "@/lib/admin-activity";
import {APIError} from "better-auth/api";
import {connectToDatabase} from "@/database/mongoose";
import {homeHref, isAdminRole, LEADERSHIP_ROLES} from "@/lib/markets";

// Better Auth rejections (e.g. a filled executive role) carry a message the user should see
const authErrorMessage = (e: unknown, fallback: string) =>
    e instanceof APIError ? (e.body?.message ?? e.message ?? fallback) : fallback;

export const signUpWithEmail = async ({ email, password, fullName, department, teamRole, country, investmentGoals, riskTolerance, preferredIndustry, birthday, education, careerGoals, yearGoals, learningGoals, linkedinUrl }: SignUpFormData) => {
    try {
        const auth = await getAuth();
        const response = await auth.api.signUpEmail({
            body: { email, password, name: fullName, department, teamRole, birthday, education, careerGoals, yearGoals, learningGoals, linkedinUrl }
        })

        if(response) {
            // A failed welcome-email event shouldn't fail the sign-up itself
            await inngest.send({
                name: 'app/user.created',
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry }
            }).catch((e) => console.error('Failed to queue welcome email', e))
        }

        return { success: true, data: response, home: homeHref({ department, teamRole }) }
    } catch (e) {
        console.log('Sign up failed', e)
        return { success: false, error: authErrorMessage(e, 'Sign up failed') }
    }
}

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const auth = await getAuth();
        const response = await auth.api.signInEmail({ body: { email, password } })

        // Signing straight into an administrator account (not through a manager's profile page) is logged too
        const signedIn = response.user as { id: string; name: string; teamRole?: string };
        if (isAdminRole(signedIn.teamRole)) {
            await recordAdminActivity({ action: 'admin.sign-in', summary: 'Signed in to the administrator account directly', admin: signedIn, actor: null });
        }

        return { success: true, data: response, home: homeHref(response.user as { department?: string; teamRole?: string }) }
    } catch (e) {
        console.log('Sign in failed', e)
        return { success: false, error: 'Sign in failed' }
    }
}

export const signOut = async () => {
    try {
        const auth = await getAuth();
        await auth.api.signOut({ headers: await headers() });

        // Logging out from administrator mode also ends the portfolio manager's own session it was holding
        const cookieStore = await cookies();
        const ownSession = cookieStore.get(ADMIN_RETURN_COOKIE)?.value;
        if (ownSession) {
            const sessionCookie = (await auth.$context).authCookies.sessionToken;
            await auth.api.signOut({ headers: new Headers({ cookie: `${sessionCookie.name}=${encodeURIComponent(ownSession)}` }) }).catch(() => null);
            cookieStore.delete(ADMIN_RETURN_COOKIE);
        }
    } catch (e) {
        console.log('Sign out failed', e)
        return { success: false, error: 'Sign out failed' }
    }
}

// Single-seat roles (executive, deputy, President, Vice President) that already have someone in them, so sign-up can hide them
export const getFilledLeadershipRoles = async (): Promise<TeamRole[]> => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) return [];

        const filled = await db.collection('user').distinct('teamRole', { teamRole: { $in: LEADERSHIP_ROLES } });
        return filled as TeamRole[];
    } catch (e) {
        console.error('Failed to load filled leadership roles', e);
        return [];
    }
}
