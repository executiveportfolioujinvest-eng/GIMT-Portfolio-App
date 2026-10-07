import { cookies } from 'next/headers';

// Holds the portfolio manager's own session while they work in an administrator account, so
// "Exit administrator mode" can put them straight back into it
export const ADMIN_RETURN_COOKIE = 'gmit_admin_return';

export const isInAdminMode = async () => (await cookies()).has(ADMIN_RETURN_COOKIE);
