import StockValuationPage from "@/components/pages/StockValuationPage";

// Collection steps read results documents with Gemini, which can take most of a minute
export const maxDuration = 60;

export default async function LocalStockValuation({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  return <StockValuationPage market="local" symbol={symbol} />;
}
