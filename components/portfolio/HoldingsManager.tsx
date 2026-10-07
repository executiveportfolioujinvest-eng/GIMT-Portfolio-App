'use client';

import {useState} from "react";
import {useRouter} from "next/navigation";
import {Pencil, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import StockLogo from "@/components/StockLogo";
import ChangeModal from "@/components/portfolio/ChangeModal";
import {marketHref, type MarketKey} from "@/lib/markets";
import {cn, formatChangePercent, formatPrice, getChangeColorClass} from "@/lib/utils";

const COLUMNS = ['Company', 'Symbol', 'Shares', 'Avg Cost', 'Price', 'Market Value', 'Gain / Loss', 'Actions'];

type Change = { action: ProposalAction; holding?: HoldingWithData };

const HoldingsManager = ({ market, authority, holdings }: { market: MarketKey; authority: PortfolioAuthority; holdings: HoldingWithData[] }) => {
    const router = useRouter();
    const [change, setChange] = useState<Change | null>(null);
    const isExecutive = authority === 'executive';
    // The other department's executive can look but not change anything
    const readOnly = authority === 'observer';
    const columns = readOnly ? COLUMNS.filter((c) => c !== 'Actions') : COLUMNS;

    return (
        <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="watchlist-title">Holdings</h2>
                {!readOnly && (
                    <Button type="button" className="search-btn" onClick={() => setChange({ action: 'add' })}>
                        {isExecutive ? 'Add Holding' : 'Propose Holding'}
                    </Button>
                )}
            </div>

            {holdings.length === 0 ? (
                <div className="dash-panel py-12 text-center">
                    <p className="empty-title">No holdings yet</p>
                    <p className="empty-description mx-auto">
                        {readOnly
                            ? 'This team hasn’t added any positions yet.'
                            : isExecutive
                                ? 'Add the team’s positions to track their value, gains and news.'
                                : 'Propose positions for the team; they appear here once the executive portfolio manager signs them.'}
                    </p>
                </div>
            ) : (
                <Table className="watchlist-table">
                    <TableHeader>
                        <TableRow className="table-header-row">
                            {columns.map((label) => (
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
                                {!readOnly && <TableCell>
                                    <span className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="alert-update-btn h-8 w-8"
                                            aria-label={`${isExecutive ? 'Edit' : 'Propose an edit to'} ${h.symbol}`}
                                            title={isExecutive ? 'Edit' : 'Propose an edit'}
                                            onClick={(e) => { e.stopPropagation(); setChange({ action: 'edit', holding: h }); }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="alert-delete-btn h-8 w-8"
                                            aria-label={`${isExecutive ? 'Remove' : 'Propose removing'} ${h.symbol}`}
                                            title={isExecutive ? 'Remove' : 'Propose removal'}
                                            onClick={(e) => { e.stopPropagation(); setChange({ action: 'remove', holding: h }); }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </span>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {change && (
                <ChangeModal
                    key={`${change.action}-${change.holding?.id ?? 'new'}`}
                    market={market}
                    authority={authority}
                    action={change.action}
                    holding={change.holding}
                    open={!!change}
                    setOpen={(open) => { if (!open) setChange(null) }}
                />
            )}
        </section>
    );
};

export default HoldingsManager;
