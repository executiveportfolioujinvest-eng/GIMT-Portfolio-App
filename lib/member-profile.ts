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

export const DEFAULT_UNIVERSITY = 'University of Johannesburg';
export const DEFAULT_UNIVERSITY_COUNTRY = 'ZA';
export const MAX_EDUCATION_ENTRIES = 5;
export const GOAL_MAX_LENGTH = 1000;

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
    careerGoals: requiredGoal('Tell us your career goals'),
    yearGoals: requiredGoal('Tell us your goals for this year'),
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
