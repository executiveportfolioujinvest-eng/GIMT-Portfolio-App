'use client';

import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {daysInMonth, MONTH_OPTIONS} from "@/lib/member-profile";

// Month and day selects for a birthday stored as 'MM-DD' (no year)
const BirthdayPicker = ({ id, value, onChange }: { id?: string; value: string; onChange: (value: string) => void }) => {
    const [month = '', day = ''] = value ? value.split('-') : [];
    const days = Array.from({ length: month ? daysInMonth(month) : 31 }, (_, i) => String(i + 1).padStart(2, '0'));

    // Keep the day valid when switching to a shorter month
    const pickMonth = (m: string) => onChange(`${m}-${day && Number(day) <= daysInMonth(m) ? day : ''}`);
    const pickDay = (d: string) => onChange(`${month}-${d}`);

    return (
        <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Select value={month} onValueChange={pickMonth}>
                <SelectTrigger id={id} className="select-trigger" aria-label="Birthday month">
                    <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white">
                    {MONTH_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="focus:bg-gray-600 focus:text-white">{m.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={day} onValueChange={pickDay}>
                <SelectTrigger className="select-trigger" aria-label="Birthday day">
                    <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white">
                    {days.map((d) => (
                        <SelectItem key={d} value={d} className="focus:bg-gray-600 focus:text-white">{Number(d)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

export default BirthdayPicker;
