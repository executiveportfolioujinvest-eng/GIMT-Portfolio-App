import StockValuationPage from "@/components/pages/StockValuationPage";

// Collection steps read results documents with Gemini, which can take most of a minute
export const maxDuration = 60;

export default async function StockValuation({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  return <StockValuationPage market="global" symbol={symbol} />;
}
