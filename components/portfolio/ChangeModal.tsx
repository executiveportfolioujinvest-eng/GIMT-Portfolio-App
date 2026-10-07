'use client';

import {useTransition} from "react";
import {useForm} from "react-hook-form";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import InputField from "@/components/forms/InputField";
import {submitPortfolioChange} from "@/lib/actions/portfolio.actions";
import {MARKETS, type MarketKey} from "@/lib/markets";
import {currencySymbol, formatPrice} from "@/lib/utils";

type ChangeFormValues = {
    symbol: string;
    shares: string;
    buyPrice: string;
    note: string;
};

type ChangeModalProps = {
    market: MarketKey;
    action: ProposalAction;
    authority: PortfolioAuthority;
    holding?: HoldingWithData;
    open: boolean;
    setOpen: (open: boolean) => void;
};

const TITLES: Record<ProposalAction, string> = { add: 'Add Holding', edit: 'Edit Holding', remove: 'Remove Holding' };

// Adds, edits or removes a team holding: applied directly by the executive, otherwise sent for approval
const ChangeModal = ({ market, action, authority, holding, open, setOpen }: ChangeModalProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const isExecutive = authority === 'executive';
    const config = MARKETS[market];

    const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangeFormValues>({
        defaultValues: {
            symbol: holding?.symbol ?? '',
            shares: holding ? String(holding.shares) : '',
            buyPrice: holding ? String(Number(holding.buyPrice.toFixed(4))) : '',
            note: '',
        },
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const onSubmit = (values: ChangeFormValues) => {
        startTransition(async () => {
            const result = await submitPortfolioChange({
                market,
                action,
                symbol: values.symbol,
                holdingId: holding?.id,
                shares: values.shares,
                buyPrice: values.buyPrice,
                note: values.note,
            });

            if (!result.success) {
                toast.error('Change not submitted', { description: result.error });
                return;
            }

            toast.success(result.executed ? 'Team portfolio updated' : 'Sent for approval', {
                description: result.executed ? undefined : 'The executive portfolio manager (or the deputy, if delegated) will review it.',
            });
            setOpen(false);
            if (action === 'add') reset();
            router.refresh();
        });
    };

    const numberField = { required: 'This field is required', validate: (v: string) => Number(v) > 0 || 'Enter a number above 0' };
    const submitLabel = isExecutive ? TITLES[action] : 'Submit for approval';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="bg-gray-800 border-gray-600 text-gray-400 sm:max-w-xl rounded-2xl p-6 sm:p-10">
                <DialogHeader>
                    <DialogTitle className="alert-title text-2xl font-bold">{isExecutive ? TITLES[action] : `Request: ${TITLES[action]}`}</DialogTitle>
                    <DialogDescription className="text-gray-500">
                        {config.teamName} portfolio &bull; {config.exchange} shares in {config.currency}.{' '}
                        {isExecutive
                            ? 'As executive portfolio manager, your changes apply immediately.'
                            : 'This change needs the executive portfolio manager’s signature before it applies.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {action === 'add' ? (
                        <InputField
                            name="symbol"
                            label="Stock symbol"
                            placeholder={market === 'local' ? 'e.g. NPN' : 'e.g. AAPL'}
                            register={register}
                            error={errors.symbol}
                            validation={{ required: 'Stock symbol is required' }}
                        />
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="change-stock" className="form-label">Stock</Label>
                            <Input id="change-stock" value={`${holding?.company} (${holding?.symbol})`} disabled readOnly className="form-input opacity-60" />
                        </div>
                    )}

                    {action === 'remove' ? (
                        <p className="rounded-lg border border-gray-600 bg-gray-700 p-4 text-sm text-gray-400">
                            Removes the whole position: {holding?.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares at{' '}
                            {holding ? formatPrice(holding.buyPrice, holding.currency) : '—'} average cost.
                        </p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="shares" className="form-label">Shares</Label>
                                <Input id="shares" type="number" step="any" min="0" inputMode="decimal" placeholder="eg: 10" className="form-input" {...register('shares', numberField)} />
                                {errors.shares && <p className="text-sm text-red-500">{errors.shares.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="buyPrice" className="form-label">Average buy price</Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">{currencySymbol(config.currency)}</span>
                                    <Input id="buyPrice" type="number" step="any" min="0" inputMode="decimal" placeholder="eg: 140" className="form-input !pl-7" {...register('buyPrice', numberField)} />
                                </div>
                                {errors.buyPrice && <p className="text-sm text-red-500">{errors.buyPrice.message}</p>}
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="note" className="form-label">{isExecutive ? 'Note (optional)' : 'Rationale for the committee (optional)'}</Label>
                        <textarea
                            id="note"
                            rows={3}
                            maxLength={500}
                            placeholder="Why this change?"
                            className="form-input h-auto w-full resize-none rounded-lg border px-3 py-3"
                            {...register('note')}
                        />
                    </div>

                    <Button type="submit" disabled={isPending} className={`w-full mt-5 ${action === 'remove' ? 'watchlist-btn watchlist-remove h-12' : 'blue-btn'}`}>
                        {isPending ? 'Submitting...' : submitLabel}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ChangeModal;
