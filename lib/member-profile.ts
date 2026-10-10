// Background every analyst and portfolio manager gives at sign-up, for the portfolio managers to review.
// Shared by the sign-up form and the server so both apply the same rules.

export const YEAR_OF_STUDY_OPTIONS = [
    { value: '1st_year', label: '1st Year' },
    { value: '2nd_year', label: '2nd Year' },
    { value: '3rd_year', label: '3rd Year' },
    { value: '4th_year', label: '4th Year' },
    { value: 'honours', label: 'Honours' },
    { value: 'postgraduate_diploma', label: 'Postgraduate Diploma' },
    { value: 'masters', label: "Master's" },
    { value: 'doctorate', label: 'Doctorate (PhD)' },
    { value: 'completed', label: 'Completed' },
] as const satisfies readonly Option[];

// How much hands-on experience the member has, rated at sign-up
export const EXPERIENCE_LEVELS = [
    { value: 'none', label: 'No experience' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
] as const satisfies readonly Option[];

// What the member wants to work on as an analyst (these replaced Signalist's investor questions)
export const ANALYSIS_APPROACH_OPTIONS = [
    { value: 'fundamental', label: 'Fundamental analysis' },
    { value: 'technical', label: 'Technical analysis' },
    { value: 'quantitative', label: 'Quantitative analysis' },
    { value: 'macro', label: 'Macro (top-down) analysis' },
    { value: 'mixed', label: 'A mix of approaches' },
] as const satisfies readonly Option[];

export const ASSET_CLASS_OPTIONS = [
    { value: 'equities', label: 'Equities' },
    { value: 'fixed_income', label: 'Fixed income' },
    { value: 'currencies', label: 'Currencies (FX)' },
    { value: 'commodities', label: 'Commodities' },
    { value: 'derivatives', label: 'Derivatives' },
    { value: 'multi_asset', label: 'Multi-asset' },
] as const satisfies readonly Option[];

export const COVERAGE_SECTOR_OPTIONS = [
    { value: 'financials', label: 'Financials' },
    { value: 'resources', label: 'Resources and mining' },
    { value: 'technology', label: 'Technology' },
    { value: 'telecommunications', label: 'Telecommunications' },
    { value: 'consumer', label: 'Consumer' },
    { value: 'industrials', label: 'Industrials' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'energy', label: 'Energy' },
    { value: 'real_estate', label: 'Real estate' },
] as const satisfies readonly Option[];

export const optionLabel = (options: readonly Option[], value?: string | null) => options.find((o) => o.value === value)?.label;

export const isExperienceLevel = (value: unknown): value is ExperienceLevel => EXPERIENCE_LEVELS.some((l) => l.value === value);

export const DEFAULT_UNIVERSITY = 'University of Johannesburg';
export const DEFAULT_UNIVERSITY_COUNTRY = 'ZA';
export const MAX_EDUCATION_ENTRIES = 5;
export const GOAL_MAX_LENGTH = 1000;
// Career goals, goals for the year and skills are lists the member adds to one at a time
export const MAX_LIST_ITEMS = 10;
export const LIST_ITEM_MAX_LENGTH = 200;

export const emptyEducation = (): EducationEntry => ({
    degree: '',
    institution: DEFAULT_UNIVERSITY,
    institutionCountry: DEFAULT_UNIVERSITY_COUNTRY,
    yearOfStudy: '' as YearOfStudy,
});

export const isYearOfStudy = (value: unknown): value is YearOfStudy =>
    YEAR_OF_STUDY_OPTIONS.some((o) => o.value === value);

const LINKEDIN_PROFILE = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(in|pub)\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i;

// Accepts any linkedin.com/in/... link (with or without https://www.) and returns a clean profile URL
export const normalizeLinkedInUrl = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(LINKEDIN_PROFILE);
    return match ? `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}` : null;
};

const cleanText = (value: unknown, max: number) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const cleanGoal = (value: unknown) =>
    typeof value === 'string' ? value.trim().replace(/\n{3,}/g, '\n\n').slice(0, GOAL_MAX_LENGTH) : '';

const parseEducation = (value: unknown): EducationEntry[] => {
    const entries = Array.isArray(value) ? value : [];
    if (entries.length === 0) throw new Error('Add at least one education entry');
    if (entries.length > MAX_EDUCATION_ENTRIES) throw new Error(`Add at most ${MAX_EDUCATION_ENTRIES} education entries`);

    return entries.map((raw, i): EducationEntry => {
        const entry = (raw ?? {}) as Record<string, unknown>;
        const degree = cleanText(entry.degree, 120);
        const institution = cleanText(entry.institution, 160);
        const institutionCountry = cleanText(entry.institutionCountry, 2).toUpperCase();
        const n = entries.length > 1 ? ` for education ${i + 1}` : '';
        if (!degree) throw new Error(`Enter the degree${n}`);
        if (!institution) throw new Error(`Select the university${n}`);
        if (!isYearOfStudy(entry.yearOfStudy)) throw new Error(`Select the year of study${n}`);
        return { degree, institution, institutionCountry: /^[A-Z]{2}$/.test(institutionCountry) ? institutionCountry : '', yearOfStudy: entry.yearOfStudy };
    });
};

// A list of short entries. Profiles from before the lists arrived hold one block of text, read as a single entry.
export const readList = (value: unknown): string[] => {
    let items = value;
    if (typeof items === 'string') {
        try {
            items = items.trim().startsWith('[') ? JSON.parse(items) : [items];
        } catch {
            items = [items];
        }
    }
    return Array.isArray(items)
        ? items.map((v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')).filter(Boolean)
        : [];
};

const requiredList = (noun: string, empty: string) => (value: unknown): string[] => {
    const items = readList(value).map((v) => v.slice(0, LIST_ITEM_MAX_LENGTH));
    if (items.length === 0) throw new Error(empty);
    if (items.length > MAX_LIST_ITEMS) throw new Error(`Add at most ${MAX_LIST_ITEMS} ${noun}`);
    return items;
};

const requiredChoice = <T extends string>(options: readonly { value: T }[], message: string) => (value: unknown): T => {
    const option = options.find((o) => o.value === value);
    if (!option) throw new Error(message);
    return option.value;
};

const requiredGoal = (message: string) => (value: unknown) => {
    const goal = cleanGoal(value);
    if (!goal) throw new Error(message);
    return goal;
};

// Birthdays are kept as month and day only ('MM-DD'): enough for the birthday emails, without anyone's age
export const MONTH_OPTIONS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
].map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }));

// 29 February is allowed; in other years it's celebrated on the 28th
export const daysInMonth = (month: string) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(month) - 1] ?? 31;

export const parseBirthday = (value: unknown): string => {
    const match = typeof value === 'string' ? value.trim().match(/^(\d{2})-(\d{2})$/) : null;
    if (!match) throw new Error('Select your birthday (month and day)');
    const [, month, day] = match;
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth(month)) {
        throw new Error('That birthday isn’t a real date');
    }
    return `${month}-${day}`;
};

export const formatBirthday = (birthday?: string | null) => {
    const match = birthday?.match(/^(\d{2})-(\d{2})$/);
    if (!match) return null;
    return `${Number(match[2])} ${MONTH_OPTIONS[Number(match[1]) - 1]?.label ?? ''}`;
};

// The birthdays to celebrate on a date in South African time ('MM-DD'); 29 February birthdays move to the
// 28th when it isn't a leap year
export const birthdaysOn = (date: Date): string[] => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(date)
        .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    const today = `${parts.month}-${parts.day}`;
    const year = Number(parts.year);
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return today === '02-28' && !leap ? ['02-28', '02-29'] : [today];
};

const PROFILE_PARSERS: { [K in keyof MemberProfile]: (value: unknown) => MemberProfile[K] } = {
    birthday: parseBirthday,
    education: parseEducation,
    careerGoals: requiredList('career goals', 'Add at least one career goal'),
    yearGoals: requiredList('goals for the year', 'Add at least one goal for this year'),
    skills: requiredList('skills', 'Add at least one skill'),
    tradingExperience: requiredChoice(EXPERIENCE_LEVELS, 'Rate your trading experience'),
    investmentManagementExperience: requiredChoice(EXPERIENCE_LEVELS, 'Rate your investment management experience'),
    analysisApproach: requiredChoice(ANALYSIS_APPROACH_OPTIONS, 'Select your preferred analysis approach'),
    assetClassFocus: requiredChoice(ASSET_CLASS_OPTIONS, 'Select the asset class you focus on'),
    coverageSector: requiredChoice(COVERAGE_SECTOR_OPTIONS, 'Select the sector you would like to cover'),
    learningGoals: requiredGoal('Tell us what you would like to learn from this experience'),
    linkedinUrl: (value) => {
        const url = normalizeLinkedInUrl(value);
        if (!url) throw new Error('Enter your LinkedIn profile link, e.g. https://www.linkedin.com/in/your-name');
        return url;
    },
};

const PROFILE_FIELDS = Object.keys(PROFILE_PARSERS) as (keyof MemberProfile)[];

// Validates and tidies the whole profile; throws a message the member can act on
export const parseMemberProfile = (input: Record<string, unknown>): MemberProfile =>
    Object.fromEntries(PROFILE_FIELDS.map((field) => [field, PROFILE_PARSERS[field](input[field])])) as MemberProfile;

// Same rules for an update that only changes some profile fields
export const parseProfileUpdate = (input: Record<string, unknown>): Partial<MemberProfile> =>
    Object.fromEntries(PROFILE_FIELDS.filter((field) => field in input).map((field) => [field, PROFILE_PARSERS[field](input[field])]));
