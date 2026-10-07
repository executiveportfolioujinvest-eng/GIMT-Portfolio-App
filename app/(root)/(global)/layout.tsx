import MarketGuard from "@/components/MarketGuard";

// Global Markets (GMIT) section: members of that department and the executives
export default function GlobalLayout({ children }: { children: React.ReactNode }) {
    return <MarketGuard market="global">{children}</MarketGuard>;
}
