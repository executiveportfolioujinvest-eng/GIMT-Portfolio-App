import {ExternalLink} from "lucide-react";
import Section, {LearnLink, Stat} from "@/components/valuation/Section";
import StatementsPanel from "@/components/valuation/StatementsPanel";
import {CompareBars, FairValueTrack, SplitBar, TrendLines} from "@/components/valuation/charts";
import {count, date, isNum, money, pct, signedPct, times} from "@/components/valuation/format";
import {LEARN, type ValuationReport} from "@/lib/valuation/model";

const CONTENTS = [
    ['summary', 'Summary'], ['fair-value', 'Fair value'], ['peers', 'Peers'], ['growth', 'Growth'], ['performance', 'Performance'],
    ['balance-sheet', 'Balance sheet'], ['dividends', 'Dividends'], ['people', 'People & ownership'], ['company', 'Company'], ['sources', 'Sources'],
] as const;

const verdict = (difference?: number) => {
    if (!isNum(difference)) return { text: 'No estimate', tone: 'text-gray-400 border-gray-600' };
    if (difference >= 0.2) return { text: `${pct(difference, 0)} below our estimate`, tone: 'text-teal-400 border-teal-400/40' };
    if (difference <= -0.2) return { text: `${pct(-difference, 0)} above our estimate`, tone: 'text-red-500 border-red-500/40' };
    return { text: 'Close to our estimate', tone: 'text-gray-100 border-gray-500' };
};

const ValuationReportView = ({ report }: { report: ValuationReport }) => {
    const { snapshot: s, currency, fairValue, relative, analysts, growth, performance, health, dividends, people, indicators } = report;
    const m = (v?: number | null) => money(v, currency);
    const p = (v?: number | null) => money(v, currency, false);
    const call = verdict(fairValue.difference);

    return (
        <div className="flex flex-col gap-12">
            {/* Summary */}
            <section id="summary" className="dash-panel flex flex-col gap-6 scroll-mt-28">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-gray-500">{[s?.exchange, report.symbol, s?.industry].filter(Boolean).join(' · ')}</p>
                        <h1 className="text-3xl font-bold text-gray-100">{report.company}</h1>
                    </div>
                    <span className={`rounded-full border px-4 py-1.5 text-sm font-medium ${call.tone}`}>{call.text}</span>
                </div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                    <Stat label="Share price" value={p(report.price)} sub={isNum(s?.change52w) ? `${signedPct(s?.change52w)} over a year` : undefined} />
                    <Stat label="Fair value estimate" value={p(fairValue.value)} sub={fairValue.method === 'residual-income' ? 'Residual income model' : fairValue.method === 'cash-flow' ? 'Cash-flow model' : undefined} />
                    <Stat label="Market value" value={m(report.ratios.marketCap)} />
                    <Stat label={relative.metric} value={times(relative.company)} learn={relative.metric === 'P/E' ? LEARN.pe : LEARN.pb} />
                    <Stat label="EV / EBITDA" value={times(report.ratios.evEbitda)} learn={LEARN.evEbitda} />
                    <Stat label="Dividend yield" value={pct(report.ratios.dividendYield, 2)} learn={LEARN.dividendYield} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-teal-400">Strengths</h3>
                        {report.highlights.strengths.length ? (
                            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-gray-400">{report.highlights.strengths.map((t) => <li key={t}>{t}</li>)}</ul>
                        ) : <p className="text-sm text-gray-500">None stand out on the data available.</p>}
                    </div>
                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-red-500">Watch points</h3>
                        {report.highlights.watch.length ? (
                            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-gray-400">{report.highlights.watch.map((t) => <li key={t}>{t}</li>)}</ul>
                        ) : <p className="text-sm text-gray-500">None flagged on the data available.</p>}
                    </div>
                </div>
            </section>

            {/* Contents */}
            <nav aria-label="Valuation sections" className="sticky top-20 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-lg bg-gray-900/90 px-1 py-2 backdrop-blur scrollbar-hide-default">
                {CONTENTS.map(([id, label]) => (
                    <a key={id} href={`#${id}`} className="pill-tab shrink-0">{label}</a>
                ))}
            </nav>

            <Section id="fair-value" title="Fair Value"
                intro={fairValue.method === 'residual-income'
                    ? 'Banks and insurers are valued on their book value plus the returns they earn above what shareholders require (a residual income model).'
                    : 'The company’s cash flows over the next ten years, discounted back to today at the return shareholders require (a discounted cash flow model).'}
                indicators={indicators.value}>
                <div className="dash-panel">
                    {isNum(fairValue.value) ? (
                        <FairValueTrack price={report.price} fairValue={fairValue.value} format={p} />
                    ) : <p className="text-sm text-gray-400">{fairValue.reason}</p>}
                </div>
                {fairValue.inputs.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="dash-panel">
                            <h3 className="mb-3 font-semibold text-gray-100">Assumptions</h3>
                            <dl className="flex flex-col gap-2 text-sm">
                                {fairValue.inputs.map((i) => (
                                    <div key={i.label} className="flex items-center justify-between gap-4 border-b border-gray-800 pb-2">
                                        <dt className="text-gray-400">{i.label} {i.learn && <LearnLink href={i.learn}>source</LearnLink>}</dt>
                                        <dd className="tabular-nums text-gray-100">{i.value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <LearnLink href={fairValue.method === 'residual-income' ? LEARN.residualIncome : LEARN.dcf}>How this model works</LearnLink>
                        </div>
                        {fairValue.projections.length > 0 && (
                            <div className="dash-panel">
                                <h3 className="mb-3 font-semibold text-gray-100">Projected cash flows</h3>
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Year</th><th className="pb-2 text-right">Cash flow</th><th className="pb-2 text-right">Value today</th></tr></thead>
                                    <tbody>
                                        {fairValue.projections.map((row) => (
                                            <tr key={row.year} className="border-t border-gray-800"><td className="py-1.5 text-gray-400">{row.year}</td><td className="py-1.5 text-right tabular-nums text-gray-100">{m(row.cashFlow)}</td><td className="py-1.5 text-right tabular-nums text-gray-100">{m(row.presentValue)}</td></tr>
                                        ))}
                                        <tr className="border-t border-gray-600"><td className="py-1.5 text-gray-400">After year 10</td><td /><td className="py-1.5 text-right tabular-nums text-gray-100">{m(fairValue.presentValueOfTerminal)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                <div className="dash-panel grid grid-cols-2 gap-5 sm:grid-cols-4">
                    <Stat label="Analysts’ average target" value={p(analysts.mean)} sub={isNum(analysts.upside) ? `${signedPct(analysts.upside)} from today` : undefined} learn={LEARN.priceTarget} />
                    <Stat label="Highest target" value={p(analysts.high)} />
                    <Stat label="Lowest target" value={p(analysts.low)} />
                    <Stat label="Analysts" value={count(analysts.count)} sub={analysts.recommendation?.replace(/_/g, ' ')} />
                </div>
            </Section>

            <Section id="peers" title="Compared With Peers"
                intro={`${relative.metric} measures what investors pay for each rand or dollar of ${relative.metric === 'P/E' ? 'earnings' : 'book value'}; lower can mean better value.`}>
                <div className="dash-panel">
                    <CompareBars format={(v) => times(v)} rows={[
                        { label: report.symbol, value: relative.company, highlight: true },
                        { label: 'Peer average', value: relative.peersAverage },
                        ...(relative.metric === 'P/E' ? [{ label: 'Market median', value: relative.marketMedian }, { label: 'Implied by our estimate', value: relative.impliedByModel }] : []),
                    ]} />
                </div>
                {relative.peers.length > 0 && (
                    <div className="dash-panel overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm">
                            <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Company</th><th className="pb-2 text-right">P/E</th><th className="pb-2 text-right">P/B</th><th className="pb-2 text-right">Dividend yield</th><th className="pb-2 text-right">1-year return</th><th className="pb-2 text-right">Earnings growth forecast</th></tr></thead>
                            <tbody>
                                {relative.peers.map((peer) => (
                                    <tr key={peer.symbol} className="border-t border-gray-800">
                                        <td className="py-2 text-gray-100">{peer.name} <span className="text-xs text-gray-500">{peer.symbol}</span></td>
                                        <td className="py-2 text-right tabular-nums text-gray-100">{times(peer.pe)}</td>
                                        <td className="py-2 text-right tabular-nums text-gray-100">{times(peer.pb)}</td>
                                        <td className="py-2 text-right tabular-nums text-gray-100">{pct(peer.dividendYield, 2)}</td>
                                        <td className="py-2 text-right tabular-nums text-gray-100">{signedPct(peer.change52w)}</td>
                                        <td className="py-2 text-right tabular-nums text-gray-100">{signedPct(peer.earningsGrowthNextYear)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section>

            <Section id="growth" title="Growth Outlook" intro="Analysts’ forecasts for the next financial year, against the market average and the 10-year government bond yield." indicators={indicators.growth}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Earnings growth forecast</h3>
                        <CompareBars format={(v) => signedPct(v)} rows={[
                            { label: report.symbol, value: growth.earningsNextYear, highlight: true },
                            { label: 'Peer average', value: growth.peersEarnings },
                            { label: 'Market average', value: growth.marketEarnings },
                            { label: '10-year bond yield', value: growth.bondYield },
                        ]} />
                    </div>
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Revenue growth forecast</h3>
                        <CompareBars format={(v) => signedPct(v)} rows={[
                            { label: report.symbol, value: growth.revenueNextYear, highlight: true },
                            { label: 'Market average', value: growth.marketRevenue },
                        ]} />
                    </div>
                </div>
                <div className="dash-panel grid grid-cols-2 gap-5 sm:grid-cols-4">
                    <Stat label="Earnings growth this year" value={signedPct(growth.earningsThisYear)} />
                    <Stat label="Revenue growth this year" value={signedPct(growth.revenueThisYear)} />
                    <Stat label="Forecast EPS next year" value={p(growth.epsNextYear)} />
                    <Stat label="Return on equity now" value={pct(performance.roe)} learn={LEARN.roe} />
                </div>
            </Section>

            <Section id="performance" title="Past Performance" intro="What the company has reported, from its own results, SEC filings or Yahoo Finance." indicators={indicators.performance}>
                <div className="dash-panel grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                    <Stat label="Revenue growth (1 year)" value={signedPct(performance.revenueGrowth1y)} />
                    <Stat label={`Revenue growth (${performance.cagrYears ?? '—'}-year a year)`} value={signedPct(performance.revenueCagr)} learn={LEARN.cagr} />
                    <Stat label="Earnings growth (1 year)" value={signedPct(performance.earningsGrowth1y)} />
                    <Stat label={`Earnings growth (${performance.cagrYears ?? '—'}-year a year)`} value={signedPct(performance.earningsCagr)} />
                    <Stat label="Net margin" value={pct(performance.netMargin)} sub={`Prior year ${pct(performance.netMarginPrior)}`} learn={LEARN.netMargin} />
                    <Stat label="Return on assets" value={pct(performance.roa)} learn={LEARN.roa} />
                </div>
                <StatementsPanel annual={performance.annual} toDate={performance.toDate} recent={performance.recent} recentLabel={performance.recentLabel} currency={s?.financialCurrency ?? currency} />
            </Section>

            <Section id="balance-sheet" title="Balance Sheet Strength" intro={health.asOf ? `As at ${date(health.asOf)}.` : undefined} indicators={indicators.health}>
                <div className="dash-panel grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                    <Stat label="Debt to equity" value={pct(health.debtToEquity)} learn={LEARN.debtEquity} />
                    <Stat label="Net cash" value={m(health.netCash)} sub={isNum(health.netCash) && health.netCash < 0 ? 'Net debt' : undefined} />
                    <Stat label="Interest cover" value={times(health.interestCover)} learn={LEARN.interestCover} />
                    <Stat label="Current ratio" value={isNum(health.currentRatio) ? health.currentRatio.toFixed(2) : '—'} learn={LEARN.currentRatio} />
                    <Stat label="Total assets" value={m(health.totalAssets)} />
                    <Stat label="Total liabilities" value={m(health.totalLiabilities)} />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">What it owns and owes</h3>
                        <CompareBars format={m} rows={[
                            { label: 'Current assets', value: health.currentAssets },
                            { label: 'Current liabilities', value: health.currentLiabilities },
                            { label: 'Non-current liabilities', value: health.nonCurrentLiabilities },
                            { label: 'Cash', value: health.cash, highlight: true },
                            { label: 'Debt', value: health.debt },
                            { label: 'Equity', value: health.equity },
                        ]} />
                    </div>
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Debt, equity and cash over time</h3>
                        <TrendLines format={m} points={health.history.map((h) => ({ label: h.end.slice(0, 4), values: { debt: h.debt, equity: h.equity, cash: h.cash } }))}
                            series={[{ key: 'equity', label: 'Equity' }, { key: 'cash', label: 'Cash' }, { key: 'debt', label: 'Debt' }]} />
                    </div>
                </div>
            </Section>

            <Section id="dividends" title="Dividends" intro={dividends.exDate || dividends.payDate ? `Next dividend: goes ex on ${date(dividends.exDate)}, paid ${date(dividends.payDate)}.` : undefined} indicators={indicators.dividends}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Yield against the market</h3>
                        <CompareBars format={(v) => pct(v, 2)} rows={[
                            { label: report.symbol, value: dividends.yield, highlight: true },
                            { label: 'Market lower quarter', value: dividends.marketLow },
                            { label: 'Market upper quarter', value: dividends.marketHigh },
                        ]} />
                        <div className="mt-4 grid grid-cols-3 gap-4">
                            <Stat label="Payout (of earnings)" value={pct(dividends.payoutRatio)} learn={LEARN.payout} />
                            <Stat label="Payout (of free cash flow)" value={pct(dividends.cashPayoutRatio)} />
                            <Stat label="Dividend growth a year" value={signedPct(dividends.growth)} />
                        </div>
                    </div>
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Dividend per share</h3>
                        <TrendLines format={p} points={dividends.history.map((d) => ({ label: d.end.slice(0, 4), values: { dps: d.dps } }))} series={[{ key: 'dps', label: 'Dividend per share' }]} />
                    </div>
                </div>
            </Section>

            <Section id="people" title="People & Ownership">
                <div className="dash-panel">
                    <h3 className="mb-3 font-semibold text-gray-100">Who owns the shares</h3>
                    <SplitBar parts={[
                        { label: 'Institutions', value: people.institutionsPct },
                        { label: 'Insiders', value: people.insidersPct },
                        { label: 'Public and others', value: people.publicPct },
                    ]} />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="dash-panel overflow-x-auto">
                        <h3 className="mb-3 font-semibold text-gray-100">Leadership</h3>
                        {people.officers.length ? (
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Name</th><th className="pb-2">Role</th><th className="pb-2 text-right">Pay</th></tr></thead>
                                <tbody>{people.officers.map((o) => (
                                    <tr key={`${o.name}${o.title}`} className="border-t border-gray-800"><td className="py-2 text-gray-100">{o.name}{isNum(o.age) && <span className="text-xs text-gray-500"> · {o.age}</span>}</td><td className="py-2 text-gray-400">{o.title}</td><td className="py-2 text-right tabular-nums text-gray-100">{isNum(o.pay) ? money(o.pay, s?.financialCurrency ?? currency) : '—'}</td></tr>
                                ))}</tbody>
                            </table>
                        ) : <p className="text-sm text-gray-500">No leadership data.</p>}
                    </div>
                    <div className="dash-panel overflow-x-auto">
                        <h3 className="mb-3 font-semibold text-gray-100">Largest institutional holders</h3>
                        {people.holders.length ? (
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Holder</th><th className="pb-2 text-right">Stake</th><th className="pb-2 text-right">Reported</th></tr></thead>
                                <tbody>{people.holders.map((h) => (
                                    <tr key={h.name} className="border-t border-gray-800"><td className="py-2 text-gray-100">{h.name}</td><td className="py-2 text-right tabular-nums text-gray-100">{pct(h.pctHeld, 2)}</td><td className="py-2 text-right text-gray-400">{date(h.reportDate)}</td></tr>
                                ))}</tbody>
                            </table>
                        ) : <p className="text-sm text-gray-500">No holder data.</p>}
                    </div>
                </div>
                {people.trades.length > 0 && (
                    <div className="dash-panel overflow-x-auto">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-100">Recent insider trades</h3>
                            <LearnLink href={LEARN.insider}>About insider trades</LearnLink>
                        </div>
                        <table className="w-full min-w-[560px] text-sm">
                            <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Date</th><th className="pb-2">Insider</th><th className="pb-2">Trade</th><th className="pb-2 text-right">Shares</th><th className="pb-2 text-right">Value</th></tr></thead>
                            <tbody>{people.trades.map((t, i) => (
                                <tr key={i} className="border-t border-gray-800"><td className="py-2 text-gray-400">{date(t.date)}</td><td className="py-2 text-gray-100">{t.name}<span className="block text-xs text-gray-500">{t.relation}</span></td><td className="py-2 text-gray-400">{t.text ?? '—'}</td><td className="py-2 text-right tabular-nums text-gray-100">{count(t.shares)}</td><td className="py-2 text-right tabular-nums text-gray-100">{isNum(t.value) ? money(t.value, currency) : '—'}</td></tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
            </Section>

            <Section id="company" title="About the Company">
                <div className="dash-panel flex flex-col gap-5">
                    {s?.summary && <p className="text-sm leading-relaxed text-gray-400">{s.summary}</p>}
                    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                        <Stat label="Sector" value={s?.sector ?? '—'} />
                        <Stat label="Industry" value={s?.industry ?? '—'} />
                        <Stat label="Employees" value={count(s?.employees)} />
                        <Stat label="Shares in issue" value={count(s?.sharesOutstanding)} />
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        {s?.address && <span className="text-gray-400">{s.address}</span>}
                        {s?.website && <a href={s.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">{s.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" /></a>}
                        {s?.nextEarningsDate && <span className="text-gray-400">Next results: {date(s.nextEarningsDate)}</span>}
                    </div>
                </div>
            </Section>

            <Section id="sources" title="Sources & Data Status"
                intro={`Last collected ${report.collectedAt ? date(report.collectedAt) : 'just now'}. Prices are live; the market comparison figures are recalculated daily.`}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Company documents read</h3>
                        {report.documents.length ? (
                            <ul className="flex flex-col gap-2 text-sm">
                                {report.documents.map((d) => (
                                    <li key={d.url} className="flex items-start justify-between gap-3">
                                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-gray-100 hover:text-blue-700">
                                            <span className="truncate capitalize">{d.title}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                        <span className={`shrink-0 text-xs ${d.status === 'read' ? 'text-teal-400' : d.status === 'failed' ? 'text-red-500' : 'text-gray-500'}`}>
                                            {d.status === 'read' ? d.note ?? 'Read' : d.status === 'failed' ? d.note ?? 'Could not be read' : 'Waiting'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-gray-500">{report.websiteNote ?? (report.market === 'global' ? 'Figures come from the company’s SEC filings, so its website wasn’t needed.' : 'The company website hasn’t been searched yet.')}</p>}
                    </div>
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Data sources</h3>
                        <ul className="flex flex-col gap-2 text-sm">
                            {report.sources.map((src) => (
                                <li key={`${src.label}${src.url}`}>
                                    {src.url ? (
                                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gray-100 hover:text-blue-700">{src.label} <ExternalLink className="h-3 w-3" /></a>
                                    ) : <span className="text-gray-100">{src.label}</span>}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4 text-xs text-gray-500">
                            Estimates are calculated by GMIT from public data and are not investment advice. Check figures against the company’s own reports before acting on them.
                        </p>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default ValuationReportView;
