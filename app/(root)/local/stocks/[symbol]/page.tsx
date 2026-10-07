import StockOverviewPage from "@/components/pages/StockOverviewPage";

export default async function LocalStockDetails({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  return <StockOverviewPage market="local" symbol={symbol} />;
}
