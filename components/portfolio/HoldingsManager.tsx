'use client';

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {Pencil, Trash2} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import StockLogo from "@/components/StockLogo";
import HoldingModal from "@/components/portfolio/HoldingModal";
import {deleteHolding} from "@/lib/actions/portfolio.actions";
import {marketHref, type MarketKey} from "@/lib/markets";
import {cn, formatChangePercent, formatPrice, getChangeColorClass} from "@/lib/utils";

const COLUMNS = ['Company', 'Symbol', 'Shares', 'Avg Cost', 'Price', 'Market Value', 'Gain / Loss', 'Actions'];

const HoldingsManager = ({ market, holdings }: { market: MarketKey; holdings: HoldingWithData[] }) => {
    const router = useRouter();
    const [addOpen, setAddOpen] = useState(false);
    const [editing, setEditing] = useState<HoldingWithData | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const handleDelete = (holding: HoldingWithData) => {
        setDeletingId(holding.id);
        startTransition(async () => {
            const result = await deleteHolding(holding.id);
            setDeletingId(null);
            if (!result.success) {
                toast.error('Failed to delete holding', { description: result.error });
                return;
            }
            toast.success(`${holding.symbol} removed from your portfolio`);
            router.refresh();
        });
    };

    return (
        <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="watchlist-title">Holdings</h2>
                <Button type="button" className="search-btn" onClick={() => setAddOpen(true)}>Add Holding</Button>
            </div>

            {holdings.length === 0 ? (
                <div className="dash-panel py-12 text-center">
                    <p className="empty-title">No holdings yet</p>
                    <p className="empty-description mx-auto">Add the positions in your portfolio to track their value, gains and news.</p>
                </div>
            ) : (
                <Table className="watchlist-table">
                    <TableHeader>
                        <TableRow className="table-header-row">
                            {COLUMNS.map((label) => (
                                <TableHead key={label} className="table-header h-14 text-base text-gray-400">{label}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {holdings.map((h) => (
                            <TableRow
                                key={h.id}
                                className="table-row h-16"
                                onClick={() => router.push(marketHref(market, `/stocks/${encodeURIComponent(h.symbol)}`))}
                            >
                                <TableCell className="table-cell pl-4">
                                    <span className="flex items-center gap-3">
                                        <StockLogo logo={h.logo} symbol={h.symbol} company={h.company} size={32} />
                                        <span className="max-w-48 truncate">{h.company}</span>
                                    </span>
                                </TableCell>
                                <TableCell className="table-cell">{h.symbol}</TableCell>
                                <TableCell className="table-cell">{h.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })}</TableCell>
                                <TableCell className="table-cell">{formatPrice(h.buyPrice, h.currency)}</TableCell>
                                <TableCell className="table-cell">
                                    {h.currentPrice ? formatPrice(h.currentPrice, h.currency) : '—'}
                                    {h.changePercent != null && (
                                        <span className={cn("ml-2 text-sm", getChangeColorClass(h.changePercent))}>{formatChangePercent(h.changePercent)}</span>
                                    )}
                                </TableCell>
                                <TableCell className="table-cell">{h.marketValue != null ? formatPrice(h.marketValue, h.currency) : '—'}</TableCell>
                                <TableCell className={cn('table-cell', getChangeColorClass(h.gain))}>
                                    {h.gain != null ? `${formatPrice(h.gain, h.currency)} (${formatChangePercent(h.gainPercent) || '0.00%'})` : '—'}
                                </TableCell>
                                <TableCell>
                                    <span className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="alert-update-btn h-8 w-8"
                                            aria-label={`Edit ${h.symbol} holding`}
                                            onClick={(e) => { e.stopPropagation(); setEditing(h); }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="alert-delete-btn h-8 w-8"
                                            aria-label={`Delete ${h.symbol} holding`}
                                            disabled={deletingId === h.id}
                                            onClick={(e) => { e.stopPropagation(); handleDelete(h); }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <HoldingModal market={market} open={addOpen} setOpen={setAddOpen} />
            {editing && (
                <HoldingModal
                    key={editing.id}
                    market={market}
                    holding={editing}
                    open={!!editing}
                    setOpen={(open) => { if (!open) setEditing(null) }}
                />
            )}
        </section>
    );
};

export default HoldingsManager;
