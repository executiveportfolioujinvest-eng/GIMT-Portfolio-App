'use client';

import {useState} from "react";
import {Lock} from "lucide-react";
import {toast} from "sonner";
import {updateEmailPreference} from "@/lib/actions/profile.actions";
import type {EmailSetting} from "@/lib/email-preferences";
import {cn} from "@/lib/utils";

// The emails a member gets. Portfolio managers, the President and Vice President switch each one on or off;
// everyone else sees the set that comes with their department
const EmailSettings = ({ settings }: { settings: EmailSetting[] }) => {
    const [state, setState] = useState(settings);
    // Switches being saved; each saves on its own, so the others stay usable
    const [saving, setSaving] = useState<Set<EmailSetting['key']>>(new Set());
    const locked = state.every((s) => s.locked);

    const toggle = async (key: EmailSetting['key'], on: boolean) => {
        setState((all) => all.map((s) => (s.key === key ? { ...s, on } : s)));
        setSaving((keys) => new Set(keys).add(key));
        const result = await updateEmailPreference(key, on).catch(() => ({ success: false, error: 'Check your connection and try again' }));
        setSaving((keys) => {
            const next = new Set(keys);
            next.delete(key);
            return next;
        });
        if (!result.success) {
            setState((all) => all.map((s) => (s.key === key ? { ...s, on: !on } : s)));
            toast.error('Email setting not saved', { description: result.error });
        }
    };

    return (
        <section className="flex flex-col gap-4">
            <div>
                <h2 className="watchlist-title">Email notifications</h2>
                <p className="mt-1 text-sm text-gray-400">
                    {locked
                        ? 'These emails come with your department and can’t be switched off.'
                        : 'Choose which emails you get. Changes apply from the next email.'}
                </p>
            </div>
            <ul className="dash-panel flex flex-col divide-y divide-gray-600">
                {state.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                            <p className="text-gray-100">{s.label}</p>
                            <p className="mt-0.5 text-sm text-gray-500">{s.description}</p>
                        </div>
                        {s.locked ? (
                            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-400">
                                <Lock className="h-3 w-3" aria-hidden="true" /> {s.on ? 'Required' : 'Off'}
                            </span>
                        ) : (
                            <button
                                type="button"
                                role="switch"
                                aria-checked={s.on}
                                aria-label={s.label}
                                disabled={saving.has(s.key)}
                                onClick={() => toggle(s.key, !s.on)}
                                className={cn(
                                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-wait",
                                    s.on ? "bg-blue-500" : "bg-gray-600"
                                )}
                            >
                                <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", s.on ? "translate-x-5" : "translate-x-0.5")} />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default EmailSettings;
