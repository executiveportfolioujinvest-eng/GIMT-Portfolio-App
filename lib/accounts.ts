import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';
import { getAuth } from '@/lib/better-auth/auth';
import { Watchlist } from '@/database/models/watchlist.model';
import { AlertModel } from '@/database/models/alert.model';
import { PortfolioProposal } from '@/database/models/portfolio-proposal.model';
import { isDepartment, isLeadershipRole } from '@/lib/markets';

// Server-side helpers for creating and removing accounts (used by the profile page and administrator console)

export const getUserCollection = async () => {
    const db = (await connectToDatabase()).connection.db;
    if (!db) throw new Error('Database not connected');
    return db.collection('user');
};

export const toObjectId = (id: string) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

const isoDate = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

export const toMemberView = (u: Record<string, unknown>): MemberView => ({
    id: String(u._id),
    name: String(u.name ?? ''),
    email: String(u.email ?? ''),
    department: isDepartment(u.department) ? u.department : 'global',
    teamRole: (u.teamRole as TeamRole) ?? null,
    linkedinUrl: typeof u.linkedinUrl === 'string' ? u.linkedinUrl : undefined,
    joinedAt: isoDate(u.createdAt),
});

// Education is stored as JSON text by Better Auth's MongoDB adapter
export const parseEducation = (value: unknown): EducationEntry[] => {
    if (Array.isArray(value)) return value as EducationEntry[];
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const toProfileView = (u: Record<string, unknown>): MyProfileView => ({
    ...toMemberView(u),
    birthday: typeof u.birthday === 'string' ? u.birthday : undefined,
    education: parseEducation(u.education),
    careerGoals: typeof u.careerGoals === 'string' ? u.careerGoals : undefined,
    yearGoals: typeof u.yearGoals === 'string' ? u.yearGoals : undefined,
    learningGoals: typeof u.learningGoals === 'string' ? u.learningGoals : undefined,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks the details for a new account; returns an error message or null
export const validateNewAccount = ({ name, email, password }: { name: string; email: string; password: string }) => {
    if (!name?.trim() || name.trim().length < 2) return 'Enter a name';
    if (!EMAIL.test(email?.trim() ?? '')) return 'Enter a valid email address';
    if (!password || password.length < 8) return 'The password needs at least 8 characters';
    if (password.length > 128) return 'The password can be at most 128 characters';
    return null;
};

// Creates an email-and-password account directly, without signing anyone in (the creator stays signed in)
export const createAccount = async (
    { name, email, password, department, teamRole }: { name: string; email: string; password: string; department: string; teamRole: TeamRole }
) => {
    const ctx = await (await getAuth()).$context;
    const normalizedEmail = email.trim().toLowerCase();
    if (await ctx.internalAdapter.findUserByEmail(normalizedEmail)) throw new Error('An account with that email already exists');

    const hash = await ctx.password.hash(password);
    const user = await ctx.internalAdapter.createUser(
        { email: normalizedEmail, name: name.trim(), emailVerified: false, department, teamRole },
        { method: 'admin' }
    );
    if (!user) throw new Error('Failed to create the account');
    await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: 'credential', accountId: user.id, password: hash });
    return user;
};

// Whether someone other than `exceptId` already holds a single-seat role (executive, deputy, President, Vice President)
export const seatTaken = async (teamRole: TeamRole, exceptId?: string) => {
    if (!isLeadershipRole(teamRole)) return false;
    const users = await getUserCollection();
    const holder = await users.findOne({ teamRole, ...(exceptId && toObjectId(exceptId) ? { _id: { $ne: toObjectId(exceptId)! } } : {}) });
    return !!holder;
};

// Deletes an account with its sessions, logins, watchlist and alerts; their open portfolio requests are cancelled
export const deleteAccount = async (userId: string) => {
    const ctx = await (await getAuth()).$context;
    await ctx.internalAdapter.deleteUser(userId);
    await connectToDatabase();
    await Promise.all([
        Watchlist.deleteMany({ userId }),
        AlertModel.deleteMany({ userId }),
        PortfolioProposal.updateMany(
            { 'proposedBy.id': userId, status: { $in: ['pending', 'delegated', 'co_authorized'] } },
            { $set: { status: 'cancelled' } }
        ),
    ]);
};
