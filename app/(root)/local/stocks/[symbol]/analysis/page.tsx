import StockAnalysisPage from "@/components/pages/StockAnalysisPage";

export default async function LocalStockAnalysis({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  return <StockAnalysisPage market="local" symbol={symbol} />;
}
