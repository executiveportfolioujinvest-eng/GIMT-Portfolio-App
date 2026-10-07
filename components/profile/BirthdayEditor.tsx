'use client';

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import BirthdayPicker from "@/components/forms/BirthdayPicker";
import {updateMyBirthday} from "@/lib/actions/profile.actions";
import {formatBirthday} from "@/lib/member-profile";

// Shows the member's birthday and lets them add or change it
const BirthdayEditor = ({ birthday }: { birthday?: string }) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [editing, setEditing] = useState(!birthday);
    const [value, setValue] = useState(birthday ?? '');

    const save = () => startTransition(async () => {
        const result = await updateMyBirthday(value);
        if (!result.success) {
            toast.error('Birthday not saved', { description: result.error });
            return;
        }
        toast.success('Birthday saved', { description: 'The team will get a reminder on the day.' });
        setEditing(false);
        router.refresh();
    });

    if (!editing) {
        return (
            <span className="flex items-center gap-3">
                {formatBirthday(value)}
                <button type="button" className="cursor-pointer text-sm text-blue-400 hover:underline" onClick={() => setEditing(true)}>Change</button>
            </span>
        );
    }

    return (
        <span className="flex flex-col gap-2">
            <BirthdayPicker value={value} onChange={setValue} />
            <span className="flex gap-2">
                <Button type="button" disabled={isPending || !/^\d{2}-\d{2}$/.test(value)} className="search-btn" onClick={save}>
                    {isPending ? 'Saving...' : 'Save birthday'}
                </Button>
                {birthday && (
                    <Button type="button" className="h-auto rounded border border-gray-600 bg-transparent px-3 py-2 text-sm text-gray-100 hover:bg-gray-700"
                        onClick={() => { setValue(birthday); setEditing(false); }}>
                        Cancel
                    </Button>
                )}
            </span>
        </span>
    );
};

export default BirthdayEditor;
