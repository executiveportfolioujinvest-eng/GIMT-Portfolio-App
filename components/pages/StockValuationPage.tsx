import StockTabs from "@/components/stock/StockTabs";
import ValuationReportView from "@/components/valuation/ValuationReportView";
import {CollectionProgress, LoadValuation, RefreshValuation} from "@/components/valuation/ValuationLoader";
import {ValuationFilters} from "@/components/valuation/Interactive";
import type {SourcePreference} from "@/lib/valuation/model";
import {getValuation} from "@/lib/actions/valuation.actions";
import type {MarketKey} from "@/lib/markets";

// The Valuation tab: a fundamentals report built from the company's reported results
const StockValuationPage = async ({ market, symbol: rawSymbol, source }: { market: MarketKey; symbol: string; source?: string }) => {
    const symbol = decodeURIComponent(rawSymbol).toUpperCase();
    const preference = (['company', 'sec', 'yahoo'].includes(source ?? '') ? source : 'auto') as SourcePreference;
    const { report, error } = await getValuation(market, symbol, preference);

    return (
        <div className="flex min-h-screen flex-col">
            <StockTabs market={market} symbol={symbol} active="valuation" />
            {error ? (
                <div className="dash-panel mx-auto max-w-xl py-12 text-center">
                    <p className="empty-title">Valuation unavailable</p>
                    <p className="empty-description mx-auto">{error}</p>
                </div>
            ) : !report ? (
                <LoadValuation market={market} symbol={symbol} />
            ) : (
                <>
                    <CollectionProgress market={market} symbol={symbol} phase={report.phase} message={report.message} />
                    <RefreshValuation market={market} symbol={symbol} collectedAt={report.collectedAt} />
                    <ValuationFilters market={market} symbol={symbol} source={report.sourcePreference} collectedAt={report.collectedAt} />
                    <ValuationReportView report={report} />
                </>
            )}
        </div>
    );
};

export default StockValuationPage;
