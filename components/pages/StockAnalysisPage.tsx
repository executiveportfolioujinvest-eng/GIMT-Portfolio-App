import TradingViewWidget from "@/components/TradingViewWidget";
import WatchlistButton from "@/components/WatchlistButton";
import StockTabs from "@/components/stock/StockTabs";
import ProChart from "@/components/charts/ProChart";
import NewsList from "@/components/dashboard/NewsList";
import {
  SYMBOL_INFO_WIDGET_CONFIG,
  CANDLE_CHART_WIDGET_CONFIG,
  BASELINE_WIDGET_CONFIG,
  TECHNICAL_ANALYSIS_WIDGET_CONFIG,
  COMPANY_PROFILE_WIDGET_CONFIG,
  COMPANY_FINANCIALS_WIDGET_CONFIG,
} from "@/lib/constants";
import { getCompanyProfile } from "@/lib/actions/finnhub.actions";
import { isStockInWatchlist } from "@/lib/actions/watchlist.actions";
import { getChartSeries } from "@/lib/actions/yahoo.actions";
import { getStockNews } from "@/lib/actions/news.actions";
import { type MarketKey } from "@/lib/markets";
import { findLocalStock } from "@/lib/dashboard-config";
import { cn, formatChangePercent, formatChangeValue, formatCompactNumber, formatPrice, getChangeColorClass } from "@/lib/utils";

// TradingView analysis page (Figma stock details design) for global stocks
const GlobalAnalysis = async ({ symbol }: { symbol: string }) => {
  const [profile, isInWatchlist] = await Promise.all([
    getCompanyProfile(symbol),
    isStockInWatchlist(symbol, 'global'),
  ]);
  const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
      {/* Left column */}
      <div className="flex flex-col gap-6">
        <TradingViewWidget
          scriptUrl={`${scriptUrl}symbol-info.js`}
          config={SYMBOL_INFO_WIDGET_CONFIG(symbol)}
          height={170}
        />

        <TradingViewWidget
          scriptUrl={`${scriptUrl}advanced-chart.js`}
          config={CANDLE_CHART_WIDGET_CONFIG(symbol)}
          className="custom-chart"
          height={600}
        />

        <TradingViewWidget
          scriptUrl={`${scriptUrl}advanced-chart.js`}
          config={BASELINE_WIDGET_CONFIG(symbol)}
          className="custom-chart"
          height={600}
        />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <WatchlistButton key={symbol} symbol={symbol} company={profile?.name || symbol} isInWatchlist={isInWatchlist} />
        </div>

        <TradingViewWidget
          scriptUrl={`${scriptUrl}technical-analysis.js`}
          config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
          height={400}
        />

        <TradingViewWidget
          scriptUrl={`${scriptUrl}company-profile.js`}
          config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
          height={440}
        />

        <TradingViewWidget
          scriptUrl={`${scriptUrl}financials.js`}
          config={COMPANY_FINANCIALS_WIDGET_CONFIG(symbol)}
          height={464}
        />
      </div>
    </section>
  );
};

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <li className="flex items-center justify-between gap-4 border-b border-gray-600 py-3 last:border-b-0">
    <span className="text-gray-400">{label}</span>
    <span className="font-medium text-gray-100">{value}</span>
  </li>
);

// Same layout for JSE stocks, drawn from Yahoo Finance data since TradingView embeds carry no JSE data
const LocalAnalysis = async ({ symbol }: { symbol: string }) => {
  const known = await findLocalStock(symbol);
  const [year, isInWatchlist] = await Promise.all([
    getChartSeries(`${symbol}.JO`, '1Y'),
    isStockInWatchlist(symbol, 'local'),
  ]);
  const quote = year.quote;
  const company = known?.name || quote?.name || symbol;
  const news = await getStockNews('local', symbol, company, 5);

  const closes = year.points.map((p) => p.close);
  const avgVolume = year.points.length ? year.points.reduce((sum, p) => sum + p.volume, 0) / year.points.length : undefined;
  const yearReturn = closes.length > 1 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : undefined;
  const money = (v?: number) => (v != null ? formatPrice(v, 'ZAR') : '—');

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
      <div className="flex flex-col gap-6">
        <div className="dash-panel">
          <p className="text-gray-400">{company} &bull; {symbol} &bull; JSE</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-bold text-gray-100">{money(quote?.price)}</span>
            {quote?.change != null && (
              <span className={cn("text-lg font-medium", getChangeColorClass(quote.changePercent))}>
                {formatChangeValue(quote.change)} ({formatChangePercent(quote.changePercent)})
              </span>
            )}
          </p>
        </div>

        <div className="dash-panel">
          <ProChart yahooSymbol={`${symbol}.JO`} label={`${symbol} · JSE`} initialRange="1Y" initialData={year.points} height={560}
            benchmark={{ yahooSymbol: '^J203.JO', label: 'JSE All Share' }} />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <WatchlistButton key={symbol} market="local" symbol={symbol} company={company} isInWatchlist={isInWatchlist} />
        </div>

        <div className="dash-panel">
          <h3 className="mb-2 text-xl font-semibold text-gray-100">Key stats</h3>
          <ul>
            <StatRow label="Day's range" value={`${money(quote?.low)} – ${money(quote?.high)}`} />
            <StatRow label="52-week range" value={`${money(quote?.week52Low)} – ${money(quote?.week52High)}`} />
            <StatRow label="Previous close" value={money(quote?.prevClose)} />
            <StatRow label="Volume" value={formatCompactNumber(quote?.volume)} />
            <StatRow label="Average volume (1Y)" value={formatCompactNumber(avgVolume)} />
            <StatRow label="1-year return" value={formatChangePercent(yearReturn) || '—'} />
          </ul>
        </div>

        <div className="dash-panel">
          <h3 className="mb-2 text-xl font-semibold text-gray-100">{symbol} Profile</h3>
          <ul>
            <StatRow label="Company" value={company} />
            <StatRow label="Sector" value={known?.sector || '—'} />
            <StatRow label="Exchange" value="Johannesburg Stock Exchange" />
            <StatRow label="Currency" value="ZAR" />
          </ul>
        </div>

        <div className="dash-panel">
          <h3 className="mb-2 text-xl font-semibold text-gray-100">Latest News</h3>
          <NewsList articles={news} variant="readmore" emptyText={`No recent news for ${company}.`} />
        </div>
      </div>
    </section>
  );
};

const StockAnalysisPage = async ({ market, symbol: rawSymbol }: { market: MarketKey; symbol: string }) => {
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <StockTabs market={market} symbol={symbol} active="analysis" />
      {market === 'local' ? <LocalAnalysis symbol={symbol} /> : <GlobalAnalysis symbol={symbol} />}
    </div>
  );
};

export default StockAnalysisPage;
