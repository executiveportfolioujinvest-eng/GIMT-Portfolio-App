import {connectToDatabase} from "@/database/mongoose";
import {Watchlist} from "@/database/models/watchlist.model";
import {marketFilter} from "@/database/queries";
import {ADMIN_ROLE, isDepartment, type Department, type MarketKey} from "@/lib/markets";
import type {EmailPreferences} from "@/lib/email-preferences";

// Server-only lookups for the email jobs. Kept out of the 'use server' action files so a browser can't call them.

export type EmailMember = {
    id: string;
    email: string;
    name: string;
    department: Department;
    teamRole: TeamRole | null;
    birthday: string | null;
    emailPreferences: EmailPreferences;
};

// Every member (administrator accounts get no team emails) with what the email jobs need
export const getEmailMembers = async (): Promise<EmailMember[]> => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('Mongoose connection not connected');

        const users = await db.collection('user').find(
            { email: { $exists: true, $ne: null }, teamRole: { $ne: ADMIN_ROLE } },
            { projection: { _id: 1, id: 1, email: 1, name: 1, department: 1, teamRole: 1, birthday: 1, emailPreferences: 1 } }
        ).toArray();

        return users.filter((user) => user.email && user.name).map((user) => ({
            id: String(user.id || user._id),
            email: String(user.email),
            name: String(user.name),
            department: isDepartment(user.department) ? user.department : 'global',
            teamRole: (user.teamRole as TeamRole | undefined) ?? null,
            birthday: typeof user.birthday === 'string' ? user.birthday : null,
            emailPreferences: user.emailPreferences && typeof user.emailPreferences === 'object' ? user.emailPreferences as EmailPreferences : {},
        }));
    } catch (e) {
        console.error('Error fetching members for emails:', e);
        return [];
    }
};

// The stocks a member has starred in one market's watchlist
export const getWatchlistStocks = async (userId: string, market: MarketKey): Promise<{ symbol: string; company: string }[]> => {
    if (!userId) return [];
    await connectToDatabase();
    const items = await Watchlist.find({ userId, ...marketFilter(market) }, { symbol: 1, company: 1 }).lean();
    return items.map((i) => ({ symbol: String(i.symbol), company: String(i.company ?? i.symbol) }));
};
