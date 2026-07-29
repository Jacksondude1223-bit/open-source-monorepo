import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { TimeEntry, Workspace } from '~/services/NewMongoTypes';
import { DiscordLogType } from '~/services/NewMongoTypes/DiscordLogging.type';
import { EmbedColor, sendWebhookMessage } from '~/services/discord.service';
import { getProcessedUserObject, getUserThumbnail } from '~/services/roblox.service';
import { getWorkspaceCurrentDistribution } from '~/services/workspaces.service';

// Default ceiling (hours) for an open shift before it is flagged for review.
export const DEFAULT_MAX_SHIFT_HOURS = 12;

/** Whole-minute duration between two timestamps (never negative). */
export function durationMinutesBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / 60000);
}

/** Resolve the distribution number a clock-in should be filed under. */
export async function currentDistributionNum(groupId: string): Promise<number> {
  return getWorkspaceCurrentDistribution(groupId);
}

/**
 * An entry needs review when an open shift has run past the configured ceiling.
 * Completed entries that were edited keep whatever flag the manager left.
 */
export function shiftExceedsMax(entry: Pick<TimeEntry, 'clockIn' | 'clockOut'>, maxShiftHours: number): boolean {
  const end = entry.clockOut ?? new Date();
  return durationMinutesBetween(entry.clockIn, end) > maxShiftHours * 60;
}

export function resolveMaxShiftHours(workspace: Workspace): number {
  const configured = workspace.timeclockSettings?.maxShiftHours;
  if (configured && configured > 0) return configured;
  return DEFAULT_MAX_SHIFT_HOURS;
}

/** Whether the timeclock feature is switched on for this workspace. */
export function timeclockEnabled(workspace: Workspace): boolean {
  return workspace.timeclockSettings?.enabled === true;
}

/**
 * Whether a specific department may use the self-service clock. The feature must
 * be enabled and, if a department allow-list is configured, the department must
 * be on it. An empty / missing list means every department is allowed.
 */
export function timeclockEnabledForDepartment(
  workspace: Workspace,
  department: { _id?: { toString(): string } | string } | null | undefined,
): boolean {
  if (!timeclockEnabled(workspace)) return false;
  const allowList = workspace.timeclockSettings?.enabledDepartments;
  if (!allowList || allowList.length === 0) return true;
  const departmentId = department?._id?.toString();
  if (!departmentId) return false;
  return allowList.includes(departmentId);
}

/**
 * Fan out a timeclock event to any matching Discord logging webhooks, mirroring
 * the pattern used by write-ups / sessions. Best-effort: failures never block
 * the originating action.
 */
export async function sendTimeclockLog(
  workspace: Workspace,
  event: Extract<DiscordLogType, 'timeclock-clock-in' | 'timeclock-clock-out' | 'timeclock-manager-edit'>,
  color: EmbedColor,
  title: string,
  description: string,
  subjectUserId?: string,
): Promise<void> {
  try {
    const mechanisms = await readminCollections.discord_logging.find({
      groupId: workspace.groupId,
      event: { $in: ['all', event] },
    }).toArray();
    if (mechanisms.length === 0) return;

    const thumbnail = subjectUserId ? await getUserThumbnail(subjectUserId).catch(() => undefined) : undefined;
    await Promise.all(
      mechanisms.map((mechanism) =>
        sendWebhookMessage(mechanism.webhookUrl, color, title, description, thumbnail).catch(() => undefined),
      ),
    );
  } catch {
    // logging is best-effort
  }
}

export type TimeEntryWithUser = TimeEntry & {
  user: Awaited<ReturnType<typeof getProcessedUserObject>>;
};

/** Attach processed Roblox user data to a list of entries for the UI. */
export async function attachUsersToEntries(entries: TimeEntry[]): Promise<TimeEntryWithUser[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      user: await getProcessedUserObject(entry.userId, true),
    })),
  );
}

/**
 * Roll timeclock entries up per user for a single distribution/period. Totals
 * are computed from the entries themselves (open shifts counted up to "now"),
 * matching how activity summaries are derived rather than stored.
 */
export type PeriodUserTotal = {
  userId: string;
  totalMinutes: number;
  entryCount: number;
  activeEntryId?: string;
  lastClockIn?: Date;
  needsReview: boolean;
};

export function rollupEntriesByUser(entries: TimeEntry[], now: Date = new Date()): PeriodUserTotal[] {
  const byUser = new Map<string, PeriodUserTotal>();
  for (const entry of entries) {
    const existing = byUser.get(entry.userId) ?? {
      userId: entry.userId,
      totalMinutes: 0,
      entryCount: 0,
      needsReview: false,
    };
    const end = entry.clockOut ?? now;
    const minutes = entry.status === 'active'
      ? durationMinutesBetween(entry.clockIn, end)
      : entry.durationMinutes ?? durationMinutesBetween(entry.clockIn, end);
    existing.totalMinutes += minutes;
    existing.entryCount += 1;
    existing.needsReview = existing.needsReview || entry.needsReview === true;
    if (entry.status === 'active') {
      existing.activeEntryId = entry._id?.toString();
    }
    if (!existing.lastClockIn || entry.clockIn > existing.lastClockIn) {
      existing.lastClockIn = entry.clockIn;
    }
    byUser.set(entry.userId, existing);
  }
  return Array.from(byUser.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/** Find a workspace member's active (open) clock-in, if any. */
export async function findActiveEntry(groupId: string, userId: string): Promise<TimeEntry | null> {
  return readminCollections.time_entry.findOne({ groupId, userId, status: 'active' });
}

export async function findEntryById(groupId: string, entryId: string): Promise<TimeEntry | null> {
  if (!ObjectId.isValid(entryId)) return null;
  return readminCollections.time_entry.findOne({ groupId, _id: new ObjectId(entryId) });
}

// ── Distribution & timeline helpers ───────────────────────────────────────────

/** A lightweight distribution descriptor for selectors and timeline framing. */
export type DistributionOption = {
  num: number;
  isCurrent: boolean;
  from: Date | null;
  to: Date | null;
};

/**
 * List a workspace's distributions newest-first, for the period selector. Falls
 * back to a single synthetic "current" entry when none have been created yet.
 */
export async function listWorkspaceDistributions(groupId: string): Promise<DistributionOption[]> {
  const distributions = await readminCollections.distribution
    .find({ groupId })
    .sort({ num: -1 })
    .toArray();

  if (distributions.length === 0) {
    return [{ num: 0, isCurrent: true, from: null, to: null }];
  }

  return distributions.map((d) => ({
    num: d.num,
    isCurrent: d.isCurrent === true,
    from: d.from ?? null,
    to: d.to ?? null,
  }));
}

/** Resolve a distribution number, defaulting to the workspace's current one. */
export async function resolveDistributionNum(groupId: string, distribution?: number): Promise<number> {
  if (typeof distribution === 'number') return distribution;
  return currentDistributionNum(groupId);
}

/** Fetch the date bounds for a distribution number, if recorded. */
export async function getDistributionBounds(
  groupId: string,
  distribution: number,
): Promise<{ from: Date | null; to: Date | null }> {
  const doc = await readminCollections.distribution.findOne({ groupId, num: distribution });
  return { from: doc?.from ?? null, to: doc?.to ?? null };
}

/** Midnight (local server time) at the start of the Monday-based week of `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

/** Add `days` whole days to a date, returning a new Date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export type TimelineSegment = {
  entryId?: string;
  start: Date;
  end: Date;
  minutes: number;
  active: boolean;
  forcedOut: boolean;
  needsReview: boolean;
  clipped: boolean; // shift extends beyond the visible window on one/both ends
};

/** Blue "tracked in-game" interval, drawn beneath the clock-in segments. */
export type TimelineGameSegment = {
  start: Date;
  end: Date;
  minutes: number;
  active: boolean; // session still in progress
  clipped: boolean;
};

/** A raw in-game session interval fed into the timeline builder. */
export type GameInterval = {
  userId: string;
  start: Date;
  end: Date | null; // null = still in game (clip to now)
  active: boolean;
};

export type TimelineUserRow = {
  userId: string;
  user: Awaited<ReturnType<typeof getProcessedUserObject>>;
  totalMinutes: number; // clocked-in minutes visible within the window
  gameMinutes: number; // tracked in-game minutes visible within the window
  segments: TimelineSegment[];
  gameSegments: TimelineGameSegment[];
};

export type Timeline = {
  windowStart: Date;
  windowEnd: Date;
  days: Date[]; // one entry per day column (start of each day)
  users: TimelineUserRow[];
};

/**
 * Build a week-style timeline: one row per user, each with the green "clocked
 * in" segments clipped to the [windowStart, windowEnd) window. Open shifts are
 * clipped to `now`. Days are emitted as day-column anchors for the UI grid.
 * Optional `gameSessions` overlay the blue "tracked in-game" intervals.
 */
export async function buildTimeline(
  entries: TimeEntry[],
  windowStart: Date,
  windowEnd: Date,
  now: Date = new Date(),
  gameSessions: GameInterval[] = [],
): Promise<Timeline> {
  const windowEndMs = windowEnd.getTime();
  const windowStartMs = windowStart.getTime();

  const byUser = new Map<string, TimelineSegment[]>();

  for (const entry of entries) {
    const rawStart = entry.clockIn.getTime();
    const cap = entry.status === 'active'
      ? Math.min(now.getTime(), windowEndMs)
      : (entry.clockOut ?? now).getTime();
    const rawEnd = cap;

    // Skip entries that don't overlap the window at all.
    if (rawEnd <= windowStartMs || rawStart >= windowEndMs) continue;

    const clippedStart = Math.max(rawStart, windowStartMs);
    const clippedEnd = Math.min(rawEnd, windowEndMs);
    if (clippedEnd <= clippedStart) continue;

    const segment: TimelineSegment = {
      entryId: entry._id?.toString(),
      start: new Date(clippedStart),
      end: new Date(clippedEnd),
      minutes: Math.round((clippedEnd - clippedStart) / 60000),
      active: entry.status === 'active',
      forcedOut: entry.forcedOut === true,
      needsReview: entry.needsReview === true,
      clipped: rawStart < windowStartMs || rawEnd > windowEndMs,
    };

    const list = byUser.get(entry.userId) ?? [];
    list.push(segment);
    byUser.set(entry.userId, list);
  }

  // Clip the in-game intervals to the same window, keyed by user.
  const gameByUser = new Map<string, TimelineGameSegment[]>();
  for (const session of gameSessions) {
    const rawStart = session.start.getTime();
    const rawEnd = (session.end ?? (session.active ? new Date(Math.min(now.getTime(), windowEndMs)) : session.start)).getTime();
    if (rawEnd <= windowStartMs || rawStart >= windowEndMs) continue;

    const clippedStart = Math.max(rawStart, windowStartMs);
    const clippedEnd = Math.min(rawEnd, windowEndMs);
    if (clippedEnd <= clippedStart) continue;

    const segment: TimelineGameSegment = {
      start: new Date(clippedStart),
      end: new Date(clippedEnd),
      minutes: Math.round((clippedEnd - clippedStart) / 60000),
      active: session.active === true,
      clipped: rawStart < windowStartMs || rawEnd > windowEndMs,
    };
    const list = gameByUser.get(session.userId) ?? [];
    list.push(segment);
    gameByUser.set(session.userId, list);
  }

  // Every user that appears in either map gets a row.
  const userIds = new Set<string>([...byUser.keys(), ...gameByUser.keys()]);

  const users: TimelineUserRow[] = await Promise.all(
    Array.from(userIds).map(async (userId) => {
      const segments = (byUser.get(userId) ?? []).sort((a, b) => a.start.getTime() - b.start.getTime());
      const gameSegments = (gameByUser.get(userId) ?? []).sort((a, b) => a.start.getTime() - b.start.getTime());
      return {
        userId,
        user: await getProcessedUserObject(userId, true),
        totalMinutes: segments.reduce((sum, s) => sum + s.minutes, 0),
        gameMinutes: gameSegments.reduce((sum, s) => sum + s.minutes, 0),
        segments,
        gameSegments,
      };
    }),
  );

  users.sort((a, b) => (b.totalMinutes + b.gameMinutes) - (a.totalMinutes + a.gameMinutes));

  const dayCount = Math.max(1, Math.round((windowEndMs - windowStartMs) / 86400000));
  const days = Array.from({ length: dayCount }, (_, i) => addDays(windowStart, i));

  return { windowStart, windowEnd, days, users };
}
