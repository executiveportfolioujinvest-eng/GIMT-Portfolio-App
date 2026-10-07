'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { getSessionUser } from '@/lib/better-auth/session';
import { connectToDatabase } from '@/database/mongoose';
import { DashboardSettings } from '@/database/models/dashboard-settings.model';
import { Announcement } from '@/database/models/announcement.model';
import { createAccount, deleteAccount, getUserCollection, seatTaken, toMemberView, toObjectId, validateNewAccount } from '@/lib/accounts';
import { getDashboardConfig, toAnnouncementView } from '@/lib/dashboard-config';
import { getYahooQuote } from '@/lib/actions/yahoo.actions';
import { sendAnnouncementEmail } from '@/lib/nodemailer';
import { recordAdminActivity } from '@/lib/admin-activity';
import {
    ADMIN_ROLE,
    DASHBOARD_SECTIONS,
    departmentLabel,
    isAdminRole,
    isDepartment,
    isMarketKey,
    isSignUpRole,
    LOCAL_SECTORS,
    marketHref,
    roleFitsDepartment,
    roleLabel,
    type LocalStock,
    type MarketKey,
    type SummaryTab,
} from '@/lib/markets';

type Result = { success: true; message?: string } | { success: false; error: string };

const fail = (error: string): Result => ({ success: false, error });
const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// Every administrator action starts here
const requireAdmin = async () => {
    const user = await getSessionUser();
    return user && isAdminRole(user.teamRole) ? user : null;
};

const refreshApp = () => revalidatePath('/', 'layout');

// ---------- Members ----------

export async function getMembers(): Promise<MemberView[]> {
    try {
        if (!(await requireAdmin())) return [];
        const users = await (await getUserCollection()).find({}).sort({ createdAt: -1 }).toArray();
        return users.map(toMemberView);
    } catch (e) {
        unstable_rethrow(e);
        console.error('getMembers error:', e);
        return [];
    }
}

// Department and role rules shared by adding and re-assigning members
const checkAccess = async (department: unknown, teamRole: unknown, memberId?: string): Promise<string | null> => {
    if (!isDepartment(department)) return 'Select a department';
    if (!isSignUpRole(teamRole)) return 'Select a role';
    if (!roleFitsDepartment(teamRole, department)) {
        return department === 'both' ? 'Only the President and Vice President belong to both portfolios' : 'That role belongs to another department';
    }
    if (await seatTaken(teamRole, memberId)) return `Someone already holds the ${roleLabel(teamRole)} role`;
    return null;
};

export async function addMember(input: { name: string; email: string; password: string; department: string; teamRole: string }): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can add members');
        const invalid = validateNewAccount(input) ?? (await checkAccess(input.department, input.teamRole));
        if (invalid) return fail(invalid);

        await createAccount({ ...input, teamRole: input.teamRole as TeamRole });
        await recordAdminActivity({
            action: 'member.add',
            summary: `Added ${input.name.trim()} (${input.email.trim().toLowerCase()}) as ${roleLabel(input.teamRole)}, ${departmentLabel(input.department)}`,
            admin,
        });
        refreshApp();
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('addMember error:', e);
        return fail(errorMessage(e, 'Failed to add the member'));
    }
}

export async function updateMemberAccess(memberId: string, { department, teamRole }: { department: string; teamRole: string }): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can change roles');

        const id = toObjectId(memberId);
        const users = await getUserCollection();
        const member = id && (await users.findOne({ _id: id }));
        if (!member) return fail('Member not found');
        if (isAdminRole(member.teamRole)) return fail('Administrator accounts are managed from an executive’s profile page');

        const invalid = await checkAccess(department, teamRole, memberId);
        if (invalid) return fail(invalid);

        // Written straight to the database: Better Auth blocks members from changing these on their own account
        await users.updateOne({ _id: id }, { $set: { department, teamRole, updatedAt: new Date() } });
        await recordAdminActivity({
            action: 'member.update',
            summary: `Changed ${member.name} (${member.email}) from ${roleLabel(member.teamRole)}, ${departmentLabel(member.department)} to ${roleLabel(teamRole)}, ${departmentLabel(department)}`,
            admin,
        });
        refreshApp();
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('updateMemberAccess error:', e);
        return fail('Failed to update the member');
    }
}

export async function removeMember(memberId: string): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can remove members');

        const id = toObjectId(memberId);
        const member = id && (await (await getUserCollection()).findOne({ _id: id }));
        if (!member) return fail('Member not found');
        if (isAdminRole(member.teamRole)) return fail('Administrator accounts are removed from an executive’s profile page');

        await deleteAccount(memberId);
        await recordAdminActivity({
            action: 'member.remove',
            summary: `Removed ${member.name} (${member.email}), ${roleLabel(member.teamRole)}, ${departmentLabel(member.department)}`,
            admin,
        });
        refreshApp();
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('removeMember error:', e);
        return fail('Failed to remove the member');
    }
}

// ---------- Dashboards ----------

const saveSettings = async (
    market: MarketKey,
    update: { $set?: Record<string, unknown>; $unset?: Record<string, 1> },
    admin: { id: string; name: string }
) => {
    await connectToDatabase();
    await DashboardSettings.updateOne(
        { market },
        { ...update, $set: { ...update.$set, updatedBy: { id: admin.id, name: admin.name, at: new Date() } } },
        { upsert: true }
    );
    refreshApp();
};

export async function saveDashboardSections(market: MarketKey, hiddenSections: string[]): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can change the dashboards');
        if (!isMarketKey(market)) return fail('Unknown department');

        const known = new Set(DASHBOARD_SECTIONS[market].map((s) => s.key));
        const hidden = [...new Set(hiddenSections)].filter((k) => known.has(k));
        await saveSettings(market, { $set: { hiddenSections: hidden } }, admin);
        const hiddenLabels = DASHBOARD_SECTIONS[market].filter((s) => hidden.includes(s.key)).map((s) => s.label);
        await recordAdminActivity({
            action: 'dashboard.sections',
            summary: `${departmentLabel(market)} dashboard: ${hiddenLabels.length ? `hidden ${hiddenLabels.join(', ')}` : 'all sections shown'}`,
            admin,
        });
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('saveDashboardSections error:', e);
        return fail('Failed to save the dashboard sections');
    }
}

const SYMBOL = /^[\^A-Z0-9][A-Z0-9.=\-^]{0,19}$/;
const JSE_SYMBOL = /^[A-Z0-9]{2,6}$/;

// Symbols Yahoo Finance can't quote would leave empty rows, so they're rejected with their names
const unquotable = async (yahooSymbols: string[]) => {
    const quotes = await Promise.all(yahooSymbols.map((s) => getYahooQuote(s, 0).catch(() => null)));
    return yahooSymbols.filter((_, i) => !quotes[i]);
};

export async function saveSummaryTabs(market: MarketKey, tabs: SummaryTab[]): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can change the dashboards');
        if (!isMarketKey(market)) return fail('Unknown department');

        const clean: SummaryTab[] = (tabs ?? []).map((tab) => ({
            label: String(tab.label ?? '').trim().slice(0, 20),
            symbols: (tab.symbols ?? []).map((s) => {
                const symbol = String(s.symbol ?? '').trim().toUpperCase();
                return {
                    symbol,
                    label: String(s.label ?? '').trim().slice(0, 30) || symbol,
                    badge: String(s.badge ?? '').trim().slice(0, 6) || symbol.replace(/[^A-Z0-9]/g, '').slice(0, 6),
                };
            }).filter((s) => s.symbol),
        }));

        if (clean.length === 0 || clean.length > 8) return fail('Market Summary needs between 1 and 8 tabs');
        for (const tab of clean) {
            if (!tab.label) return fail('Every tab needs a name');
            if (tab.symbols.length === 0 || tab.symbols.length > 6) return fail(`“${tab.label}” needs between 1 and 6 symbols`);
            const bad = tab.symbols.find((s) => !SYMBOL.test(s.symbol));
            if (bad) return fail(`“${bad.symbol}” isn’t a valid symbol`);
        }

        const current = new Set((await getDashboardConfig(market)).summaryTabs.flatMap((t) => t.symbols.map((s) => s.symbol)));
        const missing = await unquotable([...new Set(clean.flatMap((t) => t.symbols.map((s) => s.symbol)))].filter((s) => !current.has(s)));
        if (missing.length) return fail(`No price data found for ${missing.join(', ')}. Use Yahoo Finance symbols, e.g. ^GSPC or NPN.JO.`);

        await saveSettings(market, { $set: { summaryTabs: clean } }, admin);
        await recordAdminActivity({
            action: 'dashboard.summary',
            summary: `${departmentLabel(market)} Market Summary set to ${clean.map((t) => `${t.label} (${t.symbols.map((s) => s.symbol).join(', ')})`).join('; ')}`,
            admin,
        });
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('saveSummaryTabs error:', e);
        return fail('Failed to save Market Summary');
    }
}

export async function saveTopStocks(market: MarketKey, symbols: string[]): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can change the dashboards');
        if (!isMarketKey(market)) return fail('Unknown department');

        const clean = [...new Set((symbols ?? []).map((s) => String(s).trim().toUpperCase().replace(/\.JO$/, '')).filter(Boolean))];
        if (clean.length === 0 || clean.length > 20) return fail("Today's Top Stocks needs between 1 and 20 stocks");
        const pattern = market === 'local' ? JSE_SYMBOL : SYMBOL;
        const bad = clean.find((s) => !pattern.test(s));
        if (bad) return fail(`“${bad}” isn’t a valid ${market === 'local' ? 'JSE ' : ''}symbol`);

        const current = new Set((await getDashboardConfig(market)).topStocks);
        const fresh = clean.filter((s) => !current.has(s));
        const missing = await unquotable(fresh.map((s) => (market === 'local' ? `${s}.JO` : s)));
        if (missing.length) return fail(`No price data found for ${missing.map((s) => s.replace(/\.JO$/, '')).join(', ')}`);

        await saveSettings(market, { $set: { topStocks: clean } }, admin);
        await recordAdminActivity({
            action: 'dashboard.top-stocks',
            summary: `${departmentLabel(market)} Today's Top Stocks set to ${clean.join(', ')}`,
            admin,
        });
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('saveTopStocks error:', e);
        return fail("Failed to save Today's Top Stocks");
    }
}

export async function saveLocalStocks(stocks: LocalStock[]): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can change the dashboards');

        const clean = (stocks ?? []).map((s) => ({
            symbol: String(s.symbol ?? '').trim().toUpperCase().replace(/\.JO$/, ''),
            name: String(s.name ?? '').trim().slice(0, 80),
            sector: String(s.sector ?? ''),
        }));
        if (clean.length < 5 || clean.length > 60) return fail('The JSE stock list needs between 5 and 60 stocks');
        const seen = new Set<string>();
        for (const s of clean) {
            if (!JSE_SYMBOL.test(s.symbol)) return fail(`“${s.symbol || '(blank)'}” isn’t a valid JSE symbol`);
            if (seen.has(s.symbol)) return fail(`${s.symbol} is listed twice`);
            seen.add(s.symbol);
            if (!s.name) return fail(`Enter the company name for ${s.symbol}`);
            if (!LOCAL_SECTORS.includes(s.sector)) return fail(`Choose a sector for ${s.symbol}`);
        }

        const current = new Set((await getDashboardConfig('local')).localStocks.map((s) => s.symbol));
        const missing = await unquotable(clean.filter((s) => !current.has(s.symbol)).map((s) => `${s.symbol}.JO`));
        if (missing.length) return fail(`No JSE price data found for ${missing.map((s) => s.replace(/\.JO$/, '')).join(', ')}`);

        await saveSettings('local', { $set: { localStocks: clean } }, admin);
        const added = clean.filter((s) => !current.has(s.symbol)).map((s) => s.symbol);
        const removed = [...current].filter((symbol) => !seen.has(symbol));
        await recordAdminActivity({
            action: 'dashboard.jse-list',
            summary: `JSE stock list updated (${clean.length} stocks)${added.length ? `; added ${added.join(', ')}` : ''}${removed.length ? `; removed ${removed.join(', ')}` : ''}`,
            admin,
        });
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('saveLocalStocks error:', e);
        return fail('Failed to save the JSE stock list');
    }
}

// Puts a list back to the built-in default
export async function resetDashboardList(market: MarketKey, list: 'summaryTabs' | 'topStocks' | 'localStocks'): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can change the dashboards');
        if (!isMarketKey(market) || !['summaryTabs', 'topStocks', 'localStocks'].includes(list)) return fail('Unknown list');

        await saveSettings(list === 'localStocks' ? 'local' : market, { $unset: { [list]: 1 } }, admin);
        const listLabel = { summaryTabs: 'Market Summary', topStocks: "Today's Top Stocks", localStocks: 'JSE stock list' }[list];
        await recordAdminActivity({
            action: 'dashboard.reset',
            summary: `${list === 'localStocks' ? '' : `${departmentLabel(market)} `}${listLabel} reset to the default`,
            admin,
        });
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('resetDashboardList error:', e);
        return fail('Failed to reset the list');
    }
}

// ---------- Announcements ----------

const AUDIENCE_LABEL = { global: 'Global Markets Department', local: 'Local Markets Department', both: 'Both departments' } as const;

export async function getAllAnnouncements(): Promise<AnnouncementView[]> {
    try {
        if (!(await requireAdmin())) return [];
        await connectToDatabase();
        const rows = await Announcement.find({}).sort({ createdAt: -1 }).limit(50).lean();
        return rows.map(toAnnouncementView);
    } catch (e) {
        unstable_rethrow(e);
        console.error('getAllAnnouncements error:', e);
        return [];
    }
}

// Posts to the chosen dashboards and emails the members of those departments
export async function postAnnouncement(input: { audience: string; title: string; message: string }): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can post announcements');

        const audience = input.audience;
        if (audience !== 'global' && audience !== 'local' && audience !== 'both') return fail('Choose who the announcement is for');
        const title = String(input.title ?? '').trim();
        const message = String(input.message ?? '').trim();
        if (!title) return fail('Enter a title');
        if (title.length > 120) return fail('Keep the title under 120 characters');
        if (!message) return fail('Enter a message');
        if (message.length > 2000) return fail('Keep the message under 2,000 characters');

        await connectToDatabase();
        const announcement = await Announcement.create({ audience, title, message, postedBy: { id: admin.id, name: admin.name } });
        await recordAdminActivity({ action: 'announcement.post', summary: `Posted “${title}” to ${AUDIENCE_LABEL[audience]}`, admin });
        refreshApp();

        // The President and Vice President ('both') hear about every department
        const departments = audience === 'both' ? ['global', 'local', 'both'] : [audience, 'both'];
        const recipients = (await (await getUserCollection())
            .find({ department: { $in: departments }, teamRole: { $ne: ADMIN_ROLE }, email: { $exists: true } }, { projection: { email: 1 } })
            .toArray()).map((u) => String(u.email));

        if (recipients.length === 0) return { success: true, message: 'Posted. No members to email yet.' };
        try {
            const emailed = await sendAnnouncementEmail({
                recipients,
                title,
                message,
                audienceLabel: AUDIENCE_LABEL[audience],
                dashboardPath: audience === 'local' ? marketHref('local', '/') : '/',
            });
            await Announcement.updateOne({ _id: announcement._id }, { $set: { emailedTo: emailed } });
            return { success: true, message: `Posted and emailed to ${emailed} member${emailed === 1 ? '' : 's'}.` };
        } catch (e) {
            console.error('postAnnouncement email error:', e);
            return { success: true, message: 'Posted on the dashboard, but the email could not be sent. Check the Gmail settings.' };
        }
    } catch (e) {
        unstable_rethrow(e);
        console.error('postAnnouncement error:', e);
        return fail('Failed to post the announcement');
    }
}

export async function deleteAnnouncement(id: string): Promise<Result> {
    try {
        const admin = await requireAdmin();
        if (!admin) return fail('Only administrators can remove announcements');
        await connectToDatabase();
        const removed = await Announcement.findOneAndDelete({ _id: toObjectId(id) }).lean();
        if (removed) {
            await recordAdminActivity({ action: 'announcement.remove', summary: `Removed the announcement “${removed.title}”`, admin });
        }
        refreshApp();
        return { success: true };
    } catch (e) {
        unstable_rethrow(e);
        console.error('deleteAnnouncement error:', e);
        return fail('Failed to remove the announcement');
    }
}
