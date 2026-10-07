'use client';

import {useRouter} from "next/navigation";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {marketHref, type MarketKey} from "@/lib/markets";
import {cn, formatChangePercent, formatMarketCapValue, formatPrice, getChangeColorClass} from "@/lib/utils";

const COLUMNS = ['Company', 'Symbol', 'Price', 'Change', 'Market Cap', 'P/E Ratio'];

// "Today's Top Stocks" table on the dashboard
const TopStocksTable = ({ market, stocks }: { market: MarketKey; stocks: StockSnapshot[] }) => {
    const router = useRouter();

    return (
        <Table className="watchlist-table">
            <TableHeader>
                <TableRow className="table-header-row">
                    {COLUMNS.map((label) => (
                        <TableHead key={label} className="table-header h-12 text-sm text-gray-400">{label}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {stocks.map((stock) => (
                    <TableRow
                        key={stock.symbol}
                        className="table-row h-14"
                        onClick={() => router.push(marketHref(market, `/stocks/${encodeURIComponent(stock.symbol)}`))}
                    >
                        <TableCell className="table-cell max-w-48 truncate pl-4">{stock.company}</TableCell>
                        <TableCell className="table-cell">{stock.symbol}</TableCell>
                        <TableCell className="table-cell">{stock.price ? formatPrice(stock.price, stock.currency) : '—'}</TableCell>
                        <TableCell className={cn('table-cell', getChangeColorClass(stock.changePercent))}>
                            {formatChangePercent(stock.changePercent) || '—'}
                        </TableCell>
                        <TableCell className="table-cell">{stock.marketCap ? formatMarketCapValue(stock.marketCap, stock.currency) : '—'}</TableCell>
                        <TableCell className="table-cell">{stock.peRatio ? stock.peRatio.toFixed(1) : '—'}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default TopStocksTable;
