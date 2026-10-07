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
import {addHolding, updateHolding} from "@/lib/actions/portfolio.actions";
import {MARKETS, type MarketKey} from "@/lib/markets";
import {currencySymbol} from "@/lib/utils";

type HoldingFormValues = {
    symbol: string;
    shares: string;
    buyPrice: string;
};

type HoldingModalProps = {
    market: MarketKey;
    holding?: HoldingWithData;
    open: boolean;
    setOpen: (open: boolean) => void;
};

const HoldingModal = ({ market, holding, open, setOpen }: HoldingModalProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const isEdit = !!holding;
    const symbol = currencySymbol(MARKETS[market].currency);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<HoldingFormValues>({
        defaultValues: {
            symbol: holding?.symbol ?? '',
            shares: holding ? String(holding.shares) : '',
            buyPrice: holding ? String(Number(holding.buyPrice.toFixed(4))) : '',
        },
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const onSubmit = (values: HoldingFormValues) => {
        startTransition(async () => {
            const result = isEdit
                ? await updateHolding(holding.id, { shares: values.shares, buyPrice: values.buyPrice })
                : await addHolding({ ...values, market });

            if (!result.success) {
                toast.error(isEdit ? 'Failed to update holding' : 'Failed to add holding', { description: result.error });
                return;
            }

            toast.success(isEdit ? `${holding.symbol} updated` : `${values.symbol.toUpperCase()} added to your portfolio`);
            setOpen(false);
            if (!isEdit) reset();
            router.refresh();
        });
    };

    const numberField = { required: 'This field is required', validate: (v: string) => Number(v) > 0 || 'Enter a number above 0' };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="bg-gray-800 border-gray-600 text-gray-400 sm:max-w-xl rounded-2xl p-6 sm:p-10">
                <DialogHeader>
                    <DialogTitle className="alert-title text-2xl font-bold">{isEdit ? 'Edit Holding' : 'Add Holding'}</DialogTitle>
                    <DialogDescription className="text-gray-500">
                        {market === 'local' ? 'JSE-listed shares, priced in rand.' : 'US-listed shares, priced in US dollars.'} Adding a stock you already hold averages your buy price.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {isEdit ? (
                        <div className="space-y-2">
                            <Label htmlFor="holding-stock" className="form-label">Stock</Label>
                            <Input id="holding-stock" value={`${holding.company} (${holding.symbol})`} disabled readOnly className="form-input opacity-60" />
                        </div>
                    ) : (
                        <InputField
                            name="symbol"
                            label="Stock symbol"
                            placeholder={market === 'local' ? 'e.g. NPN' : 'e.g. AAPL'}
                            register={register}
                            error={errors.symbol}
                            validation={{ required: 'Stock symbol is required' }}
                        />
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="shares" className="form-label">Shares</Label>
                        <Input id="shares" type="number" step="any" min="0" inputMode="decimal" placeholder="eg: 10" className="form-input" {...register('shares', numberField)} />
                        {errors.shares && <p className="text-sm text-red-500">{errors.shares.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="buyPrice" className="form-label">Average buy price</Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">{symbol}</span>
                            <Input id="buyPrice" type="number" step="any" min="0" inputMode="decimal" placeholder="eg: 140" className="form-input !pl-7" {...register('buyPrice', numberField)} />
                        </div>
                        {errors.buyPrice && <p className="text-sm text-red-500">{errors.buyPrice.message}</p>}
                    </div>

                    <Button type="submit" disabled={isPending} className="blue-btn w-full mt-5">
                        {isPending ? 'Saving...' : isEdit ? 'Update Holding' : 'Add Holding'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default HoldingModal;
