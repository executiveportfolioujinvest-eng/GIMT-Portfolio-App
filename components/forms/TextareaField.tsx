import {Label} from "@/components/ui/label";
import type {FieldValues} from "react-hook-form";

const TextareaField = <T extends FieldValues>({ name, label, placeholder, register, error, validation, rows = 4, maxLength }: Omit<FormInputProps<T>, 'type' | 'value' | 'disabled'> & { rows?: number; maxLength?: number }) => {
    return (
        <div className="space-y-2">
            <Label htmlFor={name} className="form-label">
                {label}
            </Label>
            <textarea
                id={name}
                rows={rows}
                maxLength={maxLength}
                placeholder={placeholder}
                className="form-input !h-auto w-full resize-none rounded-lg border px-3 py-3"
                {...register(name, validation)}
            />
            {error && <p className="text-sm text-red-500">{error.message}</p>}
        </div>
    )
}
export default TextareaField
