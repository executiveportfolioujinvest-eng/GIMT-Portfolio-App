import StockOverviewPage from "@/components/pages/StockOverviewPage";

export default async function StockDetails({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  return <StockOverviewPage market="global" symbol={symbol} />;
}
