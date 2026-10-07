'use server';

import {connectToDatabase} from "@/database/mongoose";
import {ADMIN_ROLE, isDepartment} from "@/lib/markets";

export const getAllUsersForNewsEmail = async () => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Mongoose connection not connected');

        // Administrators manage accounts and have no market access, so they get no market emails
        const users = await db.collection('user').find(
            { email: { $exists: true, $ne: null }, teamRole: { $ne: ADMIN_ROLE } },
            { projection: { _id: 1, id: 1, email: 1, name: 1, country:1, department: 1, teamRole: 1 }}
        ).toArray();

        return users.filter((user) => user.email && user.name).map((user) => ({
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name,
            department: isDepartment(user.department) ? user.department : 'global' as const,
            teamRole: user.teamRole as TeamRole | undefined,
        }))
    } catch (e) {
        console.error('Error fetching users for news email:', e)
        return []
    }
}

// Members (not administrator accounts) with the birthday they gave, for the daily birthday emails
export const getMembersForBirthdayEmails = async () => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Mongoose connection not connected');

        const users = await db.collection('user').find(
            { email: { $exists: true, $ne: null }, teamRole: { $ne: ADMIN_ROLE } },
            { projection: { _id: 1, email: 1, name: 1, teamRole: 1, birthday: 1 } }
        ).toArray();

        return users.filter((user) => user.email && user.name).map((user) => ({
            id: user._id.toString(),
            email: String(user.email),
            name: String(user.name),
            teamRole: (user.teamRole as TeamRole | undefined) ?? null,
            birthday: typeof user.birthday === 'string' ? user.birthday : null,
        }));
    } catch (e) {
        console.error('Error fetching members for birthday emails:', e)
        return []
    }
}
