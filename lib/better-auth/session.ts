import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "@/lib/better-auth/auth";

// Signed-in user for the current request, or null when signed out (looked up once per request)
export const getSessionUser = cache(async (): Promise<User | null> => {
    // Read the request first: it marks the page as per-request, so builds never touch the database
    const requestHeaders = await headers();
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user) return null;

    return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        department: session.user.department === 'local' ? 'local' : 'global',
        teamRole: session.user.teamRole as TeamRole | undefined,
    };
});
