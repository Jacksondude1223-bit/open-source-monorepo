/**
 * Format a whole-minute duration as a compact human string, e.g. 0m, 45m,
 * 2h, 2h 30m. Shared by the timeclock UI so totals render consistently with
 * the activity heatmap.
 */
export function formatDurationMinutes(total: number): string {
  if (!total || total <= 0) return '0m';
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Format a Date (or ISO string) as a short local date + time, e.g. "Jun 2, 3:45 PM". */
export function formatEntryTime(value?: Date | string | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Format a Date for an <input type="datetime-local"> value (local time). */
export function toDatetimeLocalValue(value?: Date | string | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}
