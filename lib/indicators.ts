// Standard technical indicators, computed from closing prices. Each returns one value per bar
// (null until there's enough history for the first value).

export const sma = (values: number[], period: number): (number | null)[] => {
    let sum = 0;
    return values.map((v, i) => {
        sum += v;
        if (i >= period) sum -= values[i - period];
        return i >= period - 1 ? sum / period : null;
    });
};

export const ema = (values: number[], period: number): (number | null)[] => {
    const k = 2 / (period + 1);
    let prev: number | null = null;
    return values.map((v, i) => {
        if (i < period - 1) return null;
        if (prev == null) {
            prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
            return prev;
        }
        prev = v * k + prev * (1 - k);
        return prev;
    });
};

// Bollinger Bands: the 20-bar average with bands two standard deviations either side
export const bollinger = (values: number[], period = 20, width = 2) => {
    const mid = sma(values, period);
    return values.map((_, i) => {
        const m = mid[i];
        if (m == null) return { upper: null, middle: null, lower: null };
        const slice = values.slice(i - period + 1, i + 1);
        const sd = Math.sqrt(slice.reduce((a, v) => a + (v - m) ** 2, 0) / period);
        return { upper: m + width * sd, middle: m, lower: m - width * sd };
    });
};

// Relative Strength Index with Wilder's smoothing (0 to 100; above 70 is often read as overbought, below 30 oversold)
export const rsi = (values: number[], period = 14): (number | null)[] => {
    const out: (number | null)[] = values.map(() => null);
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        const up = Math.max(change, 0);
        const down = Math.max(-change, 0);
        if (i <= period) {
            gain += up / period;
            loss += down / period;
            if (i === period) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
        } else {
            gain = (gain * (period - 1) + up) / period;
            loss = (loss * (period - 1) + down) / period;
            out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
        }
    }
    return out;
};

// MACD: the gap between the 12- and 26-bar exponential averages, its 9-bar signal line, and the histogram between them
export const macd = (values: number[], fast = 12, slow = 26, signalPeriod = 9) => {
    const fastE = ema(values, fast);
    const slowE = ema(values, slow);
    const line = values.map((_, i) => (fastE[i] != null && slowE[i] != null ? fastE[i]! - slowE[i]! : null));
    const firstValid = line.findIndex((v) => v != null);
    const signalRaw = firstValid >= 0 ? ema(line.slice(firstValid) as number[], signalPeriod) : [];
    const signal = line.map((_, i) => (i >= firstValid && firstValid >= 0 ? signalRaw[i - firstValid] ?? null : null));
    return line.map((m, i) => ({ macd: m, signal: signal[i], histogram: m != null && signal[i] != null ? m - signal[i]! : null }));
};
