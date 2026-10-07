import { cache } from 'react';
import { connection } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { DashboardSettings } from '@/database/models/dashboard-settings.model';
import { Announcement } from '@/database/models/announcement.model';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { LOCAL_STOCKS, MARKETS, type LocalStock, type MarketKey, type SummaryTab } from '@/lib/markets';

export type DashboardConfig = {
    hiddenSections: string[];
    summaryTabs: SummaryTab[];
    topStocks: string[];
    localStocks: LocalStock[];
    customized: { summaryTabs: boolean; topStocks: boolean; localStocks: boolean };
};

export const DEFAULT_TOP_STOCKS: Record<MarketKey, string[]> = {
    global: POPULAR_STOCK_SYMBOLS.slice(0, 10),
    local: LOCAL_STOCKS.slice(0, 10).map((s) => s.symbol),
};

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// What a department's dashboard shows: the administrator's settings over the built-in defaults (read once per request)
export const getDashboardConfig = cache(async (market: MarketKey): Promise<DashboardConfig> => {
    // Settings are per request, so builds never touch the database
    await connection();
    let saved: { hiddenSections?: string[]; summaryTabs?: SummaryTab[]; topStocks?: string[]; localStocks?: LocalStock[] } | null = null;
    try {
        await connectToDatabase();
        saved = await DashboardSettings.findOne({ market }).lean();
    } catch (e) {
        console.error('getDashboardConfig error:', e);
    }
    // The JSE stock list lives with the Local settings but is used across the app
    const local = market === 'local' ? saved : await getLocalSettings();

    return {
        hiddenSections: saved?.hiddenSections ?? [],
        summaryTabs: saved?.summaryTabs?.length ? plain(saved.summaryTabs) : MARKETS[market].summaryTabs,
        topStocks: saved?.topStocks?.length ? [...saved.topStocks] : DEFAULT_TOP_STOCKS[market],
        localStocks: local?.localStocks?.length ? plain(local.localStocks) : LOCAL_STOCKS,
        customized: {
            summaryTabs: !!saved?.summaryTabs?.length,
            topStocks: !!saved?.topStocks?.length,
            localStocks: !!local?.localStocks?.length,
        },
    };
});

const getLocalSettings = cache(async () => {
    try {
        await connectToDatabase();
        return await DashboardSettings.findOne({ market: 'local' }, { localStocks: 1 }).lean();
    } catch (e) {
        console.error('getLocalSettings error:', e);
        return null;
    }
});

// The JSE stocks the Local section tracks (heatmap, quotes table, overview, search defaults)
export const getLocalStocks = cache(async (): Promise<LocalStock[]> => (await getDashboardConfig('local')).localStocks);

export const findLocalStock = async (symbol: string) => {
    const upper = symbol.toUpperCase();
    return (await getLocalStocks()).find((s) => s.symbol === upper) ?? LOCAL_STOCKS.find((s) => s.symbol === upper);
};

// Announcements shown on a department's dashboard, newest first
export const getDashboardAnnouncements = cache(async (market: MarketKey): Promise<AnnouncementView[]> => {
    await connection();
    try {
        await connectToDatabase();
        const rows = await Announcement.find({ audience: { $in: [market, 'both'] } }).sort({ createdAt: -1 }).limit(5).lean();
        return rows.map(toAnnouncementView);
    } catch (e) {
        console.error('getDashboardAnnouncements error:', e);
        return [];
    }
});

export const toAnnouncementView = (a: { _id: unknown; audience: AnnouncementView['audience']; title: string; message: string; postedBy: { name: string }; emailedTo?: number; createdAt: Date }): AnnouncementView => ({
    id: String(a._id),
    audience: a.audience,
    title: a.title,
    message: a.message,
    postedBy: a.postedBy?.name ?? 'Administrator',
    emailedTo: a.emailedTo ?? 0,
    createdAt: new Date(a.createdAt).toISOString(),
});
