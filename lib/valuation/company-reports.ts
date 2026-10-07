import type { FinancialPeriod, PeriodField, ReportDocument } from '@/lib/valuation/types';
import { PERIOD_FIELDS } from '@/lib/valuation/types';

// Finds a company's published results on its own website (investor relations pages) and reads the figures
// out of the PDFs with Gemini. Only the extracted numbers are kept, never the documents.

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MAX_PAGES = 14;
const MAX_PDF_BYTES = 14 * 1024 * 1024; // Gemini accepts up to 20 MB per request once base64-encoded
const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;
// Google retires model versions for new keys, so the alias for the current Flash model is the default
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

type Link = { url: string; text: string };

const fetchText = async (url: string): Promise<{ html: string; finalUrl: string } | null> => {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;
        return { html: (await res.text()).slice(0, 3_000_000), finalUrl: res.url };
    } catch {
        return null;
    }
};

const extractLinks = (html: string, base: string): Link[] =>
    [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((m) => {
        try {
            const url = new URL(m[1].replace(/&amp;/g, '&'), base);
            if (!/^https?:$/.test(url.protocol)) return [];
            return [{ url: url.href, text: m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim() }];
        } catch {
            return [];
        }
    });

// discovery.co.za from www.discovery.co.za; apple.com from investor.apple.com
const siteRoot = (host: string) => {
    const parts = host.replace(/^www\./, '').split('.');
    const secondLevel = parts.length > 2 && /^(co|com|org|net|gov|ac)$/.test(parts[parts.length - 2]);
    return parts.slice(secondLevel ? -3 : -2).join('.');
};

const PAGE_WORDS: [RegExp, number][] = [
    [/investor/i, 4], [/result/i, 3], [/financial/i, 2], [/report/i, 2], [/annual/i, 2], [/interim/i, 2],
    [/shareholder/i, 1], [/publication/i, 1], [/reporting/i, 1], [/sens\b/i, 1],
];
const pageScore = (l: Link) => PAGE_WORDS.reduce((s, [re, w]) => s + (re.test(`${l.url} ${l.text}`) ? w : 0), 0);

const EXCLUDE = /presentation|slides|esg|sustainab|climate|remuneration|governance|notice|proxy|faq|ifrs-?17|capital-markets|tax-|transformation|b-?bbee|social|policy|charter|circular|prospectus|pricing-supplement|programme|analyst|webcast|transcript|green|bank-reports|annexure|glossary/i;
const INTERIM = /interim|half[-_ ]?year|\bh1\b|1h\d{2}|six[-_ ]months|6[-_ ]months/i;
const ANNUAL = /annual|full[-_ ]?year|\bfy|final|audited|provisional|booklet|financial[-_ ]statements|\bafs\b|integrated|results/i;
// Names that say outright the document covers the full financial year
const FULL_YEAR = /(^|[^a-z])fy([-_ ]?\d{2,4})?([^a-z]|$)|annual|full[-_ ]?year|year[-_ ]end/i;

// Smaller summary documents read faster and contain the full statements
const rank = (l: Link) => {
    const s = `${l.url} ${l.text}`;
    if (/booklet|annual[-_ ]results|results[-_ ]announcement|provisional|summary|results-final|final[-_ ]results/i.test(s)) return 1;
    if (/financial[-_ ]statements|\bafs\b/i.test(s)) return 2;
    if (/integrated|annual[-_ ]report/i.test(s)) return 3;
    return 4;
};

const yearOf = (l: Link, now: number) => {
    const s = `${l.url} ${l.text}`;
    const fy = s.match(/fy[-_ ]?(20)?(\d{2})(?!\d)/i);
    const candidates = [...s.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
    if (fy) candidates.push(2000 + Number(fy[2]));
    const valid = candidates.filter((y) => y >= 2000 && y <= now + 1);
    return valid.length ? Math.max(...valid) : undefined;
};

// Crawls the company's investor pages and picks the results document for each of the last five years,
// plus the latest interim (half-year) results
export const discoverReports = async (website: string): Promise<{ documents: ReportDocument[]; pagesVisited: string[] }> => {
    const start = new URL(/^https?:/.test(website) ? website : `https://${website}`);
    const root = siteRoot(start.hostname);
    const origin = start.origin;
    const queue: { url: string; score: number }[] = [
        { url: origin, score: 10 },
        ...['/investors', '/investor-relations', '/corporate/investor-relations', '/investor-centre', '/investors/financial-results', '/investor-relations/financial-results']
            .map((p) => ({ url: `${origin}${p}`, score: 5 })),
        { url: `https://investors.${root}`, score: 4 },
        { url: `https://ir.${root}`, score: 4 },
    ];
    const visited = new Set<string>();
    const pdfs = new Map<string, Link>();
    const now = new Date().getFullYear();

    while (queue.length && visited.size < MAX_PAGES) {
        queue.sort((a, b) => b.score - a.score);
        const next = queue.shift()!;
        if (visited.has(next.url)) continue;
        visited.add(next.url);

        const page = await fetchText(next.url);
        if (!page) continue;
        for (const link of extractLinks(page.html, page.finalUrl)) {
            let host: string;
            try { host = new URL(link.url).hostname; } catch { continue; }
            if (!host.endsWith(root)) continue;
            if (/\.pdf($|\?)/i.test(link.url)) {
                if (!pdfs.has(link.url) || (!pdfs.get(link.url)!.text && link.text)) pdfs.set(link.url, link);
                continue;
            }
            const score = pageScore(link);
            if (score >= 3 && !visited.has(link.url) && !queue.some((q) => q.url === link.url)) queue.push({ url: link.url, score });
        }
    }

    // Classify each document. Many companies publish the full-year and half-year results under the same name,
    // marking only the full-year one ("results-booklet-fy-2024" vs "results-booklet"); in a year that has a
    // marked full-year document, the unmarked one is the half year.
    const candidates = [...pdfs.values()].flatMap((link) => {
        const s = `${link.url} ${link.text}`;
        const year = yearOf(link, now);
        if (EXCLUDE.test(s) || !year) return [];
        const kind = INTERIM.test(s) ? 'interim' as const : FULL_YEAR.test(s) ? 'annual' as const : ANNUAL.test(s) ? 'unmarked' as const : null;
        return kind ? [{ ...link, year, kind }] : [];
    });
    const yearsWithMarkedAnnual = new Set(candidates.filter((c) => c.kind === 'annual').map((c) => c.year));

    // Best document per (type, year)
    const best = new Map<string, Link & { year: number; type: 'annual' | 'interim' }>();
    for (const link of candidates) {
        const type: 'annual' | 'interim' = link.kind === 'unmarked' ? (yearsWithMarkedAnnual.has(link.year) ? 'interim' : 'annual') : link.kind;
        const year = link.year;
        const key = `${type}|${year}`;
        const seen = best.get(key);
        if (!seen || rank(link) < rank(seen) || (rank(link) === rank(seen) && link.url.length < seen.url.length)) {
            best.set(key, { ...link, year, type });
        }
    }

    const annual = [...best.values()].filter((d) => d.type === 'annual').sort((a, b) => b.year - a.year).slice(0, 5);
    const latestAnnual = annual[0]?.year ?? 0;
    const interim = [...best.values()].filter((d) => d.type === 'interim' && d.year >= latestAnnual).sort((a, b) => b.year - a.year).slice(0, 1);

    const documents: ReportDocument[] = [...interim, ...annual].map((d) => ({
        url: d.url,
        title: d.text && !/^pdf$/i.test(d.text) ? d.text : decodeURIComponent(d.url.split('/').pop() ?? 'Results').replace(/\.pdf.*$/i, '').replace(/[-_]+/g, ' '),
        year: d.year,
        type: d.type,
        status: 'pending',
    }));

    return { documents, pagesVisited: [...visited] };
};

const NUMBER = { type: 'NUMBER', nullable: true };
const OUTFLOW_FIELDS = new Set<string>(['capex', 'interestExpense', 'dividendsPaid']);
const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        currency: { type: 'STRING', nullable: true },
        amountsUnit: { type: 'STRING', enum: ['units', 'thousands', 'millions', 'billions'] },
        perShareUnit: { type: 'STRING', enum: ['currency', 'cents'] },
        sharesUnit: { type: 'STRING', enum: ['units', 'thousands', 'millions', 'billions'] },
        periods: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    periodEnd: { type: 'STRING' },
                    months: { type: 'INTEGER' },
                    ...Object.fromEntries(PERIOD_FIELDS.filter((f) => f !== 'freeCashFlow').map((f) => [f, NUMBER])),
                },
                required: ['periodEnd', 'months'],
            },
        },
    },
    required: ['amountsUnit', 'perShareUnit', 'periods'],
};

const PROMPT = `You are given pages from a listed company's published financial results. Extract the consolidated (group) figures from its primary statements: the income statement, the statement of financial position (balance sheet) and the statement of cash flows, plus the per-share figures.

Return one entry in "periods" for EVERY period column the statements show, normally the current period and the comparative period, so usually two entries. For each entry fill in every field below that the pages present.

Numbers: copy each figure exactly as printed (do not rescale it). Say what scale the amounts are printed in with amountsUnit (for example "R million" or "Rm" means millions, "R'000" means thousands). Say whether earnings and dividends per share are printed in cents or in the main currency with perShareUnit. Write negative numbers as negatives. Use null for anything not shown; never estimate.

periodEnd is the last day of the period (YYYY-MM-DD) and months is its length (12 full year, 6 half year, 3 quarter).

Fields:
revenue: total revenue or total income as presented
grossProfit: gross profit
operatingIncome: operating profit or profit from operations
netIncome: profit attributable to ordinary shareholders (owners of the parent)
eps: diluted earnings per share (basic when diluted is not shown)
dps: ordinary dividend per share declared for the period
totalAssets / totalLiabilities: totals from the balance sheet
currentAssets / currentLiabilities: totals, when the balance sheet splits current and non-current
cash: cash and cash equivalents
totalDebt: interest-bearing borrowings, current and non-current together
equity: equity attributable to ordinary shareholders
operatingCashFlow: net cash from operating activities
capex: purchases of property, plant, equipment and intangible assets (as a positive number)
interestExpense: finance costs (as a positive number)
dividendsPaid: dividends paid to ordinary shareholders in the cash flow statement (as a positive number)
depreciation: depreciation and amortisation
shares: weighted average number of shares in issue, as printed; say its scale with sharesUnit (often thousands or millions)`;

// Thrown when Gemini is overloaded or rate-limited, so the document can be retried later
export class GeminiBusyError extends Error {}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

// Asks Gemini to read the document, moving to the next current model when one is busy. Kept under
// ~50 seconds so it fits in a single serverless request.
const askGemini = async (key: string, parts: GeminiPart[]) => {
    const models = [...new Set([GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-flash-latest'])];
    const deadline = Date.now() + 50_000;
    let lastError = 'Gemini is busy';

    for (const model of models) {
        const remaining = deadline - Date.now();
        if (remaining < 8_000) break;
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                signal: AbortSignal.timeout(remaining),
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
                }),
            });
            if (res.ok) {
                const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
                return body.candidates?.[0]?.content?.parts?.map((p) => ('text' in p ? p.text ?? '' : '')).join('') ?? '';
            }
            const detail = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? '';
            lastError = `Gemini ${model}: ${res.status} ${detail.slice(0, 120)}`.trim();
            // Busy, rate-limited or retired for this key: try the next model; anything else is a real failure
            if (![404, 429, 500, 503].includes(res.status)) throw new Error(`Gemini could not read the document (${lastError})`);
        } catch (e) {
            if (e instanceof Error && e.name !== 'TimeoutError' && !e.message.startsWith('fetch failed')) throw e;
            lastError = `Gemini ${model} timed out`;
        }
    }
    throw new GeminiBusyError(lastError);
};

// Pages that hold the primary statements and per-share figures
const STATEMENT_WORDS: [RegExp, number][] = [
    [/statement of financial position|balance sheet/i, 5],
    [/income statement|statement of profit or loss|statement of comprehensive income/i, 5],
    [/statement of cash flows|cash flow statement/i, 5],
    [/earnings per share/i, 3],
    [/total assets/i, 3],
    [/total liabilities/i, 3],
    [/operating activities|cash generated from operations/i, 3],
    [/dividend/i, 1],
    [/attributable to (ordinary )?(share|equity )holders/i, 2],
    [/headline earnings/i, 2],
];
const MAX_PAGES_SENT = 6;
const MAX_CHARS_PER_PAGE = 9_000;

// Statement pages are dense with figures; contents and commentary pages mention the same titles but hold few
// numbers, so the keyword score is weighted by how many figures the page carries
const statementPages = (pages: string[]) =>
    pages
        .map((text, i) => {
            const keywords = STATEMENT_WORDS.reduce((s, [re, w]) => s + (re.test(text) ? w : 0), 0);
            const figures = (text.match(/\(?\d[\d ,]{2,}\)?/g) ?? []).length;
            return { i, text, keywords, score: keywords + Math.min(figures / 15, 8) };
        })
        .filter((p) => p.keywords >= 5 && p.text.length > 200)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_PAGES_SENT)
        .sort((a, b) => a.i - b.i);

// Downloads one results PDF, finds its statement pages and asks Gemini for the figures; returns the periods found
export const readReport = async (doc: ReportDocument): Promise<{ periods: FinancialPeriod[]; currency?: string; pagesRead?: number }> => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set');

    const res = await fetch(doc.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(25_000), cache: 'no-store' });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const size = Number(res.headers.get('content-length') ?? 0);
    if (size > MAX_DOWNLOAD_BYTES) throw new Error(`Document too large to read (${Math.round(size / 1024 / 1024)} MB)`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error(`Document too large to read (${Math.round(bytes.length / 1024 / 1024)} MB)`);
    if (Buffer.from(bytes.subarray(0, 4)).toString() !== '%PDF') throw new Error('Not a PDF document');

    // Reading the text ourselves and sending only the statement pages is far faster than sending the whole PDF
    let parts: GeminiPart[];
    let pagesRead: number | undefined;
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes.slice());
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = statementPages(text as string[]);
    if (pages.length) {
        pagesRead = pages.length;
        const body = pages.map((p) => `--- Page ${p.i + 1} ---\n${p.text.slice(0, MAX_CHARS_PER_PAGE)}`).join('\n\n');
        parts = [{ text: `${PROMPT}\n\nDocument pages:\n${body}` }];
    } else if (bytes.length <= MAX_PDF_BYTES) {
        // Scanned documents have no text layer, so Gemini reads the PDF itself
        parts = [{ inline_data: { mime_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') } }, { text: PROMPT }];
    } else {
        throw new Error('No financial statements found in the document');
    }

    const textOut = await askGemini(key, parts);
    const parsed = JSON.parse(textOut) as { currency?: string | null; amountsUnit?: string; perShareUnit?: string; sharesUnit?: string; periods?: Record<string, unknown>[] };
    const scale = { units: 1, thousands: 1e3, millions: 1e6, billions: 1e9 }[parsed.amountsUnit ?? 'units'] ?? 1;
    const perShareScale = parsed.perShareUnit === 'cents' ? 0.01 : 1;
    const sharesScale = { units: 1, thousands: 1e3, millions: 1e6, billions: 1e9 }[parsed.sharesUnit ?? 'units'] ?? 1;

    const source = { kind: 'company' as const, label: doc.title, url: doc.url };
    const periods = (parsed.periods ?? []).flatMap((p): FinancialPeriod[] => {
        const end = typeof p.periodEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.periodEnd) ? p.periodEnd : null;
        const months = Number(p.months);
        if (!end || ![3, 6, 12].includes(months)) return [];
        const period: FinancialPeriod = { kind: months === 12 ? 'annual' : months === 6 ? 'interim' : 'quarter', end, months, sources: [source] };
        for (const field of PERIOD_FIELDS) {
            const value = p[field];
            if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            const factor = field === 'eps' || field === 'dps' ? perShareScale : field === 'shares' ? sharesScale : scale;
            period[field as PeriodField] = (OUTFLOW_FIELDS.has(field) ? Math.abs(value) : value) * factor as never;
        }
        if (period.operatingCashFlow != null) period.freeCashFlow = period.operatingCashFlow - (period.capex ?? 0);
        // A balance sheet where equity exceeds assets means the units were misread; drop the period
        if (period.totalAssets != null && period.equity != null && period.equity > period.totalAssets) return [];
        return [period];
    });

    return { periods, currency: parsed.currency ?? undefined, pagesRead };
};
