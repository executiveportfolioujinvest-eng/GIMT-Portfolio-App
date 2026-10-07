import {ExternalLink} from "lucide-react";
import Section, {LearnLink, Stat} from "@/components/valuation/Section";
import StatementsPanel from "@/components/valuation/StatementsPanel";
import SuggestionCards from "@/components/valuation/SuggestionCards";
import {ColumnCompare, CompareBars, FairValueTrack, PeriodColumns, PriceTargetChart, SplitBar, TrendLines} from "@/components/valuation/charts";
import {DividendHistoryChart, HealthExplorer, RevenueFlowExplorer} from "@/components/valuation/Interactive";
import {count, date, isNum, money, pct, signedPct, times} from "@/components/valuation/format";
import {LEARN, type ValuationReport} from "@/lib/valuation/model";

const CONTENTS = [
    ['summary', 'Summary'], ['fair-value', 'Fair value'], ['cash-flows', 'Cash flows'], ['analysts', 'Analysts'], ['peers', 'Peers'],
    ['growth', 'Growth'], ['performance', 'Performance'], ['balance-sheet', 'Balance sheet'], ['dividends', 'Dividends'],
    ['people', 'People & ownership'], ['company', 'Company'], ['sources', 'Sources'],
] as const;

const verdict = (difference?: number) => {
    if (!isNum(difference)) return { text: 'No estimate', tone: 'text-gray-400 border-gray-600' };
    if (difference >= 0.2) return { text: `${pct(difference, 0)} below our estimate`, tone: 'text-teal-400 border-teal-400/40' };
    if (difference <= -0.2) return { text: `${pct(-difference, 0)} above our estimate`, tone: 'text-red-500 border-red-500/40' };
    return { text: 'Close to our estimate', tone: 'text-gray-100 border-gray-500' };
};

const ValuationReportView = ({ report }: { report: ValuationReport }) => {
    const { snapshot: s, currency, fairValue, relative, analysts, growth, performance, health, dividends, people, indicators, enterprise, perShare, discover } = report;
    const reporting = s?.financialCurrency ?? currency;
    const m = (v?: number | null) => money(v, currency);
    const r = (v?: number | null) => money(v, reporting);
    const p = (v?: number | null) => money(v, currency, false);
    const call = verdict(fairValue.difference);
    const headline = fairValue.models[0];

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
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
                    <Stat label="Share price" value={p(report.price)} sub={isNum(s?.change52w) ? `${signedPct(s?.change52w)} over a year` : undefined} />
                    <Stat label="Fair value estimate" value={p(fairValue.value)} sub={headline?.label} />
                    <Stat label="Market value" value={m(enterprise.marketCap)} />
                    <Stat label="Enterprise value" value={m(enterprise.marketEv)} learn={LEARN.enterpriseValue} />
                    <Stat label={relative.metric} value={times(relative.company)} learn={relative.metric === 'P/E' ? LEARN.pe : LEARN.pb} />
                    <Stat label="Diluted / basic EPS" value={`${p(perShare.epsDiluted)} / ${p(perShare.epsBasic)}`} learn={LEARN.eps} />
                    <Stat label="Return on equity" value={pct(perShare.roe)} learn={LEARN.roe} />
                    <Stat label="Dividend yield" value={pct(dividends.yield, 2)} learn={LEARN.dividendYield} />
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
                {CONTENTS.map(([id, label]) => <a key={id} href={`#${id}`} className="pill-tab shrink-0">{label}</a>)}
            </nav>

            <Section id="fair-value" title="Fair Value"
                intro={fairValue.method === 'residual-income'
                    ? 'Banks and insurers are valued on their book value plus the returns they earn above what shareholders require (a residual income model).'
                    : 'Future free cash flows discounted back to today: cash flow to the firm at the weighted cost of capital gives enterprise value, and cash flow to equity at the cost of equity gives equity value directly.'}
                indicators={indicators.value}>
                <div className="dash-panel">
                    {isNum(fairValue.value) ? <FairValueTrack price={report.price} fairValue={fairValue.value} format={p} /> : <p className="text-sm text-gray-400">{fairValue.reason}</p>}
                </div>

                <div className="dash-panel overflow-x-auto">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-100">Enterprise value and terminal value</h3>
                        <span className="flex gap-3"><LearnLink href={LEARN.enterpriseValue}>Enterprise value</LearnLink><LearnLink href={LEARN.terminalValue}>Terminal value</LearnLink></span>
                    </div>
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-500">
                                <th className="pb-2">Model</th><th className="pb-2 text-right">Per share</th><th className="pb-2 text-right">Enterprise value</th>
                                <th className="pb-2 text-right">Equity value</th><th className="pb-2 text-right">Terminal value (in year 10)</th>
                                <th className="pb-2 text-right">Terminal value (today)</th><th className="pb-2 text-right">Share of value from terminal</th><th className="pb-2 text-right">Discount rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fairValue.models.map((model, i) => (
                                <tr key={model.key} className="border-t border-gray-800">
                                    <td className="py-2 text-gray-100">{model.label}{i === 0 && <span className="ml-2 rounded bg-[#5862FF]/20 px-1.5 text-[10px] text-[#5862FF]">headline</span>}
                                        {model.note && <span className="block text-xs text-gray-500">{model.note}</span>}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{p(model.perShare)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(model.enterpriseValue)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(model.equityValue)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(model.terminalValue)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(model.terminalValuePv)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{isNum(model.terminalValuePv) && isNum(model.equityValue) && isNum(model.enterpriseValue ?? model.equityValue) ? pct(model.terminalValuePv / (model.key === 'fcff' ? model.enterpriseValue! : model.equityValue)) : '—'}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{pct(model.discountRate)}</td>
                                </tr>
                            ))}
                            <tr className="border-t border-gray-600">
                                <td className="py-2 text-gray-400">Market today (market value + debt − cash)</td>
                                <td className="py-2 text-right tabular-nums text-gray-100">{p(report.price)}</td>
                                <td className="py-2 text-right tabular-nums text-gray-100">{r(enterprise.marketEv)}</td>
                                <td className="py-2 text-right tabular-nums text-gray-100">{r(enterprise.marketCap)}</td>
                                <td colSpan={4} className="py-2 text-right text-xs text-gray-500">Debt {r(enterprise.debt)} · Cash {r(enterprise.cash)} · Net debt {r(enterprise.netDebt)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {fairValue.inputs.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="dash-panel">
                            <h3 className="mb-3 font-semibold text-gray-100">Assumptions</h3>
                            <dl className="flex flex-col gap-2 text-sm">
                                {fairValue.inputs.map((i) => (
                                    <div key={i.label} className="flex items-center justify-between gap-4 border-b border-gray-800 pb-2">
                                        <dt className="text-gray-400">{i.label} {i.learn && <LearnLink href={i.learn}>more</LearnLink>}</dt>
                                        <dd className="tabular-nums text-gray-100">{i.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                        {fairValue.projections.length > 0 && (
                            <div className="dash-panel">
                                <h3 className="mb-3 font-semibold text-gray-100">Projected cash flows ({headline?.key === 'fcfe' ? 'to equity' : 'to the firm'})</h3>
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Year</th><th className="pb-2 text-right">Cash flow</th><th className="pb-2 text-right">Value today</th></tr></thead>
                                    <tbody>
                                        {fairValue.projections.map((row) => (
                                            <tr key={row.year} className="border-t border-gray-800"><td className="py-1.5 text-gray-400">{row.year}</td><td className="py-1.5 text-right tabular-nums text-gray-100">{r(row.cashFlow)}</td><td className="py-1.5 text-right tabular-nums text-gray-100">{r(row.presentValue)}</td></tr>
                                        ))}
                                        <tr className="border-t border-gray-600"><td className="py-1.5 text-gray-400">Terminal value</td><td className="py-1.5 text-right tabular-nums text-gray-100">{r(headline?.terminalValue)}</td><td className="py-1.5 text-right tabular-nums text-gray-100">{r(headline?.terminalValuePv)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                <SuggestionCards title="Cheapest peers on earnings" note="Same-sector shares with the lowest P/E. Open one to value it the same way."
                    shares={discover.cheapPeers} market={report.market} currency={currency} medianPe={discover.medianPe} />
            </Section>

            <Section id="cash-flows" title="Cash Flows to the Firm and to Equity"
                intro="Free cash flow to the firm is cash from operations plus after-tax interest, less investment: what all lenders and shareholders could take out. Free cash flow to equity also counts new borrowing and repayments: what is left for shareholders.">
                <div className="dash-panel">
                    <PeriodColumns format={r}
                        periods={[...report.cashFlows].reverse().map((c) => ({ label: c.label, values: { fcff: c.fcff, fcfe: c.fcfe, fcf: c.fcf } }))}
                        series={[{ key: 'fcff', label: 'Free cash flow to the firm' }, { key: 'fcfe', label: 'Free cash flow to equity' }, { key: 'fcf', label: 'Free cash flow' }]} />
                </div>
                <div className="dash-panel overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Year</th><th className="pb-2 text-right">Operating cash flow</th><th className="pb-2 text-right">Investment</th><th className="pb-2 text-right">Net borrowing</th><th className="pb-2 text-right">Tax rate</th><th className="pb-2 text-right">FCFF</th><th className="pb-2 text-right">FCFE</th></tr></thead>
                        <tbody>
                            {report.cashFlows.map((c) => (
                                <tr key={c.end} className="border-t border-gray-800">
                                    <td className="py-2 text-gray-400">{c.label}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(c.operatingCashFlow)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(c.capex)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(c.netBorrowing)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{pct(c.taxRate)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(c.fcff)}</td>
                                    <td className="py-2 text-right tabular-nums text-gray-100">{r(c.fcfe)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-2 flex gap-4"><LearnLink href={LEARN.fcff}>Free cash flow to the firm</LearnLink><LearnLink href={LEARN.fcfe}>Free cash flow to equity</LearnLink></div>
                </div>
            </Section>

            <Section id="analysts" title="Analyst Price Targets" intro="The share price over two years, then the range analysts expect over the next twelve months.">
                <div className="dash-panel">
                    <PriceTargetChart history={analysts.priceHistory} mean={analysts.mean} high={analysts.high} low={analysts.low} format={p} />
                </div>
                <div className="dash-panel grid grid-cols-2 gap-5 sm:grid-cols-5">
                    <Stat label="Average target" value={p(analysts.mean)} sub={isNum(analysts.upside) ? `${signedPct(analysts.upside)} from today` : undefined} learn={LEARN.priceTarget} />
                    <Stat label="Highest target" value={p(analysts.high)} />
                    <Stat label="Lowest target" value={p(analysts.low)} />
                    <Stat label="Spread around average" value={isNum(analysts.high) && isNum(analysts.low) && isNum(analysts.mean) ? pct((analysts.high - analysts.low) / 2 / analysts.mean) : '—'} />
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

            <Section id="growth" title="Growth Outlook" intro="Analysts’ forecasts for the next financial year, against the market median and the 10-year government bond yield." indicators={indicators.growth}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Earnings growth forecast</h3>
                        <CompareBars format={(v) => signedPct(v)} rows={[
                            { label: report.symbol, value: growth.earningsNextYear, highlight: true },
                            { label: 'Peer average', value: growth.peersEarnings },
                            { label: 'Market median', value: growth.marketEarnings },
                            { label: '10-year bond yield', value: growth.bondYield },
                        ]} />
                    </div>
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Revenue growth forecast</h3>
                        <CompareBars format={(v) => signedPct(v)} rows={[
                            { label: report.symbol, value: growth.revenueNextYear, highlight: true },
                            { label: 'Market median', value: growth.marketRevenue },
                        ]} />
                    </div>
                </div>
                <div className="dash-panel grid grid-cols-2 gap-5 sm:grid-cols-4">
                    <Stat label="Earnings growth this year" value={signedPct(growth.earningsThisYear)} />
                    <Stat label="Revenue growth this year" value={signedPct(growth.revenueThisYear)} />
                    <Stat label="Forecast EPS next year" value={p(growth.epsNextYear)} learn={LEARN.eps} />
                    <Stat label="Return on equity now" value={pct(performance.roe)} learn={LEARN.roe} />
                </div>
            </Section>

            <Section id="performance" title="Past Performance" intro="What the company has reported, from its own results, SEC filings or Yahoo Finance." indicators={indicators.performance}>
                <div className="dash-panel grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
                    <Stat label="Revenue growth (1 year)" value={signedPct(performance.revenueGrowth1y)} />
                    <Stat label={`Revenue growth (${performance.cagrYears ?? '—'}y a year)`} value={signedPct(performance.revenueCagr)} learn={LEARN.cagr} />
                    <Stat label="Earnings growth (1 year)" value={signedPct(performance.earningsGrowth1y)} />
                    <Stat label={`Earnings growth (${performance.cagrYears ?? '—'}y a year)`} value={signedPct(performance.earningsCagr)} />
                    <Stat label="Net margin" value={pct(performance.netMargin)} sub={`Prior year ${pct(performance.netMarginPrior)}`} learn={LEARN.netMargin} />
                    <Stat label="Return on equity" value={pct(performance.roe)} learn={LEARN.roe} />
                    <Stat label="Return on assets" value={pct(performance.roa)} learn={LEARN.roa} />
                    <Stat label="Basic EPS" value={p(perShare.epsBasic)} learn={LEARN.eps} />
                </div>
                <div>
                    <h3 className="mb-3 font-semibold text-gray-100">Revenue breakdown</h3>
                    <RevenueFlowExplorer flows={performance.flows} currency={reporting} />
                </div>
                <div className="dash-panel">
                    <h3 className="mb-3 font-semibold text-gray-100">Return on equity by year</h3>
                    <TrendLines format={(v) => pct(v)} points={[...performance.annual].reverse().map((row) => ({ label: row.label.replace('FY ', ''), values: { roe: row.roe } }))} series={[{ key: 'roe', label: 'Return on equity' }]} />
                </div>
                <StatementsPanel annual={performance.annual} toDate={performance.toDate} recent={performance.recent} recentLabel={performance.recentLabel} currency={reporting} />
            </Section>

            <Section id="balance-sheet" title="Balance Sheet Strength"
                intro="Step through each reported year (or half year) to see what the company owned and owed, and how its debt compared with its equity and cash."
                indicators={indicators.health}>
                <HealthExplorer series={health.series} currency={reporting} />
            </Section>

            <Section id="dividends" title="Dividends" indicators={indicators.dividends}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
                    <div className="dash-panel">
                        <h3 className="mb-4 font-semibold text-gray-100">Key information</h3>
                        <div className="mb-4 grid grid-cols-2 gap-4">
                            <div className="border-l-4 border-[#5862FF] pl-3"><p className="text-xl font-semibold text-gray-100">{pct(dividends.yield, 2)}</p><p className="text-xs text-gray-500">Dividend yield</p></div>
                            <div className="border-l-4 border-[#5862FF] pl-3"><p className="text-xl font-semibold text-gray-100">{pct(dividends.buybackYield, 2)}</p><p className="text-xs text-gray-500">Buyback yield</p></div>
                        </div>
                        <dl className="flex flex-col text-sm">
                            {[
                                ['Total shareholder yield', pct(dividends.shareholderYield, 2), LEARN.shareholderYield],
                                ['Forward dividend yield', pct(dividends.forwardYield, 2), LEARN.dividendYield],
                                ['Dividend growth (a year)', signedPct(dividends.growth), undefined],
                                ['Next payment date', date(dividends.payDate), undefined],
                                ['Ex-dividend date', date(dividends.exDate), undefined],
                                ['Dividends per share (last 12 months)', p(dividends.trailingDps), undefined],
                                ['Indicated annual dividend', p(dividends.forwardRate), undefined],
                                ['Payout ratio (of earnings)', pct(dividends.payoutRatio), LEARN.payout],
                                ['Payout ratio (of free cash flow)', pct(dividends.cashPayoutRatio), LEARN.payout],
                            ].map(([label, value, learn]) => (
                                <div key={label} className="flex items-center justify-between gap-3 border-t border-gray-800 py-2">
                                    <dt className="text-gray-400">{label} {learn && <LearnLink href={learn}>?</LearnLink>}</dt>
                                    <dd className="tabular-nums text-gray-100">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Payment history</h3>
                        <DividendHistoryChart annual={dividends.annual} payments={dividends.payments} forwardRate={dividends.forwardRate} forwardYield={dividends.forwardYield} currency={currency} />
                    </div>
                </div>
                <div className="dash-panel">
                    <h3 className="mb-4 font-semibold text-gray-100">Yield against the market and industry</h3>
                    <ColumnCompare format={(v) => pct(v, 1)} columns={[
                        { label: report.symbol, value: dividends.yield, highlight: true },
                        { label: 'Market lower quarter', value: dividends.marketLow },
                        { label: 'Market upper quarter', value: dividends.marketHigh },
                        { label: 'Peer average', value: dividends.industryAverage },
                        { label: 'Forward (indicated)', value: dividends.forwardYield },
                    ]} />
                </div>
                <SuggestionCards title="Highest dividend payers in the market" note={`Highest trailing yields among the ${report.market === 'local' ? 'JSE shares GMIT tracks' : 'large US shares GMIT tracks'}, recalculated daily.`}
                    shares={discover.dividendPayers} market={report.market} currency={currency} medianPe={discover.medianPe} />
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
                                    <tr key={`${o.name}${o.title}`} className="border-t border-gray-800"><td className="py-2 text-gray-100">{o.name}{isNum(o.age) && <span className="text-xs text-gray-500"> · {o.age}</span>}</td><td className="py-2 text-gray-400">{o.title}</td><td className="py-2 text-right tabular-nums text-gray-100">{isNum(o.pay) ? r(o.pay) : '—'}</td></tr>
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
                                <tr key={i} className="border-t border-gray-800"><td className="py-2 text-gray-400">{date(t.date)}</td><td className="py-2 text-gray-100">{t.name}<span className="block text-xs text-gray-500">{t.relation}</span></td><td className="py-2 text-gray-400">{t.text ?? '—'}</td><td className="py-2 text-right tabular-nums text-gray-100">{count(t.shares)}</td><td className="py-2 text-right tabular-nums text-gray-100">{isNum(t.value) ? m(t.value) : '—'}</td></tr>
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
                intro={`Figures last collected ${report.collectedAt ? date(report.collectedAt) : 'just now'}. Prices are live; market comparison figures are recalculated daily or when you refresh market data.`}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="dash-panel">
                        <h3 className="mb-3 font-semibold text-gray-100">Company documents read</h3>
                        {report.documents.length ? (
                            <ul className="flex flex-col gap-2 text-sm">
                                {report.documents.map((d) => (
                                    <li key={d.url} className="flex items-start justify-between gap-3">
                                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-gray-100 hover:text-blue-700">
                                            <span className="truncate capitalize">{d.title}</span> <span className="text-xs text-gray-500">({d.type === 'interim' ? 'half year' : 'full year'})</span> <ExternalLink className="h-3 w-3 shrink-0" />
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
