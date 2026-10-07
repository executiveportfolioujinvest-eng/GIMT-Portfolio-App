import Header from "@/components/Header";
import {getSessionUser} from "@/lib/better-auth/session";
import {redirect} from "next/navigation";

const Layout = async ({ children }: { children : React.ReactNode }) => {
    const user = await getSessionUser();

    if(!user) redirect('/sign-in');

    return (
        <main className="min-h-screen text-gray-400">
            <Header user={user} />

            <div className="container py-10">
                {children}
            </div>
        </main>
    )
}
export default Layout
