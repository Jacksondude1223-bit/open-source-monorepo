import { JSX, useMemo, useState } from 'react';
import { Months } from '~/utils/DateUtils';

type DayMinutes = {
  total: number;
  active: number;
  inactive: number;
  typing: number;
  messages: number;
};

type DaySummary = {
  minutes: DayMinutes;
};

type HeatmapCell = {
  date: Date;
  dayKey: string;
  weekIndex: number;
  weekday: number;
  minutes: DayMinutes | null;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LEVEL_COLORS = [
  'bg-gray-100 dark:bg-gray-700/40',
  'bg-emerald-200 dark:bg-emerald-900/70',
  'bg-emerald-300 dark:bg-emerald-700/80',
  'bg-emerald-400 dark:bg-emerald-600',
  'bg-emerald-500 dark:bg-emerald-400',
];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatMinutes(total: number): string {
  if (total <= 0) return '0m';
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function ActivityHeatmap({
  year,
  days,
  loading = false,
}: {
  year: number;
  days?: { [dayKey: string]: DaySummary };
  loading?: boolean;
}): JSX.Element {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const { cells, weekCount, maxMinutes, totalMinutes, activeDays } = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const firstWeekday = start.getDay();
    const built: HeatmapCell[] = [];
    let max = 0;
    let total = 0;
    let active = 0;

    let dayIndex = 0;
    for (
      let d = new Date(start);
      d.getTime() <= end.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      const dayKey = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const minutes = days?.[dayKey]?.minutes ?? null;
      const value = minutes?.total ?? 0;
      if (value > max) max = value;
      if (value > 0) {
        total += value;
        active += 1;
      }
      built.push({
        date: new Date(d),
        dayKey,
        weekIndex: Math.floor((dayIndex + firstWeekday) / 7),
        weekday: d.getDay(),
        minutes,
      });
      dayIndex += 1;
    }

    const weeks = built.length ? built[built.length - 1]!.weekIndex + 1 : 0;
    return {
      cells: built,
      weekCount: weeks,
      maxMinutes: max,
      totalMinutes: total,
      activeDays: active,
    };
  }, [year, days]);

  // Build a [week][weekday] grid for rendering columns.
  const grid = useMemo(() => {
    const g: (HeatmapCell | null)[][] = Array.from({ length: weekCount }, () =>
      Array.from({ length: 7 }, () => null),
    );
    for (const cell of cells) {
      g[cell.weekIndex]![cell.weekday] = cell;
    }
    return g;
  }, [cells, weekCount]);

  // Month labels positioned at the first week each month appears.
  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weekCount; w++) {
      const firstCell = grid[w]?.find((c) => c !== null);
      if (!firstCell) continue;
      const month = firstCell.date.getMonth();
      if (month !== lastMonth) {
        labels.push({ weekIndex: w, label: Months[month]!.slice(0, 3) });
        lastMonth = month;
      }
    }
    return labels;
  }, [grid, weekCount]);

  function levelFor(value: number): number {
    if (value <= 0 || maxMinutes <= 0) return 0;
    return Math.min(4, Math.ceil((value / maxMinutes) * 4));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition dark:border-gray-700/80 dark:bg-gray-800/80">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily Activity</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {activeDays.toLocaleString()} active {activeDays === 1 ? 'day' : 'days'} · {formatMinutes(totalMinutes)} in {year}
        </span>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            Loading…
          </div>
        ) : (
          <div className="relative">
            <div className="flex flex-col gap-1">
              {/* Month labels */}
              <div className="relative ml-8 h-4">
                {monthLabels.map((m) => (
                  <span
                    key={`${m.label}-${m.weekIndex}`}
                    className="absolute -translate-x-1/2 text-[10px] font-medium text-gray-400 dark:text-gray-500"
                    style={{ left: `${((m.weekIndex + 0.5) / weekCount) * 100}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              <div className="flex gap-1">
                {/* Weekday labels */}
                <div className="flex w-7 shrink-0 flex-col gap-0.5 pr-1">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <span
                      key={label}
                      className="flex flex-1 items-center text-[9px] leading-none text-gray-400 dark:text-gray-500"
                    >
                      {i % 2 === 1 ? label : ''}
                    </span>
                  ))}
                </div>

                {/* Week columns */}
                <div className="flex min-w-0 flex-1 gap-0.5">
                  {grid.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-1 flex-col gap-0.5">
                      {week.map((cell, weekday) => {
                        if (!cell) {
                          return <div key={weekday} className="aspect-square w-full" />;
                        }
                        const value = cell.minutes?.total ?? 0;
                        const level = levelFor(value);
                        return (
                          <div
                            key={weekday}
                            onMouseEnter={() => setHovered(cell)}
                            onMouseLeave={() => setHovered(null)}
                            className={`aspect-square w-full rounded-[2px] ${LEVEL_COLORS[level]} ring-1 ring-inset ring-black/5 transition hover:ring-2 hover:ring-emerald-500/60 dark:ring-white/5`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-between">
              <div className="h-8 text-xs text-gray-600 dark:text-gray-300">
                {hovered ? (
                  <div>
                    <span className="font-semibold">{formatMinutes(hovered.minutes?.total ?? 0)}</span>{' '}
                    on{' '}
                    {hovered.date.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {hovered.minutes ? (
                      <span className="ml-1 text-gray-400 dark:text-gray-500">
                        · {formatMinutes(hovered.minutes.active)} active · {formatMinutes(hovered.minutes.typing)} typing
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">Hover a day to see details</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                <span>Less</span>
                {LEVEL_COLORS.map((color, i) => (
                  <span key={i} className={`h-3 w-3 rounded-[2px] ${color} ring-1 ring-inset ring-black/5 dark:ring-white/5`} />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
