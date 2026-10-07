'use client';

import {useState} from "react";
import {useRouter} from "next/navigation";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Button} from "@/components/ui/button";
import WatchlistButton from "@/components/WatchlistButton";
import AlertModal from "@/components/AlertModal";
import {WATCHLIST_TABLE_HEADER} from "@/lib/constants";
import {cn, getChangeColorClass} from "@/lib/utils";
import {marketHref} from "@/lib/markets";

// The star column doubles as the remove action, so it leads the row without a label
const COLUMNS = ['', ...WATCHLIST_TABLE_HEADER.filter((h) => h !== 'Action')];

const WatchlistTable = ({ watchlist, market }: WatchlistTableProps) => {
    const router = useRouter();
    const [alertStock, setAlertStock] = useState<SelectedStock | null>(null);

    return (
        <>
            <Table className="watchlist-table">
                <TableHeader>
                    <TableRow className="table-header-row">
                        {COLUMNS.map((label, i) => (
                            <TableHead key={label || `col-${i}`} className="table-header h-14 text-base text-gray-400">
                                {label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {watchlist.map((item) => (
                        <TableRow
                            key={item.symbol}
                            className="table-row h-16"
                            onClick={() => router.push(marketHref(market, `/stocks/${encodeURIComponent(item.symbol)}`))}
                        >
                            <TableCell className="pl-4 w-12">
                                <WatchlistButton
                                    type="icon"
                                    market={market}
                                    symbol={item.symbol}
                                    company={item.company}
                                    isInWatchlist
                                />
                            </TableCell>
                            <TableCell className="table-cell max-w-48 truncate">{item.company}</TableCell>
                            <TableCell className="table-cell">{item.symbol}</TableCell>
                            <TableCell className="table-cell">{item.priceFormatted}</TableCell>
                            <TableCell className={cn('table-cell', getChangeColorClass(item.changePercent))}>
                                {item.changeFormatted}
                            </TableCell>
                            <TableCell className="table-cell">{item.marketCap}</TableCell>
                            <TableCell className="table-cell">{item.peRatio}</TableCell>
                            <TableCell>
                                <Button
                                    type="button"
                                    className="add-alert"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setAlertStock({ symbol: item.symbol, company: item.company, currentPrice: item.currentPrice });
                                    }}
                                >
                                    Add Alert
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {alertStock && (
                <AlertModal
                    key={alertStock.symbol}
                    action="create"
                    market={market}
                    alertData={{
                        symbol: alertStock.symbol,
                        company: alertStock.company,
                        alertName: '',
                        alertType: 'upper',
                        threshold: '',
                        frequency: 'once_per_day',
                    }}
                    open={!!alertStock}
                    setOpen={(open) => { if (!open) setAlertStock(null) }}
                />
            )}
        </>
    );
};

export default WatchlistTable;
