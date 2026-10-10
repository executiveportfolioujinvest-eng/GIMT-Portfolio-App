import { betterAuth } from "better-auth";
import { mongodbAdapter} from "better-auth/adapters/mongodb";
import { connectToDatabase} from "@/database/mongoose";
import { nextCookies} from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { isAdminRole, isDepartment, isLeadershipRole, isSignUpRole, roleFitsDepartment, roleLabel } from "@/lib/markets";
import { parseMemberProfile, parseProfileUpdate } from "@/lib/member-profile";

type MongooseDb = NonNullable<Awaited<ReturnType<typeof connectToDatabase>>['connection']['db']>;

const createAuth = (db: MongooseDb) => betterAuth({
    // Mongoose bundles its own copy of the mongodb driver types, so cast to the adapter Db type
    database: mongodbAdapter(db as unknown as Parameters<typeof mongodbAdapter>[0]),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
        enabled: true,
        disableSignUp: false,
        requireEmailVerification: false,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        autoSignIn: true,
    },
    user: {
        additionalFields: {
            // Portfolio the member belongs to: 'global' (GMIT) or 'local' (LMIT)
            department: { type: 'string', required: false, defaultValue: 'global', input: true },
            // Position on the team, e.g. executive_global_pm or equity_analyst
            teamRole: { type: 'string', required: false, defaultValue: 'investment_analyst', input: true },
            // Background for the portfolio managers; kept out of the session
            birthday: { type: 'string', required: false, input: true, returned: false },
            education: { type: 'json', required: false, input: true, returned: false },
            careerGoals: { type: 'json', required: false, input: true, returned: false },
            yearGoals: { type: 'json', required: false, input: true, returned: false },
            skills: { type: 'json', required: false, input: true, returned: false },
            tradingExperience: { type: 'string', required: false, input: true, returned: false },
            investmentManagementExperience: { type: 'string', required: false, input: true, returned: false },
            analysisApproach: { type: 'string', required: false, input: true, returned: false },
            assetClassFocus: { type: 'string', required: false, input: true, returned: false },
            coverageSector: { type: 'string', required: false, input: true, returned: false },
            learningGoals: { type: 'string', required: false, input: true, returned: false },
            linkedinUrl: { type: 'string', required: false, input: true, returned: false },
        },
    },
    databaseHooks: {
        user: {
            create: {
                // Enforced here so no sign-up path can skip it
                before: async (user, context) => {
                    const { department, teamRole } = user;

                    // Administrators are added from an executive's, the President's or Vice President's profile page
                    // (a direct server call), never through a sign-up request
                    if (isAdminRole(teamRole)) {
                        if (context) {
                            throw new APIError('FORBIDDEN', { message: 'Administrators can only be added by an executive portfolio manager, the President or Vice President' });
                        }
                        return { data: { ...user, department: 'both' } };
                    }

                    // Sign-ups must give their full background; members an administrator adds directly
                    // (a server call with no request context) can fill it in later
                    let profile: Partial<MemberProfile>;
                    try {
                        profile = context ? parseMemberProfile(user) : parseProfileUpdate(user);
                    } catch (e) {
                        throw new APIError('BAD_REQUEST', { message: e instanceof Error ? e.message : 'Complete your profile' });
                    }
                    if (!isDepartment(department)) {
                        throw new APIError('BAD_REQUEST', { message: 'Select the portfolio you are part of' });
                    }
                    if (!isSignUpRole(teamRole)) {
                        throw new APIError('BAD_REQUEST', { message: 'Select your role' });
                    }
                    if (!roleFitsDepartment(teamRole, department)) {
                        throw new APIError('BAD_REQUEST', {
                            message: department === 'both'
                                ? 'Only the President and Vice President belong to both portfolios'
                                : 'That role belongs to another department',
                        });
                    }
                    if (isLeadershipRole(teamRole)) {
                        // One executive and one deputy per department, one President and one Vice President
                        const existing = await db.collection('user').findOne({ teamRole });
                        if (existing) {
                            throw new APIError('BAD_REQUEST', { message: `The ${roleLabel(teamRole)} role has already been filled` });
                        }
                    }

                    return { data: { ...user, ...profile } };
                },
            },
            update: {
                // Members can't change their own department or role (e.g. promote themselves to executive)
                before: async (user) => {
                    if ('department' in user || 'teamRole' in user) {
                        throw new APIError('FORBIDDEN', { message: 'Department and role are changed by an administrator on the Members page' });
                    }
                    // Profile edits must still pass the sign-up rules
                    try {
                        return { data: { ...user, ...parseProfileUpdate(user) } };
                    } catch (e) {
                        throw new APIError('BAD_REQUEST', { message: e instanceof Error ? e.message : 'Invalid profile' });
                    }
                },
            },
        },
    },
    plugins: [nextCookies()],
});

let authPromise: Promise<ReturnType<typeof createAuth>> | null = null;

// Connects on first use rather than at import, so `next build` never needs the database
export const getAuth = () => {
    if (!authPromise) {
        authPromise = (async () => {
            const mongoose = await connectToDatabase();
            const db = mongoose.connection.db;

            if(!db) throw new Error('MongoDB connection not found');

            return createAuth(db);
        })().catch((e) => {
            // Let the next request retry instead of caching the failure
            authPromise = null;
            throw e;
        });
    }

    return authPromise;
}
