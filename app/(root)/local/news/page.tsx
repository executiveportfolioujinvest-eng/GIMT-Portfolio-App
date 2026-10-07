import NewsPage from "@/components/pages/NewsPage";

export const metadata = { title: "Local News | GMIT Portfolio" };

export default function LocalNews() {
    return <NewsPage market="local" />;
}
