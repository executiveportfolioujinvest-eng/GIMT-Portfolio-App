'use server';

import {getAuth} from "@/lib/better-auth/auth";
import {inngest} from "@/lib/inngest/client";
import {headers} from "next/headers";
import {APIError} from "better-auth/api";
import {connectToDatabase} from "@/database/mongoose";
import {LEADERSHIP_ROLES, marketForDepartment, marketHref} from "@/lib/markets";

// Each department lands on its own dashboard after signing in
const homeForDepartment = (department?: string | null) => marketHref(marketForDepartment(department), '/');

// Better Auth rejections (e.g. a filled executive role) carry a message the user should see
const authErrorMessage = (e: unknown, fallback: string) =>
    e instanceof APIError ? (e.body?.message ?? e.message ?? fallback) : fallback;

export const signUpWithEmail = async ({ email, password, fullName, department, teamRole, country, investmentGoals, riskTolerance, preferredIndustry }: SignUpFormData) => {
    try {
        const auth = await getAuth();
        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName, department, teamRole } })

        if(response) {
            // A failed welcome-email event shouldn't fail the sign-up itself
            await inngest.send({
                name: 'app/user.created',
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry }
            }).catch((e) => console.error('Failed to queue welcome email', e))
        }

        return { success: true, data: response, home: homeForDepartment(department) }
    } catch (e) {
        console.log('Sign up failed', e)
        return { success: false, error: authErrorMessage(e, 'Sign up failed') }
    }
}

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const auth = await getAuth();
        const response = await auth.api.signInEmail({ body: { email, password } })

        return { success: true, data: response, home: homeForDepartment((response.user as { department?: string }).department) }
    } catch (e) {
        console.log('Sign in failed', e)
        return { success: false, error: 'Sign in failed' }
    }
}

export const signOut = async () => {
    try {
        const auth = await getAuth();
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.log('Sign out failed', e)
        return { success: false, error: 'Sign out failed' }
    }
}

// Executive and deputy portfolio manager roles that already have someone in them, so sign-up can hide them
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
