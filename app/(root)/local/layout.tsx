import MarketGuard from "@/components/MarketGuard";

// Pages in the Local section without a title of their own carry the LMIT name in the browser tab
export const metadata = { title: "LMIT Portfolio" };

// Local Markets (LMIT) section: members of that department and the executives
export default function LocalLayout({ children }: { children: React.ReactNode }) {
    return <MarketGuard market="local">{children}</MarketGuard>;
}
