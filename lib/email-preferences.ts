import {canAccessMarket, DEPUTY_ROLES, isAdminRole, isExecutiveRole, isOversightRole, type MarketKey} from "@/lib/markets";

// Every email the platform sends on its own (the one-off welcome email aside)
export type EmailAutomation =
    | 'newsGlobal'
    | 'newsLocal'
    | 'insiderGlobal'
    | 'insiderLocal'
    | 'alerts'
    | 'announcements'
    | 'birthdayWish'
    | 'birthdayReminders';

export type EmailPreferences = Partial<Record<EmailAutomation, boolean>>;

export const EMAIL_AUTOMATIONS: { key: EmailAutomation; label: string; description: string; market?: MarketKey }[] = [
    { key: 'newsGlobal', market: 'global', label: 'Global daily news summary', description: 'The day’s global market news, summarised every afternoon.' },
    { key: 'newsLocal', market: 'local', label: 'Local daily news summary', description: 'The day’s JSE and South African market news, summarised every afternoon.' },
    { key: 'insiderGlobal', market: 'global', label: 'GMIT Portfolio Insider', description: 'Every evening while the GMIT portfolio holds shares: the day’s news on its holdings, then on the global stocks you’ve starred.' },
    { key: 'insiderLocal', market: 'local', label: 'LMIT Portfolio Insider', description: 'Every evening while the LMIT portfolio holds shares: the day’s news on its holdings, then on the JSE stocks you’ve starred.' },
    { key: 'alerts', label: 'Price alerts', description: 'When a stock reaches a price alert you’ve set.' },
    { key: 'announcements', label: 'Announcements', description: 'Notices the administrators post for your department.' },
    { key: 'birthdayWish', label: 'Your birthday wish', description: 'A happy-birthday email from the team on your birthday.' },
    { key: 'birthdayReminders', label: 'Team birthday reminders', description: 'A reminder on each team member’s birthday.' },
];

export const isEmailAutomation = (value: unknown): value is EmailAutomation => EMAIL_AUTOMATIONS.some((a) => a.key === value);

export const NEWS_AUTOMATION: Record<MarketKey, EmailAutomation> = { global: 'newsGlobal', local: 'newsLocal' };
export const INSIDER_AUTOMATION: Record<MarketKey, EmailAutomation> = { global: 'insiderGlobal', local: 'insiderLocal' };

// Portfolio managers (executive and deputy), the President and Vice President switch their emails on and off;
// everyone else gets the set that comes with their department
export const canChooseEmails = (role: unknown): boolean =>
    isExecutiveRole(role) || Object.values(DEPUTY_ROLES).includes(role as TeamRole) || isOversightRole(role);

type Member = { department?: string | null; teamRole?: string | null; emailPreferences?: unknown };

export type EmailSetting = { key: EmailAutomation; label: string; description: string; on: boolean; locked: boolean };

// The emails a member can get and whether each is on. Market emails are offered for the sections the member can
// open, and start on for their own department (both departments for the President and Vice President).
export const emailSettingsFor = (member: Member): EmailSetting[] => {
    if (isAdminRole(member.teamRole)) return [];
    const choose = canChooseEmails(member.teamRole);
    const stored = (member.emailPreferences && typeof member.emailPreferences === 'object' ? member.emailPreferences : {}) as EmailPreferences;

    return EMAIL_AUTOMATIONS
        .filter((a) => !a.market || canAccessMarket(member, a.market))
        .map((a) => {
            const byDefault = !a.market || member.department === 'both' || member.department === a.market;
            const choice = stored[a.key];
            return { key: a.key, label: a.label, description: a.description, on: choose && typeof choice === 'boolean' ? choice : byDefault, locked: !choose };
        });
};

export const wantsEmail = (member: Member, key: EmailAutomation): boolean =>
    emailSettingsFor(member).some((s) => s.key === key && s.on);
