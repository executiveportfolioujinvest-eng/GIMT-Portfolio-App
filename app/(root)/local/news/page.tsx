import NewsPage from "@/components/pages/NewsPage";

export const metadata = { title: "Local News | LMIT Portfolio" };

export default function LocalNews() {
    return <NewsPage market="local" />;
}
