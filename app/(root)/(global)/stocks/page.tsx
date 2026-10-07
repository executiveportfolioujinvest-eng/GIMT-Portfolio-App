import {redirect} from "next/navigation";

// TradingView widgets link here as /stocks?tvwidgetsymbol=NASDAQ:AAPL; send them to the stock page
export default async function StocksRedirect({ searchParams }: { searchParams: Promise<{ tvwidgetsymbol?: string }> }) {
    const { tvwidgetsymbol } = await searchParams;
    const symbol = tvwidgetsymbol?.split(':').pop()?.trim();

    redirect(symbol ? `/stocks/${encodeURIComponent(symbol)}` : '/');
}
