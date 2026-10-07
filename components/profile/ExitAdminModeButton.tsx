'use client';

import {useTransition} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {exitAdminMode} from "@/lib/actions/profile.actions";

// Returns a portfolio manager from an administrator account to their own
const ExitAdminModeButton = () => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            type="button"
            disabled={isPending}
            className="h-auto rounded border border-gray-600 bg-transparent px-4 py-2 text-gray-100 hover:bg-gray-700"
            onClick={() => startTransition(async () => {
                const result = await exitAdminMode();
                router.push(result.home ?? '/sign-in');
                router.refresh();
            })}
        >
            {isPending ? 'Leaving...' : 'Exit administrator mode'}
        </Button>
    );
};

export default ExitAdminModeButton;
