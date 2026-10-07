import { betterAuth } from "better-auth";
import { mongodbAdapter} from "better-auth/adapters/mongodb";
import { connectToDatabase} from "@/database/mongoose";
import { nextCookies} from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { departmentForExecutive, isExecutiveRole, isMarketKey, isTeamRole } from "@/lib/markets";

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
            // Portfolio the member belongs to: 'global' (GMIT) or 'local' (LIMT)
            department: { type: 'string', required: false, defaultValue: 'global', input: true },
            // Position on the team, e.g. executive_global_pm or equity_analyst
            teamRole: { type: 'string', required: false, defaultValue: 'investment_analyst', input: true },
        },
    },
    databaseHooks: {
        user: {
            create: {
                // Enforced here so no sign-up path can skip it
                before: async (user) => {
                    const { department, teamRole } = user;
                    if (!isMarketKey(department)) {
                        throw new APIError('BAD_REQUEST', { message: 'Select the portfolio you are part of' });
                    }
                    if (!isTeamRole(teamRole)) {
                        throw new APIError('BAD_REQUEST', { message: 'Select your role' });
                    }
                    if (isExecutiveRole(teamRole)) {
                        if (departmentForExecutive(teamRole) !== department) {
                            throw new APIError('BAD_REQUEST', { message: "That executive role belongs to the other department" });
                        }
                        // One executive portfolio manager per department
                        const existing = await db.collection('user').findOne({ teamRole });
                        if (existing) {
                            throw new APIError('BAD_REQUEST', { message: 'That executive portfolio manager role has already been filled' });
                        }
                    }
                },
            },
        },
    },
    plugins: [nextCookies()],
});

let authInstance: ReturnType<typeof createAuth> | null = null;

export const getAuth = async () => {
    if(authInstance) return authInstance;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if(!db) throw new Error('MongoDB connection not found');

    authInstance = createAuth(db);

    return authInstance;
}

export const auth = await getAuth();
