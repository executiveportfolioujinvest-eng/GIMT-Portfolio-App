'use client';

import {useState} from "react";
import Link from "next/link";
import NewsList from "@/components/dashboard/NewsList";

type FeedTab = { key: NewsTab; label: string; href?: never } | { key?: never; label: string; href: string };

const DEFAULT_TABS: FeedTab[] = [
    { key: 'top', label: 'Top stories' },
    { key: 'local', label: 'Local market' },
    { key: 'world', label: 'World markets' },
];

type FinancialNewsProps = {
    news: Partial<Record<NewsTab, MarketNewsArticle[]>>;
    // A tab with an href links to another route (e.g. the LMIT news page) instead of switching feeds
    tabs?: FeedTab[];
    maxItems?: number;
    className?: string;
};

const FinancialNews = ({ news, tabs = DEFAULT_TABS, maxItems = 8, className = 'max-h-[640px]' }: FinancialNewsProps) => {
    const firstFeed = tabs.find((t) => t.key)?.key ?? 'top';
    const [tab, setTab] = useState<NewsTab>(firstFeed);

    return (
        <section className="dash-panel flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="News feed">
                {tabs.map((t) => t.href ? (
                    <Link key={t.label} href={t.href} className="chip-tab">
                        {t.label} &rarr;
                    </Link>
                ) : (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={t.key === tab}
                        data-active={t.key === tab}
                        className="chip-tab"
                        onClick={() => t.key && setTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className={`overflow-y-auto scrollbar-hide-default ${className}`}>
                <NewsList articles={(news[tab] ?? []).slice(0, maxItems)} />
            </div>
        </section>
    );
};

export default FinancialNews;
