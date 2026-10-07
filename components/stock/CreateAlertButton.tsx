'use client';

import {useState} from "react";
import {Button} from "@/components/ui/button";
import AlertModal from "@/components/AlertModal";
import type {MarketKey} from "@/lib/markets";

const CreateAlertButton = ({ market, symbol, company }: { market: MarketKey; symbol: string; company: string }) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button type="button" className="search-btn" onClick={() => setOpen(true)}>Create Alert</Button>
            {open && (
                <AlertModal
                    action="create"
                    market={market}
                    alertData={{ symbol, company, alertName: '', alertType: 'upper', threshold: '', frequency: 'once_per_day', market }}
                    open={open}
                    setOpen={setOpen}
                />
            )}
        </>
    );
};

export default CreateAlertButton;
