'use client';

import { useEffect, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import countryList from 'react-select-country-list';
import { cn, getFlagEmoji } from '@/lib/utils';
import { DEFAULT_UNIVERSITY, DEFAULT_UNIVERSITY_COUNTRY } from '@/lib/member-profile';

type University = { name: string; country: string; countryName: string; aliases: string; search: string };

const countries = countryList();
const MAX_RESULTS = 50;

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Short names South African students actually type, so "Wits" or "Tuks" finds the university
const SA_ALIASES: Record<string, string> = {
    'University of Johannesburg': 'uj',
    'University of the Witwatersrand': 'wits',
    'University of Cape Town': 'uct',
    'University of Pretoria': 'up tuks tukkies',
    'Stellenbosch University': 'su maties',
    'University of KwaZulu-Natal': 'ukzn',
    'North-West University': 'nwu',
    'University of the Free State': 'ufs kovsies',
    'University of the Western Cape': 'uwc',
    'University of South Africa': 'unisa',
    'Nelson Mandela University': 'nmu mandela',
    'Rhodes University': 'ru',
    'University of Fort Hare': 'ufh',
    'University of Limpopo': 'ul',
    'University of Venda': 'univen',
    'University of Zululand': 'unizulu',
    'University of Mpumalanga': 'ump',
    'Sol Plaatje University': 'spu',
    'Sefako Makgatho Health Sciences University': 'smu',
    'Walter Sisulu University': 'wsu',
    'Cape Peninsula University of Technology': 'cput',
    'Durban University of Technology': 'dut',
    'Tshwane University of Technology': 'tut',
    'Vaal University of Technology': 'vut',
    'Central University of Technology': 'cut',
    'Mangosuthu University of Technology': 'mut',
};

// About 10,000 universities worldwide (Hipo university-domains-list, MIT licence), loaded the first time the list opens
let universitiesPromise: Promise<University[]> | null = null;
const loadUniversities = () => {
    universitiesPromise ??= fetch('/data/universities.json')
        .then((res) => {
            if (!res.ok) throw new Error(`Failed to load universities (${res.status})`);
            return res.json() as Promise<[string, string][]>;
        })
        .then((rows) => rows.map(([name, country]) => {
            const countryName = countries.getLabel(country) ?? '';
            const aliases = country === 'ZA' ? SA_ALIASES[name] ?? '' : '';
            return { name, country, countryName, aliases, search: normalize(`${name} ${countryName} ${aliases}`) };
        }))
        .catch((e) => {
            universitiesPromise = null;
            throw e;
        });
    return universitiesPromise;
};

// Best matches first: names starting with the search, then a word starting with it, then anywhere.
// South African universities lead each group, University of Johannesburg first of all.
const searchUniversities = (universities: University[], query: string) => {
    const q = normalize(query.trim());
    const homeFirst = (u: University) => (u.name === DEFAULT_UNIVERSITY ? 0 : u.country === DEFAULT_UNIVERSITY_COUNTRY ? 1 : 2);

    if (!q) return universities.filter((u) => u.country === DEFAULT_UNIVERSITY_COUNTRY).sort((a, b) => homeFirst(a) - homeFirst(b));

    const tokens = q.split(/\s+/);
    const score = (u: University) => {
        const name = normalize(u.name);
        if (name.startsWith(q) || u.aliases.split(' ').includes(q)) return 0;
        if (name.split(/[\s,()-]+/).some((word) => word.startsWith(tokens[0]))) return 1;
        return 2;
    };

    return universities
        .filter((u) => tokens.every((t) => u.search.includes(t)))
        .map((u) => ({ u, rank: score(u) * 3 + homeFirst(u) }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, MAX_RESULTS)
        .map(({ u }) => u);
};

const UniversitySelect = ({
    id,
    value,
    country,
    onSelect,
}: {
    id?: string;
    value: string;
    country: string;
    onSelect: (name: string, country: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [universities, setUniversities] = useState<University[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (!open || universities) return;
        let active = true;
        loadUniversities()
            .then((list) => active && setUniversities(list))
            .catch(() => active && setLoadFailed(true));
        return () => { active = false; };
    }, [open, universities]);

    const results = useMemo(() => (universities ? searchUniversities(universities, query) : []), [universities, query]);

    // Institutions missing from the list can still be typed in
    const typed = query.trim().replace(/\s+/g, ' ');
    const canUseTyped = typed.length > 1 && !results.some((u) => normalize(u.name) === normalize(typed) || u.aliases.split(' ').includes(normalize(typed)));

    const choose = (name: string, code: string) => {
        onSelect(name, code);
        setOpen(false);
        setQuery('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="country-select-trigger">
                    {value ? (
                        <span className="flex min-w-0 items-center gap-2 text-white">
                            {country && <span>{getFlagEmoji(country)}</span>}
                            <span className="truncate">{value}</span>
                        </span>
                    ) : (
                        'Select your university...'
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0 bg-gray-800 border-gray-600" align="start">
                <Command shouldFilter={false} className="bg-gray-800 border-gray-600">
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder="Search universities worldwide..."
                        className="country-select-input"
                    />
                    <CommandList className="max-h-64 bg-gray-800 scrollbar-hide-default">
                        {!universities && !loadFailed && <p className="country-select-empty">Loading universities...</p>}
                        {loadFailed && (
                            <p className="country-select-empty px-3">Couldn&apos;t load the university list. Type your institution&apos;s name to add it.</p>
                        )}
                        {universities && !canUseTyped && <CommandEmpty className="country-select-empty">No university found.</CommandEmpty>}

                        {results.length > 0 && (
                            <CommandGroup heading={query.trim() ? undefined : 'South Africa — type to search every country'} className="bg-gray-800 [&_[cmdk-group-heading]]:text-gray-500">
                                {results.map((u) => (
                                    <CommandItem
                                        key={`${u.name}|${u.country}`}
                                        value={`${u.name}|${u.country}`}
                                        onSelect={() => choose(u.name, u.country)}
                                        className="country-select-item"
                                    >
                                        <Check className={cn('mr-2 h-4 w-4 shrink-0 text-blue-500', value === u.name && country === u.country ? 'opacity-100' : 'opacity-0')} />
                                        <span className="mr-2">{getFlagEmoji(u.country)}</span>
                                        <span className="min-w-0 flex-1 truncate">{u.name}</span>
                                        <span className="ml-2 shrink-0 text-xs text-gray-500">{u.countryName}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {canUseTyped && (
                            <CommandGroup className="bg-gray-800">
                                <CommandItem value={`custom|${typed}`} onSelect={() => choose(typed, '')} className="country-select-item">
                                    <span className="text-gray-400">Use</span>
                                    <span className="truncate text-white">&ldquo;{typed}&rdquo;</span>
                                </CommandItem>
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default UniversitySelect;
