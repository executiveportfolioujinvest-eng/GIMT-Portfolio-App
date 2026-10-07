import {Check, ExternalLink, Minus, X} from "lucide-react";
import type {Indicator} from "@/lib/valuation/model";

export const LearnLink = ({ href, children = 'What is this?' }: { href?: string; children?: React.ReactNode }) =>
    href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
            {children} <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
    ) : null;

// The pass / fail / not-enough-data checklist shown under each section
export const IndicatorList = ({ items }: { items: Indicator[] }) => (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map((item) => (
            <li key={item.label} className="flex items-start gap-3 rounded-lg border border-gray-700 px-3 py-2.5">
                <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        item.pass === true ? 'bg-teal-400/15 text-teal-400' : item.pass === false ? 'bg-red-500/15 text-red-500' : 'bg-gray-700 text-gray-500'
                    }`}
                    aria-label={item.pass === true ? 'Met' : item.pass === false ? 'Not met' : 'Not enough data'}
                >
                    {item.pass === true ? <Check className="h-3.5 w-3.5" /> : item.pass === false ? <X className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                    <span className="block text-sm text-gray-100">{item.label}</span>
                    <span className="block text-xs text-gray-500">{item.detail}</span>
                    <LearnLink href={item.learn} />
                </span>
            </li>
        ))}
    </ul>
);

export const Stat = ({ label, value, sub, learn }: { label: string; value: React.ReactNode; sub?: React.ReactNode; learn?: string }) => (
    <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="mt-1 text-lg font-semibold text-gray-100 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
        <LearnLink href={learn} />
    </div>
);

// A titled block of the report with an anchor for the contents bar
const Section = ({ id, title, intro, indicators, children }: {
    id: string;
    title: string;
    intro?: React.ReactNode;
    indicators?: Indicator[];
    children: React.ReactNode;
}) => {
    const met = indicators?.filter((i) => i.pass === true).length ?? 0;
    const judged = indicators?.filter((i) => i.pass !== null).length ?? 0;
    return (
        <section id={id} className="scroll-mt-28">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-2xl font-bold text-gray-100">{title}</h2>
                    {intro && <p className="mt-1 max-w-3xl text-sm text-gray-400">{intro}</p>}
                </div>
                {indicators && judged > 0 && (
                    <span className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-400">
                        {met} of {judged} checks met
                    </span>
                )}
            </div>
            <div className="flex flex-col gap-4">
                {children}
                {indicators && <IndicatorList items={indicators} />}
            </div>
        </section>
    );
};

export default Section;
