'use client';

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {cancelPortfolioChange, reviewPortfolioChange} from "@/lib/actions/portfolio.actions";
import {roleLabel} from "@/lib/markets";
import {cn, formatPrice} from "@/lib/utils";

const STATUS: Record<ProposalStatus, { label: string; className: string }> = {
    pending: { label: 'Awaiting executive', className: 'bg-yellow-400/15 text-yellow-400' },
    delegated: { label: 'Delegated to deputy', className: 'bg-blue-400/20 text-blue-300' },
    co_authorized: { label: 'Co-authorised · awaiting executive signature', className: 'bg-purple-500/15 text-purple-300' },
    executed: { label: 'Executed', className: 'bg-green-500/15 text-green-400' },
    rejected: { label: 'Rejected', className: 'bg-red-500/15 text-red-400' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-600 text-gray-400' },
};

const ACTION: Record<ProposalAction, { label: string; className: string }> = {
    add: { label: 'Add', className: 'bg-green-500/15 text-green-400' },
    edit: { label: 'Edit', className: 'bg-blue-400/20 text-blue-300' },
    remove: { label: 'Remove', className: 'bg-red-500/15 text-red-400' },
};

// Fixed time zone so the server and browser render the same text
const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' }) : '';

const shares = (n?: number) => (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 });

const changeSummary = (p: ProposalView) => {
    if (p.action === 'add') return `Buy ${shares(p.shares)} shares at ${formatPrice(p.buyPrice ?? 0, p.currency)}`;
    if (p.action === 'remove') return `Remove all ${shares(p.previousShares)} shares`;
    return `${shares(p.previousShares)} → ${shares(p.shares)} shares, avg ${formatPrice(p.previousBuyPrice ?? 0, p.currency)} → ${formatPrice(p.buyPrice ?? 0, p.currency)}`;
};

const ProposalCard = ({ proposal }: { proposal: ProposalView }) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');

    const run = (fn: () => Promise<{ success: boolean; error?: string }>, done: string) => {
        startTransition(async () => {
            const result = await fn();
            if (!result.success) {
                toast.error(result.error ?? 'Something went wrong');
                return;
            }
            toast.success(done);
            router.refresh();
        });
    };

    const approveLabel = proposal.status === 'co_authorized' ? 'Sign & execute' : 'Approve';

    return (
        <li className="alert-item flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={cn("rounded px-2 py-0.5 text-xs font-semibold uppercase", ACTION[proposal.action].className)}>{ACTION[proposal.action].label}</span>
                    <span className="font-semibold text-gray-100">{proposal.symbol}</span>
                    <span className="truncate text-gray-400">{proposal.company}</span>
                </div>
                <span className={cn("rounded px-2 py-0.5 text-xs", STATUS[proposal.status].className)}>{STATUS[proposal.status].label}</span>
            </div>

            <p className="text-gray-100">{changeSummary(proposal)}</p>
            {proposal.note && <p className="text-sm italic text-gray-400">&ldquo;{proposal.note}&rdquo;</p>}

            <ul className="space-y-0.5 text-xs text-gray-500">
                <li>Requested by {proposal.proposedBy.name} ({roleLabel(proposal.proposedBy.role)}) &bull; {when(proposal.proposedBy.at)}</li>
                {proposal.delegatedBy && <li>Delegated to the deputy by {proposal.delegatedBy.name} &bull; {when(proposal.delegatedBy.at)}</li>}
                {proposal.coAuthorizedBy && <li>Co-authorised by {proposal.coAuthorizedBy.name} &bull; {when(proposal.coAuthorizedBy.at)}</li>}
            </ul>

            {rejecting ? (
                <div className="flex flex-col gap-2">
                    <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={300}
                        placeholder="Reason (optional)"
                        className="form-input h-10 rounded-md border px-3"
                        aria-label="Reason for rejecting"
                    />
                    <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={isPending} className="bg-red-500 text-gray-900 hover:bg-red-500/90"
                            onClick={() => run(() => reviewPortfolioChange(proposal.id, 'reject', reason), 'Request rejected')}>
                            Confirm reject
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="text-gray-400" onClick={() => setRejecting(false)}>Back</Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {proposal.canApprove && (
                        <Button type="button" size="sm" disabled={isPending} className="search-btn"
                            onClick={() => run(() => reviewPortfolioChange(proposal.id, 'approve'), 'Signed and applied to the team portfolio')}>
                            {approveLabel}
                        </Button>
                    )}
                    {proposal.canDelegate && (
                        <Button type="button" size="sm" disabled={isPending} variant="outline" className="border-gray-600 bg-transparent text-gray-100 hover:bg-gray-600"
                            onClick={() => run(() => reviewPortfolioChange(proposal.id, 'delegate'), 'Delegated to the deputy portfolio manager')}>
                            Delegate to deputy
                        </Button>
                    )}
                    {proposal.canCoAuthorize && (
                        <Button type="button" size="sm" disabled={isPending} className="search-btn"
                            onClick={() => run(() => reviewPortfolioChange(proposal.id, 'coauthorize'), 'Co-authorised; awaiting the executive’s signature')}>
                            Co-authorise
                        </Button>
                    )}
                    {proposal.canReject && (
                        <Button type="button" size="sm" disabled={isPending} variant="ghost" className="text-red-400 hover:bg-red-500/10 hover:text-red-400" onClick={() => setRejecting(true)}>
                            Reject
                        </Button>
                    )}
                    {proposal.canCancel && (
                        <Button type="button" size="sm" disabled={isPending} variant="ghost" className="text-gray-400 hover:bg-gray-600"
                            onClick={() => run(() => cancelPortfolioChange(proposal.id), 'Request cancelled')}>
                            Cancel request
                        </Button>
                    )}
                </div>
            )}
        </li>
    );
};

const ProposalsPanel = ({ pending, history }: { pending: ProposalView[]; history: ProposalView[] }) => (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="flex flex-col gap-4">
            <h2 className="watchlist-title">Pending Approvals {pending.length > 0 && <span className="text-gray-500">({pending.length})</span>}</h2>
            {pending.length === 0 ? (
                <p className="dash-panel py-8 text-center text-gray-500">No changes waiting for sign-off.</p>
            ) : (
                <ul className="alert-list max-h-[640px]">
                    {pending.map((p) => <ProposalCard key={p.id} proposal={p} />)}
                </ul>
            )}
        </section>

        <section className="flex flex-col gap-4">
            <h2 className="watchlist-title">Sign-off History</h2>
            {history.length === 0 ? (
                <p className="dash-panel py-8 text-center text-gray-500">No signed changes yet.</p>
            ) : (
                <ul className="dash-panel max-h-[640px] divide-y divide-gray-600 overflow-y-auto scrollbar-hide-default">
                    {history.map((p) => (
                        <li key={p.id} className="flex flex-col gap-1 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                    <span className={cn("rounded px-2 py-0.5 text-xs font-semibold uppercase", ACTION[p.action].className)}>{ACTION[p.action].label}</span>
                                    <span className="font-semibold text-gray-100">{p.symbol}</span>
                                </span>
                                <span className={cn("rounded px-2 py-0.5 text-xs", STATUS[p.status].className)}>{STATUS[p.status].label}</span>
                            </div>
                            <p className="text-sm text-gray-400">{changeSummary(p)}</p>
                            <p className="text-xs text-gray-500">
                                Requested by {p.proposedBy.name}
                                {p.coAuthorizedBy && <> &bull; co-authorised by {p.coAuthorizedBy.name}</>}
                                {p.delegatedBy && <> &bull; delegated by {p.delegatedBy.name}</>}
                                {p.approvedBy && <> &bull; signed by {p.approvedBy.name} on {when(p.approvedBy.at)}</>}
                                {p.rejectedBy && <> &bull; rejected by {p.rejectedBy.name}{p.rejectedBy.reason ? `: “${p.rejectedBy.reason}”` : ''}</>}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    </div>
);

export default ProposalsPanel;
