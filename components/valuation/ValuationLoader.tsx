'use client';

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {Loader2, RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {advanceValuation, startValuation} from "@/lib/actions/valuation.actions";
import type {MarketKey} from "@/lib/markets";
import type {CollectionPhase} from "@/lib/valuation/types";

type Props = { market: MarketKey; symbol: string; company?: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Moves collection along while the page is open; returns when it finishes or `until` is satisfied
const drive = async (market: MarketKey, symbol: string, onMessage: (m?: string) => void, until: (phase: CollectionPhase) => boolean, isActive: () => boolean) => {
    for (let i = 0; i < 40 && isActive(); i++) {
        const { state, error } = await advanceValuation(market, symbol);
        if (error || !state) throw new Error(error ?? 'Collection stopped');
        onMessage(state.message);
        if (until(state.phase)) return state;
        await wait(1500);
    }
    return null;
};

// Shown before a share has been valued: one button starts collecting, then the report appears
export const LoadValuation = ({ market, symbol, company }: Props) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string>();
    const [error, setError] = useState<string>();
    const active = useRef(true);
    useEffect(() => () => { active.current = false; }, []);

    const load = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const started = await startValuation(market, symbol);
            if (started.error) throw new Error(started.error);
            setMessage(started.state?.message);
            // The report can show once the basics are in; the website documents keep loading afterwards
            if (started.state?.phase === 'basics') await drive(market, symbol, setMessage, (phase) => phase !== 'basics', () => active.current);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The valuation could not be loaded');
            setLoading(false);
        }
    };

    return (
        <div className="dash-panel mx-auto flex max-w-2xl flex-col items-center gap-4 py-14 text-center">
            {loading ? (
                <>
                    <Loader2 className="h-10 w-10 animate-spin text-blue-700" aria-hidden="true" />
                    <p className="text-xl font-semibold text-gray-100">Loading valuation…</p>
                    <p className="max-w-md text-sm text-gray-400">{message ?? 'Gathering market data and financial statements'}</p>
                </>
            ) : (
                <>
                    <p className="text-xl font-semibold text-gray-100">Value {company ?? symbol}</p>
                    <p className="max-w-md text-sm text-gray-400">
                        Collects five years of reported results (from the company’s own results documents, SEC filings and Yahoo Finance),
                        then estimates a fair value and checks growth, balance sheet strength, dividends and ownership.
                        The figures are saved for the whole team.
                    </p>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="button" className="search-btn" onClick={load}>Load valuation</Button>
                </>
            )}
        </div>
    );
};

// While the company website is still being read, keeps going and refreshes the report as figures arrive
export const CollectionProgress = ({ market, symbol, phase, message }: Props & { phase: CollectionPhase; message?: string }) => {
    const router = useRouter();
    const [current, setCurrent] = useState(message);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        if (phase === 'done') return;
        (async () => {
            let last = message;
            for (let i = 0; i < 30 && active.current; i++) {
                const { state } = await advanceValuation(market, symbol);
                if (!state || !active.current) return;
                setCurrent(state.message);
                if (state.phase === 'done' || state.message !== last) router.refresh();
                if (state.phase === 'done') return;
                last = state.message;
                await wait(2000);
            }
        })().catch(() => null);
        return () => { active.current = false; };
    }, [market, symbol, phase, message, router]);

    if (phase === 'done') return null;
    return (
        <div className="dash-panel mb-6 flex items-center gap-3 border border-blue-700/40">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-700" aria-hidden="true" />
            <p className="text-sm text-gray-400">{current ?? 'Collecting more figures'} — the report updates as they arrive.</p>
        </div>
    );
};

// Re-collects everything (new results published, or to retry documents that failed)
export const RefreshValuation = ({ market, symbol, collectedAt }: Props & { collectedAt?: string }) => {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    return (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3 text-xs text-gray-500">
            {collectedAt && <span>Collected {new Date(collectedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
            <Button type="button" disabled={busy} className="h-auto rounded border border-gray-600 bg-transparent px-3 py-1.5 text-xs text-gray-100 hover:bg-gray-700"
                onClick={async () => {
                    setBusy(true);
                    await startValuation(market, symbol, true);
                    setBusy(false);
                    router.refresh();
                }}>
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh data
            </Button>
        </div>
    );
};
