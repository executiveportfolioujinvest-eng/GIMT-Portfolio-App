import Link from "next/link";
import {isNum, money, pct, signedPct, times} from "@/components/valuation/format";
import {marketHref, type MarketKey} from "@/lib/markets";
import type {PeerSnapshot} from "@/lib/valuation/types";

// A small bar from 0 to 1 for one quality of a share
const Meter = ({ label, value }: { label: string; value?: number }) => (
    <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-[11px] text-gray-500">
        <span>{label}</span>
        <span className="h-1.5 overflow-hidden rounded-full bg-gray-700">
            {isNum(value) && <span className="block h-full rounded-full bg-[#5862FF]" style={{ width: `${Math.round(Math.min(1, Math.max(0.05, value)) * 100)}%` }} />}
        </span>
    </div>
);

// Cards for other shares worth a look (cheapest peers, or the market's strongest dividend payers)
const SuggestionCards = ({ title, note, shares, market, currency, medianPe }: {
    title: string;
    note: string;
    shares: PeerSnapshot[];
    market: MarketKey;
    currency: string;
    medianPe?: number;
}) => {
    if (!shares.length) return null;
    return (
        <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-gray-100">{title}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {shares.map((s) => (
                    <Link key={s.symbol} href={marketHref(market, `/stocks/${encodeURIComponent(s.symbol)}/valuation`)}
                        className="dash-panel flex flex-col gap-3 border border-transparent transition-colors hover:border-[#5862FF]/50">
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-100">{s.name}</p>
                            <p className="text-xs text-gray-500">{s.symbol} · {money(s.marketCap, currency)}</p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {/* Cheaper than the market median scores higher */}
                            <Meter label="Value" value={isNum(s.pe) && isNum(medianPe) && s.pe > 0 ? medianPe / (s.pe + medianPe) : undefined} />
                            <Meter label="Growth" value={isNum(s.earningsGrowthNextYear) ? 0.5 + s.earningsGrowthNextYear * 2 : undefined} />
                            <Meter label="Income" value={isNum(s.dividendYield) ? s.dividendYield / 0.08 : undefined} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <span className="text-gray-500">P/E <span className="block text-sm text-gray-100">{times(s.pe)}</span></span>
                            <span className="text-gray-500">Yield <span className="block text-sm text-gray-100">{pct(s.dividendYield, 2)}</span></span>
                            <span className="text-gray-500">1 year <span className={`block text-sm ${(s.change52w ?? 0) >= 0 ? 'text-teal-400' : 'text-red-500'}`}>{signedPct(s.change52w)}</span></span>
                        </div>
                    </Link>
                ))}
            </div>
            <p className="text-xs text-gray-500">{note}</p>
        </div>
    );
};

export default SuggestionCards;
