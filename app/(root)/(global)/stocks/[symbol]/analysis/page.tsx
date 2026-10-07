import StockAnalysisPage from "@/components/pages/StockAnalysisPage";

export default async function StockAnalysis({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  return <StockAnalysisPage market="global" symbol={symbol} />;
}
