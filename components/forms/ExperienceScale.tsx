'use client';

import {EXPERIENCE_LEVELS} from "@/lib/member-profile";
import {cn} from "@/lib/utils";

// A five-step rating from no experience to expert; each step is a radio button
const ExperienceScale = ({ id, label, value, onChange, error }: {
    id: string;
    label: string;
    value?: string;
    onChange: (value: ExperienceLevel) => void;
    error?: string;
}) => {
    const selected = EXPERIENCE_LEVELS.findIndex((l) => l.value === value);

    return (
        <fieldset className="space-y-2">
            <legend id={`${id}-label`} className="form-label mb-2">{label}</legend>
            <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid grid-cols-5 gap-1.5">
                {EXPERIENCE_LEVELS.map((level, i) => {
                    const checked = level.value === value;
                    return (
                        <button
                            key={level.value}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            id={i === 0 ? id : undefined}
                            onClick={() => onChange(level.value)}
                            className={cn(
                                "flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center text-xs leading-tight transition-colors",
                                checked
                                    ? "border-blue-500 bg-blue-500/20 text-gray-100"
                                    : i <= selected
                                        ? "border-blue-500/40 bg-blue-500/10 text-gray-300"
                                        : "border-gray-600 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                            )}
                        >
                            <span className="text-sm font-semibold">{i + 1}</span>
                            <span className="hidden sm:block">{level.label}</span>
                        </button>
                    );
                })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 sm:hidden" aria-hidden="true">
                <span>No experience</span>
                <span>Expert</span>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
        </fieldset>
    );
};

export default ExperienceScale;
