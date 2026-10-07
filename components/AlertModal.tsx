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
import SelectField from "@/components/forms/SelectField";
import {ALERT_TYPE_OPTIONS, CONDITION_OPTIONS, FREQUENCY_OPTIONS} from "@/lib/constants";
import {createAlert, updateAlert} from "@/lib/actions/alert.actions";
import {MARKETS} from "@/lib/markets";
import {currencySymbol} from "@/lib/utils";

type AlertFormValues = {
    alertName: string;
    symbol: string;
    alertKind: string;
    alertType: 'upper' | 'lower';
    threshold: string;
    frequency: AlertFrequency;
};

const AlertModal = ({ alertId, alertData, action = 'create', market = 'global', stocks = [], open, setOpen }: AlertModalProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const presetStock = alertData?.symbol ? { symbol: alertData.symbol, company: alertData.company } : null;

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors },
    } = useForm<AlertFormValues>({
        defaultValues: {
            alertName: alertData?.alertName ?? '',
            symbol: alertData?.symbol ?? '',
            alertKind: 'price',
            alertType: alertData?.alertType ?? 'upper',
            threshold: alertData?.threshold ?? '',
            frequency: alertData?.frequency ?? 'once_per_day',
        },
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const onSubmit = (values: AlertFormValues) => {
        const symbol = presetStock?.symbol ?? values.symbol;
        const company = presetStock?.company ?? stocks.find((s) => s.symbol === symbol)?.company ?? symbol;

        startTransition(async () => {
            const payload: AlertData = {
                symbol,
                company,
                alertName: values.alertName,
                alertType: values.alertType,
                threshold: values.threshold,
                frequency: values.frequency,
                market,
            };
            const result = action === 'edit' && alertId ? await updateAlert(alertId, payload) : await createAlert(payload);

            if (!result.success) {
                toast.error(action === 'edit' ? 'Failed to update alert' : 'Failed to create alert', { description: result.error });
                return;
            }

            toast.success(action === 'edit' ? 'Alert updated' : `Alert created for ${symbol}`);
            setOpen(false);
            if (action === 'create') reset();
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="bg-gray-800 border-gray-600 text-gray-400 sm:max-w-xl rounded-2xl p-6 sm:p-10">
                <DialogHeader>
                    <DialogTitle className="alert-title text-2xl font-bold">Price Alert</DialogTitle>
                    <DialogDescription className="sr-only">
                        Get an email when this stock crosses your target price.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <InputField
                        name="alertName"
                        label="Alert Name"
                        placeholder="e.g. Apple at Discount"
                        register={register}
                        error={errors.alertName}
                        validation={{ required: 'Alert name is required' }}
                    />

                    {presetStock ? (
                        <div className="space-y-2">
                            <Label htmlFor="stock-identifier" className="form-label">Stock identifier</Label>
                            <Input
                                id="stock-identifier"
                                value={`${presetStock.company} (${presetStock.symbol})`}
                                disabled
                                readOnly
                                className="form-input opacity-60"
                            />
                        </div>
                    ) : (
                        <SelectField
                            name="symbol"
                            label="Stock identifier"
                            placeholder={stocks.length ? 'Select a stock from your watchlist' : 'Add a stock to your watchlist first'}
                            options={stocks.map((s) => ({ value: s.symbol, label: `${s.company} (${s.symbol})` }))}
                            control={control}
                            error={errors.symbol}
                            required
                        />
                    )}

                    <SelectField
                        name="alertKind"
                        label="Alert type"
                        placeholder="Select alert type"
                        options={ALERT_TYPE_OPTIONS}
                        control={control}
                        error={errors.alertKind}
                        required
                    />

                    <SelectField
                        name="alertType"
                        label="Condition"
                        placeholder="Select a condition"
                        options={CONDITION_OPTIONS}
                        control={control}
                        error={errors.alertType}
                        required
                    />

                    <div className="space-y-2">
                        <Label htmlFor="threshold" className="form-label">Threshold value</Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">{currencySymbol(MARKETS[market].currency)}</span>
                            <Input
                                id="threshold"
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                placeholder="eg: 140"
                                className="form-input !pl-7"
                                {...register('threshold', {
                                    required: 'Threshold value is required',
                                    validate: (v) => Number(v) > 0 || 'Enter a price above 0',
                                })}
                            />
                        </div>
                        {errors.threshold && <p className="text-sm text-red-500">{errors.threshold.message}</p>}
                    </div>

                    <SelectField
                        name="frequency"
                        label="Frequency"
                        placeholder="Select frequency"
                        options={FREQUENCY_OPTIONS}
                        control={control}
                        error={errors.frequency}
                        required
                    />

                    <Button type="submit" disabled={isPending} className="blue-btn w-full mt-5">
                        {isPending ? 'Saving...' : action === 'edit' ? 'Update Alert' : 'Create Alert'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AlertModal;
