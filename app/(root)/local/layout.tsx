import MarketGuard from "@/components/MarketGuard";

// Local Markets (LIMT) section: members of that department and the executives
export default function LocalLayout({ children }: { children: React.ReactNode }) {
    return <MarketGuard market="local">{children}</MarketGuard>;
}
