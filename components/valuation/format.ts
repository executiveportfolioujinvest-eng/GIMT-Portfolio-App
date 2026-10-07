// Number formatting for the Valuation tab

const SYMBOLS: Record<string, string> = { USD: '$', ZAR: 'R', EUR: '€', GBP: '£' };
const ok = (v?: number | null): v is number => typeof v === 'number' && Number.isFinite(v);

export const money = (v?: number | null, currency = 'USD', compact = true) => {
    if (!ok(v)) return '—';
    const symbol = SYMBOLS[currency] ?? `${currency} `;
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    if (compact && abs >= 1e3) {
        const [div, unit] = abs >= 1e12 ? [1e12, 'tn'] : abs >= 1e9 ? [1e9, 'bn'] : abs >= 1e6 ? [1e6, 'm'] : [1e3, 'k'];
        return `${sign}${symbol}${(abs / div).toFixed(abs / div >= 100 ? 0 : 1)}${unit}`;
    }
    return `${sign}${symbol}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const pct = (v?: number | null, digits = 1) => (ok(v) ? `${(v * 100).toFixed(digits)}%` : '—');
export const signedPct = (v?: number | null, digits = 1) => (ok(v) ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%` : '—');
export const times = (v?: number | null, digits = 1) => (ok(v) ? `${v.toFixed(digits)}x` : '—');
export const count = (v?: number | null) => (ok(v) ? Math.round(v).toLocaleString('en-US') : '—');
export const date = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' }) : '—';
export const isNum = ok;
