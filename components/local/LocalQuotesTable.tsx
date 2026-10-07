'use client';

import {useRouter} from "next/navigation";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {LOCAL_STOCKS, marketHref} from "@/lib/markets";
import {cn, formatChangePercent, formatChangeValue, getChangeColorClass} from "@/lib/utils";

const COLUMNS = ['Name', 'Value', 'Change', 'Chg%', 'High', 'Low', 'Prev'];
const num = (v?: number) => (v != null ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');

// JSE take on TradingView's Market Quotes widget, grouped by sector
const LocalQuotesTable = ({ quotes }: { quotes: Record<string, MarketQuote | null> }) => {
    const router = useRouter();
    const sectors = [...new Set(LOCAL_STOCKS.map((s) => s.sector))];

    return (
        <div className="local-widget h-[600px] overflow-y-auto scrollbar-hide-default">
            <Table>
                <TableHeader className="sticky top-0 z-10 bg-gray-800">
                    <TableRow className="border-gray-600 hover:bg-transparent">
                        {COLUMNS.map((c) => <TableHead key={c} className="text-gray-400 first:pl-4">{c}</TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sectors.map((sector) => [
                        <TableRow key={sector} className="border-gray-600 hover:bg-transparent">
                            <TableCell colSpan={COLUMNS.length} className="bg-gray-900/40 pl-4 text-xs font-semibold uppercase text-gray-100">{sector}</TableCell>
                        </TableRow>,
                        ...LOCAL_STOCKS.filter((s) => s.sector === sector).map((stock) => {
                            const q = quotes[stock.symbol];
                            return (
                                <TableRow
                                    key={stock.symbol}
                                    className="cursor-pointer border-gray-600 text-gray-100 hover:bg-gray-700/50"
                                    onClick={() => router.push(marketHref('local', `/stocks/${stock.symbol}`))}
                                >
                                    <TableCell className="pl-4">
                                        <span className="font-medium">{stock.symbol}</span>
                                        <span className="ml-2 text-gray-500">{stock.name}</span>
                                    </TableCell>
                                    <TableCell>{num(q?.price)}</TableCell>
                                    <TableCell className={getChangeColorClass(q?.changePercent)}>{formatChangeValue(q?.change) || '—'}</TableCell>
                                    <TableCell className={cn(getChangeColorClass(q?.changePercent))}>{formatChangePercent(q?.changePercent) || '—'}</TableCell>
                                    <TableCell>{num(q?.high)}</TableCell>
                                    <TableCell>{num(q?.low)}</TableCell>
                                    <TableCell>{num(q?.prevClose)}</TableCell>
                                </TableRow>
                            );
                        }),
                    ])}
                </TableBody>
            </Table>
        </div>
    );
};

export default LocalQuotesTable;
