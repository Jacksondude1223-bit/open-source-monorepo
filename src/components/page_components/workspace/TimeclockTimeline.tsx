/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from 'react';
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/20/solid';
import Card from '~/components/ui/Card';
import Small from '~/components/NextGenStyles/Small';
import { formatDurationMinutes } from '~/utils/formatDuration';

type TimelineSegment = {
  entryId?: string;
  start: string | Date;
  end: string | Date;
  minutes: number;
  active: boolean;
  forcedOut: boolean;
  needsReview: boolean;
  clipped: boolean;
};

type TimelineGameSegment = {
  start: string | Date;
  end: string | Date;
  minutes: number;
  active: boolean;
  clipped: boolean;
};

type TimelineUser = {
  userId: string;
  user?: { name?: string; displayName?: string; thumbnail?: string };
  totalMinutes: number;
  gameMinutes?: number;
  segments: TimelineSegment[];
  gameSegments?: TimelineGameSegment[];
};

export type TimelineData = {
  weekStart: string | Date;
  weekEnd: string | Date;
  days: (string | Date)[];
  users: TimelineUser[];
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6];

function pct(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function formatClock(value: string | Date) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Whether [aStart, aEnd) overlaps any of the given intervals. */
function overlapsAny(aStart: number, aEnd: number, others: { s: number; e: number }[]) {
  return others.some((o) => aStart < o.e && o.s < aEnd);
}

export default function TimeclockTimeline({
  data,
  loading,
  onPrevWeek,
  onNextWeek,
  canGoNext,
}: {
  data?: TimelineData;
  loading?: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  canGoNext: boolean;
}) {
  const [zoomIdx, setZoomIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const zoom = ZOOM_LEVELS[zoomIdx] ?? 1;

  const weekStartMs = data ? new Date(data.weekStart).getTime() : 0;
  const weekEndMs = data ? new Date(data.weekEnd).getTime() : 0;
  const span = weekEndMs - weekStartMs || 1;

  // Marker for "now" if it falls inside the visible window.
  const nowPct = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    if (now < weekStartMs || now > weekEndMs) return null;
    return ((now - weekStartMs) / span) * 100;
  }, [data, weekStartMs, weekEndMs, span]);

  const rangeLabel = data
    ? `${new Date(data.weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(
        new Date(data.weekEnd).getTime() - 1,
      ).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
    : '';

  const trackHeight = expanded ? 'h-14' : 'h-8';
  const trackWidth = zoom > 1 ? `${zoom * 100}%` : '100%';

  return (
    <Card className="flex flex-col gap-3 overflow-hidden">
      {/* Header: week navigation + zoom + legend */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-row items-center gap-2">
          <button
            onClick={onPrevWeek}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-36 text-center">{rangeLabel}</span>
          <button
            onClick={onNextWeek}
            disabled={!canGoNext}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 transition enabled:hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800"
          >
            ›
          </button>

          {/* Zoom + expand controls */}
          <div className="ml-1 flex flex-row items-center gap-1">
            <button
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              disabled={zoomIdx === 0}
              title="Zoom out"
              className="rounded-md border border-gray-200 p-1 text-gray-600 transition enabled:hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800"
            >
              <MagnifyingGlassMinusIcon className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">{zoom}×</span>
            <button
              onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              title="Zoom in"
              className="rounded-md border border-gray-200 p-1 text-gray-600 transition enabled:hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800"
            >
              <MagnifyingGlassPlusIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? 'Collapse rows' : 'Expand rows'}
              className="rounded-md border border-gray-200 p-1 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {expanded ? <ArrowsPointingInIcon className="h-4 w-4" /> : <ArrowsPointingOutIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Clocked in</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 animate-pulse" /> Active</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Review</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> In game</span>
        </div>
      </div>

      {/* Horizontal scroll wrapper — labels stay pinned, tracks scale with zoom */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: trackWidth }}>
          {/* Day column header */}
          <div className="flex flex-row">
            <div className="sticky left-0 z-20 w-40 shrink-0 bg-white dark:bg-gray-800" />
            <div className="relative grid flex-1 grid-cols-7 border-b border-gray-100 dark:border-gray-700/60">
              {(data?.days ?? Array.from({ length: 7 })).map((day, i) => (
                <div key={i} className="px-1 pb-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  {day ? (
                    <>
                      <span className="hidden sm:inline">{DAY_LABELS[i]} </span>
                      {new Date(day as any).getDate()}
                    </>
                  ) : (
                    DAY_LABELS[i]
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="flex flex-col">
            {loading && (
              <div className="py-10 text-center"><Small>Loading timeline…</Small></div>
            )}

            {!loading && data && data.users.length === 0 && (
              <div className="py-10 text-center"><Small>No clock activity during this week.</Small></div>
            )}

            {!loading && data?.users.map((row) => {
              const gameSegments = row.gameSegments ?? [];
              const clockRanges = row.segments.map((s) => ({ s: new Date(s.start).getTime(), e: new Date(s.end).getTime() }));
              const gameRanges = gameSegments.map((s) => ({ s: new Date(s.start).getTime(), e: new Date(s.end).getTime() }));

              return (
                <div key={row.userId} className="flex flex-row items-center border-b border-gray-50 py-1.5 last:border-0 dark:border-gray-800">
                  {/* User label (pinned during horizontal scroll) */}
                  <div className="sticky left-0 z-20 flex w-40 shrink-0 flex-row items-center gap-2 bg-white pr-2 dark:bg-gray-800">
                    {row.user?.thumbnail && (
                      <img src={row.user.thumbnail} alt="" className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-700" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{row.user?.name || row.userId}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <span className="text-emerald-600 dark:text-emerald-400">{formatDurationMinutes(row.totalMinutes)}</span>
                        {(row.gameMinutes ?? 0) > 0 && (
                          <span className="text-blue-500 dark:text-blue-400">{formatDurationMinutes(row.gameMinutes ?? 0)} in game</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Track */}
                  <div className={`relative ${trackHeight} flex-1 rounded-md bg-gray-50 dark:bg-gray-800/60`}>
                    {/* Day gridlines */}
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className={i > 0 ? 'border-l border-gray-100 dark:border-gray-700/50' : ''} />
                      ))}
                    </div>

                    {/* Now marker */}
                    {nowPct !== null && (
                      <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-rose-400/80" style={{ left: pct(nowPct) }} />
                    )}

                    {/* In-game (blue) segments — drop to the bottom half where they overlap a clock-in */}
                    {gameSegments.map((seg, i) => {
                      const startMs = new Date(seg.start).getTime();
                      const endMs = new Date(seg.end).getTime();
                      const left = ((startMs - weekStartMs) / span) * 100;
                      const width = ((endMs - startMs) / span) * 100;
                      const split = overlapsAny(startMs, endMs, clockRanges);
                      const vertical = split ? 'top-1/2 bottom-1' : 'top-1.5 bottom-1.5';
                      return (
                        <div
                          key={`g-${i}`}
                          title={`In game · ${formatClock(seg.start)} – ${seg.active ? 'now' : formatClock(seg.end)} · ${formatDurationMinutes(seg.minutes)}`}
                          className={`absolute ${vertical} rounded-[3px] ${seg.active ? 'bg-blue-400 animate-pulse' : 'bg-blue-500'} opacity-80 transition hover:opacity-100`}
                          style={{ left: pct(left), width: `max(2px, ${pct(width)})` }}
                        />
                      );
                    })}

                    {/* Clock-in (green/amber) segments — shrink to top half where in-game overlaps */}
                    {row.segments.map((seg, i) => {
                      const startMs = new Date(seg.start).getTime();
                      const endMs = new Date(seg.end).getTime();
                      const left = ((startMs - weekStartMs) / span) * 100;
                      const width = ((endMs - startMs) / span) * 100;
                      const split = overlapsAny(startMs, endMs, gameRanges);
                      const vertical = split ? 'top-1.5 bottom-1/2' : 'top-1.5 bottom-1.5';
                      const color = seg.needsReview
                        ? 'bg-amber-500'
                        : seg.active
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-emerald-500';
                      return (
                        <div
                          key={seg.entryId || `c-${i}`}
                          title={`${formatClock(seg.start)} – ${seg.active ? 'now' : formatClock(seg.end)} · ${formatDurationMinutes(seg.minutes)}${seg.forcedOut ? ' · forced out' : ''}${seg.needsReview ? ' · needs review' : ''}`}
                          className={`absolute ${vertical} z-1 rounded-[3px] ${color} opacity-90 transition hover:opacity-100`}
                          style={{ left: pct(left), width: `max(2px, ${pct(width)})` }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
