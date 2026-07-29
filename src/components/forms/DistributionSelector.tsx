import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { JSX, useMemo, useState } from 'react';
import { useWorkspace } from '../contexts/workspace';

export type DistributionLike = {
  num: number | string;
  from: string | number | Date;
  to?: string | number | Date | null;
};

// Sentinel used to represent the "none" choice inside the combobox.
const NONE_OPTION = { num: '__none__', from: 0 } as DistributionLike;

function formatRange(distribution: DistributionLike): string {
  const from = new Date(distribution.from).toLocaleDateString();
  if (distribution.to) {
    return `${from} - ${new Date(distribution.to).toLocaleDateString()}`;
  }
  return `${from} - ${new Date().toLocaleDateString()} · current`;
}

export default function DistributionSelector({
  distributions,
  value,
  onChange,
  className = '',
  allowNone = false,
  noneLabel = 'No comparison',
}: {
  distributions: DistributionLike[];
  value: number | null;
  onChange: (num: number | null) => void;
  className?: string;
  allowNone?: boolean;
  noneLabel?: string;
}): JSX.Element {
  const workspace = useWorkspace();
  const brandColor = workspace?.brandColor || 'blue';

  const [query, setQuery] = useState('');

  // Newest distribution first.
  const sorted = useMemo(
    () => [...distributions].sort((a, b) => parseInt(b.num.toString()) - parseInt(a.num.toString())),
    [distributions],
  );

  const selected = useMemo(
    () => sorted.find(d => parseInt(d.num.toString()) === value) ?? null,
    [sorted, value],
  );

  const selectedIndex = useMemo(
    () => sorted.findIndex(d => parseInt(d.num.toString()) === value),
    [sorted, value],
  );

  // The genuinely current distribution is the open-ended one (no `to` date),
  // not simply the highest number in whatever (possibly filtered) list we get.
  const isCurrentDistribution = (d: DistributionLike) => !d.to;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sorted;

    // If the query parses as a date, match distributions whose range contains it.
    const looksLikeDate = /[\/.]|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(trimmed);
    const parsedDate = new Date(query.trim());
    const isDateQuery = looksLikeDate && !isNaN(parsedDate.getTime());
    if (isDateQuery) {
      const time = parsedDate.getTime();
      const containing = sorted.filter(d => {
        const from = new Date(d.from).getTime();
        const to = d.to ? new Date(d.to).getTime() : Date.now();
        return time >= from && time <= to;
      });
      if (containing.length > 0) return containing;
    }

    return sorted.filter(d => {
      const num = parseInt(d.num.toString());
      const label = `distribution ${num} ${formatRange(d)}`.toLowerCase();
      return label.includes(trimmed) || num.toString().includes(trimmed);
    });
  }, [sorted, query]);

  // selectedIndex is into the newest-first list, so "previous" (older) = next index.
  const goOlder = () => {
    const older = sorted[selectedIndex + 1];
    if (selectedIndex < sorted.length - 1 && older) {
      onChange(parseInt(older.num.toString()));
    }
  };
  const goNewer = () => {
    const newer = sorted[selectedIndex - 1];
    if (selectedIndex > 0 && newer) {
      onChange(parseInt(newer.num.toString()));
    }
  };

  const canGoOlder = selectedIndex >= 0 && selectedIndex < sorted.length - 1;
  const canGoNewer = selectedIndex > 0;

  return (
    <div className={`flex flex-row items-stretch gap-2 ${className}`}>
      {!allowNone && (
        <button
          type="button"
          aria-label="Older distribution"
          disabled={!canGoOlder}
          onClick={goOlder}
          className="flex w-9 shrink-0 items-center justify-center rounded-md bg-white text-gray-500 shadow-xs ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-750"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      )}

      <Combobox
        value={selected ?? (allowNone ? NONE_OPTION : null)}
        onChange={(d: DistributionLike | null) => {
          if (!d || d === NONE_OPTION) {
            onChange(null);
          } else {
            onChange(parseInt(d.num.toString()));
          }
        }}
      >
        <div className="relative flex-1">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </span>
            <ComboboxInput
              className={`w-full cursor-default rounded-md bg-white py-1.5 pl-9 pr-10 text-left text-sm text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 focus:outline-hidden focus:ring-2 focus:ring-${brandColor}-500 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700`}
              displayValue={(d: DistributionLike | null) =>
                !d || d === NONE_OPTION
                  ? (allowNone ? noneLabel : '')
                  : `Distribution ${parseInt(d.num.toString()).toLocaleString()} — ${formatRange(d)}`
              }
              onChange={e => setQuery(e.target.value)}
              placeholder={allowNone ? noneLabel : 'Search by number or a date (e.g. 3/14/2026)…'}
            />
            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
              <ChevronRightIcon className="h-5 w-5 rotate-90" />
            </ComboboxButton>
          </div>

          <ComboboxOptions
            anchor="bottom start"
            className="z-50 mt-1 max-h-[min(20rem,var(--anchor-max-height))] w-(--input-width) overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-hidden dark:bg-gray-800"
          >
            {allowNone && query.trim() === '' && (
              <ComboboxOption
                value={NONE_OPTION}
                className={`group relative flex cursor-default select-none items-center py-2 pl-3 pr-9 text-gray-900 data-focus:bg-${brandColor}-600 data-focus:text-white dark:text-gray-100`}
              >
                <span className="font-medium">{noneLabel}</span>
              </ComboboxOption>
            )}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No distributions found.</div>
            )}
            {filtered.map(d => {
              const num = parseInt(d.num.toString());
              const isLatest = isCurrentDistribution(d);
              return (
                <ComboboxOption
                  key={num}
                  value={d}
                  className={`group relative flex cursor-default select-none items-center justify-between gap-2 py-2 pl-3 pr-9 text-gray-900 data-focus:bg-${brandColor}-600 data-focus:text-white dark:text-gray-100`}
                >
                  {({ selected: isSelected }) => (
                    <>
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 font-medium group-data-selected:font-semibold">
                          Distribution {num.toLocaleString()}
                          {isLatest && (
                            <span className={`rounded-full bg-${brandColor}-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-${brandColor}-700 group-data-focus:bg-white/20 group-data-focus:text-white dark:bg-${brandColor}-900/40 dark:text-${brandColor}-300`}>
                              Current
                            </span>
                          )}
                        </span>
                        <span className="truncate text-xs text-gray-500 group-data-focus:text-white/80 dark:text-gray-400">
                          {formatRange(d)}
                        </span>
                      </div>
                      {isSelected && (
                        <span className={`absolute inset-y-0 right-0 flex items-center pr-3 text-${brandColor}-600 group-data-focus:text-white`}>
                          <CheckIcon className="h-5 w-5" />
                        </span>
                      )}
                    </>
                  )}
                </ComboboxOption>
              );
            })}
          </ComboboxOptions>
        </div>
      </Combobox>

      {!allowNone && (
        <button
          type="button"
          aria-label="Newer distribution"
          disabled={!canGoNewer}
          onClick={goNewer}
          className="flex w-9 shrink-0 items-center justify-center rounded-md bg-white text-gray-500 shadow-xs ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-750"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
