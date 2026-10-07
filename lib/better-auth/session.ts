import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";

// Signed-in user for the current request, or null when signed out
export const getSessionUser = async (): Promise<User | null> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;

    return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        department: session.user.department === 'local' ? 'local' : 'global',
        teamRole: session.user.teamRole as TeamRole | undefined,
    };
}
