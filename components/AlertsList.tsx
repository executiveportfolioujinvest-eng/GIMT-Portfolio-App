'use client';

import {useState, useTransition} from "react";
import Image from "next/image";
import {useRouter} from "next/navigation";
import {Pencil, Trash2} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import AlertModal from "@/components/AlertModal";
import {deleteAlert} from "@/lib/actions/alert.actions";
import {FREQUENCY_OPTIONS} from "@/lib/constants";
import {formatChangePercent, formatPrice, getAlertText, getChangeColorClass} from "@/lib/utils";

const frequencyLabel = (frequency: AlertFrequency) =>
    FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.label ?? 'Once per day';

const AlertCard = ({ alert, onEdit }: { alert: Alert; onEdit: (alert: Alert) => void }) => {
    const router = useRouter();
    const [isDeleting, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteAlert(alert.id);
            if (!result.success) {
                toast.error('Failed to delete alert', { description: result.error });
                return;
            }
            toast.success(`Deleted "${alert.alertName}"`);
            router.refresh();
        });
    };

    return (
        <div className="alert-item">
            <div className="alert-details">
                <div className="flex items-center gap-3 min-w-0">
                    {alert.logo ? (
                        <Image src={alert.logo} alt={`${alert.company} logo`} width={48} height={48} className="h-12 w-12 shrink-0 rounded-md bg-white object-contain p-1" />
                    ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-600 font-semibold text-gray-100">
                            {alert.symbol[0]}
                        </span>
                    )}
                    <div className="min-w-0">
                        <p className="alert-company truncate">{alert.company}</p>
                        <p className="alert-price">{alert.currentPrice ? formatPrice(alert.currentPrice, alert.currency) : '—'}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="alert-company">{alert.symbol}</p>
                    <p className={`text-sm font-medium ${getChangeColorClass(alert.changePercent)}`}>
                        {formatChangePercent(alert.changePercent) || '—'}
                    </p>
                </div>
            </div>

            <div className="alert-actions">
                <div className="min-w-0">
                    <p className="text-gray-400 truncate">
                        Alert: <span className="text-gray-500">{alert.alertName}</span>
                    </p>
                    <p className="alert-price mt-1">{getAlertText(alert)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="alert-update-btn h-7 w-7"
                            aria-label={`Edit ${alert.alertName}`}
                            onClick={() => onEdit(alert)}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="alert-delete-btn h-7 w-7"
                            aria-label={`Delete ${alert.alertName}`}
                            disabled={isDeleting}
                            onClick={handleDelete}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <span className="alert-frequency">{frequencyLabel(alert.frequency)}</span>
                </div>
            </div>
        </div>
    );
};

const AlertsList = ({ alertData, watchlist, market }: AlertsListProps) => {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Alert | null>(null);

    return (
        <>
            <div className="flex w-full items-center justify-between">
                <h2 className="watchlist-title">Alerts</h2>
                <Button type="button" className="search-btn" onClick={() => setCreateOpen(true)}>
                    Create Alert
                </Button>
            </div>

            <div className="alert-list scrollbar-hide-default">
                {alertData && alertData.length > 0 ? (
                    alertData.map((alert) => <AlertCard key={alert.id} alert={alert} onEdit={setEditing} />)
                ) : (
                    <p className="alert-empty">
                        No alerts yet. Use &ldquo;Add Alert&rdquo; on a watchlist stock to get an email when it hits your price.
                    </p>
                )}
            </div>

            <AlertModal action="create" market={market} stocks={watchlist} open={createOpen} setOpen={setCreateOpen} />

            {editing && (
                <AlertModal
                    key={editing.id}
                    action="edit"
                    market={market}
                    alertId={editing.id}
                    alertData={{
                        symbol: editing.symbol,
                        company: editing.company,
                        alertName: editing.alertName,
                        alertType: editing.alertType,
                        threshold: String(editing.threshold),
                        frequency: editing.frequency,
                    }}
                    open={!!editing}
                    setOpen={(open) => { if (!open) setEditing(null) }}
                />
            )}
        </>
    );
};

export default AlertsList;
