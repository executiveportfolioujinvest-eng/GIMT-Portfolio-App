'use client';

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {resetDashboardList, saveDashboardSections, saveLocalStocks, saveSummaryTabs, saveTopStocks} from "@/lib/actions/admin.actions";
import {DASHBOARD_SECTIONS, LOCAL_SECTORS, MARKETS, type LocalStock, type MarketKey, type SummaryTab} from "@/lib/markets";

type EditorConfig = {
    hiddenSections: string[];
    summaryTabs: SummaryTab[];
    topStocks: string[];
    localStocks: LocalStock[];
    customized: { summaryTabs: boolean; topStocks: boolean; localStocks: boolean };
};

const INPUT = "form-input !h-10 w-full rounded-lg border px-3 py-2 text-sm";
const OUTLINE_BTN = "h-auto rounded border border-gray-600 bg-transparent px-3 py-2 text-sm text-gray-100 hover:bg-gray-700";
const ICON_BTN = "h-10 w-10 shrink-0 rounded border border-gray-600 bg-transparent p-0 text-gray-400 hover:bg-gray-700 hover:text-red-400";

type Result = { success: boolean; error?: string; message?: string };

const Panel = ({ title, description, customized, onReset, children }: {
    title: string;
    description: string;
    customized?: boolean;
    onReset?: () => void;
    children: React.ReactNode;
}) => (
    <section className="dash-panel flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
                <p className="mt-1 text-sm text-gray-400">{description}</p>
            </div>
            {customized && onReset && (
                <Button type="button" className={OUTLINE_BTN} onClick={onReset}>Reset to default</Button>
            )}
        </div>
        {children}
    </section>
);

// The administrator's Dashboards tab for one department: which sections show and the stock lists they use
const DashboardEditor = ({ market, config }: { market: MarketKey; config: EditorConfig }) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [hidden, setHidden] = useState<string[]>(config.hiddenSections);
    const [tabs, setTabs] = useState<SummaryTab[]>(config.summaryTabs);
    const [topStocks, setTopStocks] = useState<string>(config.topStocks.join(', '));
    const [localStocks, setLocalStocks] = useState<LocalStock[]>(config.localStocks);

    const run = (action: () => Promise<Result>, success: string) => startTransition(async () => {
        const result = await action();
        if (!result.success) {
            toast.error('Not saved', { description: result.error });
            return;
        }
        toast.success(success, { description: result.message });
        router.refresh();
    });

    const reset = (list: 'summaryTabs' | 'topStocks' | 'localStocks', label: string) =>
        startTransition(async () => {
            const result = await resetDashboardList(market, list);
            if (!result.success) return void toast.error('Not reset', { description: result.success ? undefined : result.error });
            toast.success(`${label} reset to the default`);
            // Reload so the editors pick up the defaults
            window.location.reload();
        });

    const updateTab = (index: number, change: (tab: SummaryTab) => SummaryTab) =>
        setTabs((all) => all.map((t, i) => (i === index ? change(t) : t)));

    return (
        <div className="flex flex-col gap-6">
            <Panel title="Sections" description={`Choose what the ${MARKETS[market].teamName} dashboard shows. Hidden sections disappear for everyone in the department.`}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {DASHBOARD_SECTIONS[market].map((section) => (
                        <label key={section.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-600 px-3 py-2.5 text-gray-100 hover:border-gray-500">
                            <input
                                type="checkbox"
                                className="h-4 w-4 accent-blue-500"
                                checked={!hidden.includes(section.key)}
                                onChange={(e) => setHidden((h) => (e.target.checked ? h.filter((k) => k !== section.key) : [...h, section.key]))}
                            />
                            {section.label}
                        </label>
                    ))}
                </div>
                <Button type="button" disabled={isPending} className="search-btn" onClick={() => run(() => saveDashboardSections(market, hidden), 'Sections saved')}>
                    Save sections
                </Button>
            </Panel>

            <Panel
                title="Market Summary"
                description="Tabs and the symbols in each (Yahoo Finance symbols, e.g. ^GSPC, AAPL, USDZAR=X or NPN.JO). Up to 8 tabs of 6 symbols."
                customized={config.customized.summaryTabs}
                onReset={() => reset('summaryTabs', 'Market Summary')}
            >
                <div className="flex flex-col gap-4">
                    {tabs.map((tab, ti) => (
                        <div key={ti} className="rounded-lg border border-gray-600 p-3">
                            <div className="mb-3 flex items-center gap-2">
                                <input aria-label="Tab name" className={INPUT} value={tab.label} maxLength={20} placeholder="Tab name"
                                    onChange={(e) => updateTab(ti, (t) => ({ ...t, label: e.target.value }))} />
                                <Button type="button" className={ICON_BTN} aria-label={`Remove the ${tab.label} tab`} disabled={tabs.length === 1}
                                    onClick={() => setTabs((all) => all.filter((_, i) => i !== ti))}>
                                    <Trash2 className="mx-auto h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {tab.symbols.map((s, si) => (
                                    <div key={si} className="grid grid-cols-[1fr_1.5fr_0.8fr_auto] gap-2">
                                        <input aria-label="Symbol" className={INPUT} value={s.symbol} placeholder="Symbol"
                                            onChange={(e) => updateTab(ti, (t) => ({ ...t, symbols: t.symbols.map((x, i) => (i === si ? { ...x, symbol: e.target.value.toUpperCase() } : x)) }))} />
                                        <input aria-label="Name" className={INPUT} value={s.label} placeholder="Name"
                                            onChange={(e) => updateTab(ti, (t) => ({ ...t, symbols: t.symbols.map((x, i) => (i === si ? { ...x, label: e.target.value } : x)) }))} />
                                        <input aria-label="Badge" className={INPUT} value={s.badge} maxLength={6} placeholder="Badge"
                                            onChange={(e) => updateTab(ti, (t) => ({ ...t, symbols: t.symbols.map((x, i) => (i === si ? { ...x, badge: e.target.value } : x)) }))} />
                                        <Button type="button" className={ICON_BTN} aria-label={`Remove ${s.symbol || 'symbol'}`} disabled={tab.symbols.length === 1}
                                            onClick={() => updateTab(ti, (t) => ({ ...t, symbols: t.symbols.filter((_, i) => i !== si) }))}>
                                            <Trash2 className="mx-auto h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            {tab.symbols.length < 6 && (
                                <button type="button" className="mt-2 flex cursor-pointer items-center gap-1 text-sm text-blue-400 hover:underline"
                                    onClick={() => updateTab(ti, (t) => ({ ...t, symbols: [...t.symbols, { symbol: '', label: '', badge: '' }] }))}>
                                    <Plus className="h-4 w-4" /> Add symbol
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-3">
                    {tabs.length < 8 && (
                        <Button type="button" className={OUTLINE_BTN} onClick={() => setTabs((all) => [...all, { label: '', symbols: [{ symbol: '', label: '', badge: '' }] }])}>
                            Add tab
                        </Button>
                    )}
                    <Button type="button" disabled={isPending} className="search-btn" onClick={() => run(() => saveSummaryTabs(market, tabs), 'Market Summary saved')}>
                        {isPending ? 'Checking symbols...' : 'Save Market Summary'}
                    </Button>
                </div>
            </Panel>

            <Panel
                title="Today's Top Stocks"
                description={`The stocks in the table, in order, separated by commas (up to 20${market === 'local' ? ', JSE tickers like NPN' : ', e.g. AAPL'}).`}
                customized={config.customized.topStocks}
                onReset={() => reset('topStocks', "Today's Top Stocks")}
            >
                <textarea aria-label="Top stocks" rows={3} className="form-input !h-auto w-full resize-none rounded-lg border px-3 py-3" value={topStocks}
                    onChange={(e) => setTopStocks(e.target.value)} />
                <Button type="button" disabled={isPending} className="search-btn"
                    onClick={() => run(() => saveTopStocks(market, topStocks.split(/[\s,]+/)), "Today's Top Stocks saved")}>
                    {isPending ? 'Checking symbols...' : "Save Today's Top Stocks"}
                </Button>
            </Panel>

            {market === 'local' && (
                <Panel
                    title="JSE Stock List"
                    description="The stocks behind the Local Market Overview, heatmap, quotes table and search suggestions (5 to 60)."
                    customized={config.customized.localStocks}
                    onReset={() => reset('localStocks', 'The JSE stock list')}
                >
                    <div className="flex flex-col gap-2">
                        {localStocks.map((s, i) => (
                            <div key={i} className="grid grid-cols-[0.8fr_2fr_1.2fr_auto] gap-2">
                                <input aria-label="Ticker" className={INPUT} value={s.symbol} placeholder="Ticker" maxLength={6}
                                    onChange={(e) => setLocalStocks((all) => all.map((x, j) => (j === i ? { ...x, symbol: e.target.value.toUpperCase() } : x)))} />
                                <input aria-label="Company" className={INPUT} value={s.name} placeholder="Company name"
                                    onChange={(e) => setLocalStocks((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                                <select aria-label="Sector" className={INPUT} value={s.sector}
                                    onChange={(e) => setLocalStocks((all) => all.map((x, j) => (j === i ? { ...x, sector: e.target.value } : x)))}>
                                    <option value="">Sector</option>
                                    {LOCAL_SECTORS.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                                </select>
                                <Button type="button" className={ICON_BTN} aria-label={`Remove ${s.symbol || 'stock'}`}
                                    onClick={() => setLocalStocks((all) => all.filter((_, j) => j !== i))}>
                                    <Trash2 className="mx-auto h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {localStocks.length < 60 && (
                            <Button type="button" className={OUTLINE_BTN} onClick={() => setLocalStocks((all) => [...all, { symbol: '', name: '', sector: '' }])}>
                                Add stock
                            </Button>
                        )}
                        <Button type="button" disabled={isPending} className="search-btn" onClick={() => run(() => saveLocalStocks(localStocks), 'JSE stock list saved')}>
                            {isPending ? 'Checking tickers...' : 'Save JSE stock list'}
                        </Button>
                    </div>
                </Panel>
            )}
        </div>
    );
};

export default DashboardEditor;
