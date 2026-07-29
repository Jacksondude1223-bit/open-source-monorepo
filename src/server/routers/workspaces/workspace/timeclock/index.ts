import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { getProcessedUserObject } from '~/services/roblox.service';
import { TimeAdjustment, TimeEntry } from '~/services/NewMongoTypes';
import {
  attachUsersToEntries,
  buildTimeline,
  currentDistributionNum,
  durationMinutesBetween,
  findActiveEntry,
  findEntryById,
  getDistributionBounds,
  listWorkspaceDistributions,
  resolveDistributionNum,
  resolveMaxShiftHours,
  rollupEntriesByUser,
  sendTimeclockLog,
  shiftExceedsMax,
  startOfWeek,
  addDays,
  timeclockEnabled,
  timeclockEnabledForDepartment,
} from '~/services/workspaceServices/timeclock';

// ── Permission helpers ────────────────────────────────────────────────────────
const canClock = (perms: any) => perms?.admin || perms?.timeclock?.clock;
const canView = (perms: any) => perms?.admin || perms?.timeclock?.view || perms?.timeclock?.manage || perms?.timeclock?.edit;
const canManage = (perms: any) => perms?.admin || perms?.timeclock?.manage;
const canEdit = (perms: any) => perms?.admin || perms?.timeclock?.edit;

export const workspaceTimeclockRouter = router({
  // ── Self-service: status + clock in/out ────────────────────────────────────
  getStatus: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const { workspace, department, user } = ctx;
      const userId = user.dbUser.robloxId!.toString();
      const distribution = await currentDistributionNum(workspace.groupId);

      const [activeEntry, periodEntries] = await Promise.all([
        findActiveEntry(workspace.groupId, userId),
        readminCollections.time_entry
          .find({ groupId: workspace.groupId, userId, distribution })
          .sort({ clockIn: -1 })
          .toArray(),
      ]);

      const [totals] = rollupEntriesByUser(periodEntries);

      const enabledForDepartment = timeclockEnabledForDepartment(workspace, department);

      return {
        enabled: enabledForDepartment,
        canClock: enabledForDepartment && !!canClock(department.permissions),
        canView: !!canView(department.permissions),
        canManage: !!canManage(department.permissions),
        canEdit: !!canEdit(department.permissions),
        distribution,
        activeEntry: activeEntry ?? null,
        periodMinutes: totals?.totalMinutes ?? 0,
        periodEntryCount: totals?.entryCount ?? 0,
        recentEntries: periodEntries.slice(0, 10),
      };
    }),

  clockIn: workspaceProcedure
    .input(z.object({ groupId: z.string(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      if (!timeclockEnabled(workspace)) {
        throw ReturnNormalFailure('BAD_REQUEST', 'The timeclock is not enabled for this workspace.');
      }
      if (!timeclockEnabledForDepartment(workspace, department)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'The timeclock is not enabled for your department.');
      }
      if (!canClock(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to clock in.');
      }
      const userId = user.dbUser.robloxId!.toString();

      const existing = await findActiveEntry(workspace.groupId, userId);
      if (existing) {
        throw ReturnNormalFailure('BAD_REQUEST', 'You are already clocked in.');
      }

      const now = new Date();
      const entry: TimeEntry = {
        groupId: workspace.groupId,
        userId,
        distribution: await currentDistributionNum(workspace.groupId),
        status: 'active',
        source: 'self',
        clockIn: now,
        note: input.note?.trim() || undefined,
        createdBy: userId,
        created: now,
      };

      try {
        const result = await readminCollections.time_entry.insertOne(entry);
        entry._id = result.insertedId;
      } catch {
        // Unique partial index on { groupId, userId, status:'active' } — racing
        // double clock-ins land here.
        throw ReturnNormalFailure('BAD_REQUEST', 'You are already clocked in.');
      }

      const actor = await getProcessedUserObject(userId, true);
      await sendTimeclockLog(
        workspace,
        'timeclock-clock-in',
        'green',
        'Clocked In',
        `${actor?.name || userId} clocked in.`,
        userId,
      );

      return entry;
    }),

  clockOut: workspaceProcedure
    .input(z.object({ groupId: z.string(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      if (!canClock(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to clock out.');
      }
      const userId = user.dbUser.robloxId!.toString();

      const active = await findActiveEntry(workspace.groupId, userId);
      if (!active) {
        throw ReturnNormalFailure('BAD_REQUEST', 'You are not currently clocked in.');
      }

      const now = new Date();
      const durationMinutes = durationMinutesBetween(active.clockIn, now);
      const needsReview = shiftExceedsMax({ clockIn: active.clockIn, clockOut: now }, resolveMaxShiftHours(workspace));

      await readminCollections.time_entry.updateOne(
        { _id: active._id },
        {
          $set: {
            status: 'completed',
            clockOut: now,
            durationMinutes,
            needsReview,
            note: input.note?.trim() || active.note,
            updated: now,
          },
        },
      );

      const actor = await getProcessedUserObject(userId, true);
      await sendTimeclockLog(
        workspace,
        'timeclock-clock-out',
        'blue',
        'Clocked Out',
        `${actor?.name || userId} clocked out after ${durationMinutes} minute(s).`,
        userId,
      );

      return { ...active, status: 'completed', clockOut: now, durationMinutes, needsReview };
    }),

  // ── Manager views ──────────────────────────────────────────────────────────
  getManagerOverview: workspaceProcedure
    .input(z.object({ groupId: z.string(), distribution: z.number().int().min(0).optional() }))
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      if (!canView(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to view timeclock records.');
      }
      const distribution = await resolveDistributionNum(workspace.groupId, input.distribution);
      const currentDistribution = await currentDistributionNum(workspace.groupId);
      const isCurrent = distribution === currentDistribution;

      const [distributions, activeEntries, recentEntries, periodEntries] = await Promise.all([
        listWorkspaceDistributions(workspace.groupId),
        // Active shifts only make sense for the live period.
        isCurrent
          ? readminCollections.time_entry
              .find({ groupId: workspace.groupId, status: 'active' })
              .sort({ clockIn: 1 })
              .toArray()
          : Promise.resolve([]),
        readminCollections.time_entry
          .find({ groupId: workspace.groupId, distribution })
          .sort({ clockIn: -1 })
          .limit(25)
          .toArray(),
        readminCollections.time_entry
          .find({ groupId: workspace.groupId, distribution })
          .toArray(),
      ]);

      const reviewEntries = periodEntries.filter((e) => e.needsReview === true);
      const totals = rollupEntriesByUser(periodEntries);

      const [currentlyClockedIn, recent, needsReview, userTotals] = await Promise.all([
        attachUsersToEntries(activeEntries),
        attachUsersToEntries(recentEntries),
        attachUsersToEntries(reviewEntries),
        Promise.all(
          totals.map(async (t) => ({ ...t, user: await getProcessedUserObject(t.userId, true) })),
        ),
      ]);

      return {
        distribution,
        currentDistribution,
        isCurrent,
        distributions,
        canManage: !!canManage(department.permissions),
        canEdit: !!canEdit(department.permissions),
        allowManualEntries: workspace.timeclockSettings?.allowManualEntries !== false,
        currentlyClockedIn,
        recent,
        needsReview,
        userTotals,
        clockedInCount: activeEntries.length,
        periodTotalMinutes: totals.reduce((sum, t) => sum + t.totalMinutes, 0),
      };
    }),

  // ── Week timeline visualization ────────────────────────────────────────────
  // Returns one row per user with the green "clocked in" segments for a 7-day
  // window. `weekStart` navigates between weeks; defaults to the current week
  // (or the start of the selected distribution when viewing a past period).
  getTimeline: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        distribution: z.number().int().min(0).optional(),
        weekStart: z.string().datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      if (!canView(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to view timeclock records.');
      }

      const distribution = await resolveDistributionNum(workspace.groupId, input.distribution);
      const bounds = await getDistributionBounds(workspace.groupId, distribution);

      // Anchor the week. Explicit weekStart wins; otherwise frame on the
      // distribution's start (for past periods) or the current week (live).
      let windowStart: Date;
      if (input.weekStart) {
        windowStart = startOfWeek(new Date(input.weekStart));
      } else if (bounds.from && bounds.to && bounds.to.getTime() < Date.now()) {
        windowStart = startOfWeek(bounds.from);
      } else {
        windowStart = startOfWeek(new Date());
      }
      const windowEnd = addDays(windowStart, 7);

      // Pull entries for this distribution that overlap the window.
      const entries = await readminCollections.time_entry
        .find({
          groupId: workspace.groupId,
          distribution,
          clockIn: { $lt: windowEnd },
          $or: [{ clockOut: { $gt: windowStart } }, { clockOut: null }, { status: 'active' }],
        })
        .toArray();

      // Overlay tracked in-game sessions for the same distribution/window.
      const groupIdNum = parseInt(workspace.groupId, 10);
      const gameDocs = Number.isNaN(groupIdNum)
        ? []
        : await readminCollections.user_game_session
            .find({
              groupId: groupIdNum,
              distribution,
              // Match by start time only — `ended` can be stored as an epoch
              // number, which won't compare against a Date in Mongo. We pick up
              // every session that began during the visible week, plus any that
              // are still live. buildTimeline clips open sessions to "now".
              $or: [
                { started: { $gte: windowStart, $lt: windowEnd } },
                { inGame: true, started: { $lt: windowEnd } },
              ],
            } as any)
            .toArray();

      const gameSessions = gameDocs.map((s) => {
        const start = new Date(s.started);

        // `ended` may be a Date or an epoch number (seconds or milliseconds).
        let end: Date | null = null;
        if (s.ended != null) {
          const raw = typeof s.ended === 'number'
            ? new Date(s.ended < 1e12 ? s.ended * 1000 : s.ended)
            : new Date(s.ended);
          if (!Number.isNaN(raw.getTime()) && raw.getTime() > start.getTime()) {
            end = raw;
          }
        }
        // Fall back to the tracked duration when there's no usable end stamp.
        if (!end && s.minutes?.total) {
          end = new Date(start.getTime() + s.minutes.total * 60000);
        }

        // Only "active" (drawn out to now) when genuinely still in game.
        const stillInGame = s.ended == null && s.inGame === true;
        return {
          userId: s.userId.toString(),
          start,
          end: stillInGame ? null : end,
          active: stillInGame,
        };
      });

      const timeline = await buildTimeline(entries, windowStart, windowEnd, new Date(), gameSessions);

      return {
        distribution,
        weekStart: windowStart,
        weekEnd: windowEnd,
        days: timeline.days,
        users: timeline.users,
        distributionFrom: bounds.from,
        distributionTo: bounds.to,
      };
    }),

  // Per-user history for the staff profile Timeclock tab.
  getUserEntries: workspaceProcedure
    .input(z.object({ groupId: z.string(), userId: z.string(), distribution: z.number().int().min(0).optional(), limit: z.number().min(1).max(200).optional() }))
    .query(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const isSelf = input.userId === user.dbUser.robloxId?.toString();
      if (!isSelf && !canView(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to view timeclock records.');
      }
      const distribution = await resolveDistributionNum(workspace.groupId, input.distribution);

      const entries = await readminCollections.time_entry
        .find({ groupId: workspace.groupId, userId: input.userId })
        .sort({ clockIn: -1 })
        .limit(input.limit ?? 50)
        .toArray();

      const periodEntries = entries.filter((e) => e.distribution === distribution);
      const [periodTotals] = rollupEntriesByUser(periodEntries);

      return {
        distribution,
        canManage: !!canManage(department.permissions),
        canEdit: !!canEdit(department.permissions),
        periodMinutes: periodTotals?.totalMinutes ?? 0,
        periodEntryCount: periodTotals?.entryCount ?? 0,
        entries,
      };
    }),

  // ── Manager corrections (all require a reason + audited) ────────────────────
  forceClockOut: workspaceProcedure
    .input(z.object({ groupId: z.string(), entryId: z.string(), reason: z.string().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      if (!canManage(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to manage timeclock records.');
      }
      const actorId = user.dbUser.robloxId!.toString();

      const entry = await findEntryById(workspace.groupId, input.entryId);
      if (!entry || !entry._id) {
        throw ReturnNormalFailure('NOT_FOUND', 'Time entry not found.');
      }
      if (entry.status !== 'active') {
        throw ReturnNormalFailure('BAD_REQUEST', 'That entry is already clocked out.');
      }

      const now = new Date();
      const durationMinutes = durationMinutesBetween(entry.clockIn, now);
      const adjustment: TimeAdjustment = {
        by: actorId,
        at: now,
        action: 'force_out',
        reason: input.reason.trim(),
        previous: { clockOut: null },
        next: { clockOut: now, durationMinutes },
      };

      await readminCollections.time_entry.updateOne(
        { _id: entry._id },
        {
          $set: {
            status: 'completed',
            clockOut: now,
            durationMinutes,
            forcedOut: true,
            needsReview: shiftExceedsMax({ clockIn: entry.clockIn, clockOut: now }, resolveMaxShiftHours(workspace)),
            editedBy: actorId,
            updated: now,
          },
          $push: { adjustments: adjustment },
        },
      );

      const [actor, subject] = await Promise.all([
        getProcessedUserObject(actorId, true),
        getProcessedUserObject(entry.userId, true),
      ]);
      await sendTimeclockLog(
        workspace,
        'timeclock-manager-edit',
        'orange',
        'Force Clock Out',
        `${actor?.name || actorId} force clocked out ${subject?.name || entry.userId} (${durationMinutes}m). Reason: ${input.reason.trim()}`,
        entry.userId,
      );

      return { ok: true };
    }),

  editEntry: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        entryId: z.string(),
        reason: z.string().min(3).max(500),
        clockIn: z.string().datetime().optional(),
        clockOut: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      if (!canEdit(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to edit timeclock records.');
      }
      const actorId = user.dbUser.robloxId!.toString();

      const entry = await findEntryById(workspace.groupId, input.entryId);
      if (!entry || !entry._id) {
        throw ReturnNormalFailure('NOT_FOUND', 'Time entry not found.');
      }

      const newClockIn = input.clockIn ? new Date(input.clockIn) : entry.clockIn;
      const newClockOut = input.clockOut ? new Date(input.clockOut) : entry.clockOut ?? null;

      if (newClockOut && newClockOut.getTime() <= newClockIn.getTime()) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Clock-out time must be after clock-in time.');
      }

      const now = new Date();
      const status = newClockOut ? 'completed' : 'active';
      const durationMinutes = newClockOut ? durationMinutesBetween(newClockIn, newClockOut) : undefined;

      const adjustment: TimeAdjustment = {
        by: actorId,
        at: now,
        action: 'edit',
        reason: input.reason.trim(),
        previous: { clockIn: entry.clockIn, clockOut: entry.clockOut ?? null, durationMinutes: entry.durationMinutes },
        next: { clockIn: newClockIn, clockOut: newClockOut, durationMinutes },
      };

      await readminCollections.time_entry.updateOne(
        { _id: entry._id },
        {
          $set: {
            clockIn: newClockIn,
            clockOut: newClockOut,
            status,
            durationMinutes,
            needsReview: newClockOut
              ? shiftExceedsMax({ clockIn: newClockIn, clockOut: newClockOut }, resolveMaxShiftHours(workspace))
              : false,
            editedBy: actorId,
            updated: now,
          },
          $push: { adjustments: adjustment },
        },
      );

      const [actor, subject] = await Promise.all([
        getProcessedUserObject(actorId, true),
        getProcessedUserObject(entry.userId, true),
      ]);
      await sendTimeclockLog(
        workspace,
        'timeclock-manager-edit',
        'orange',
        'Time Entry Edited',
        `${actor?.name || actorId} edited a time entry for ${subject?.name || entry.userId}. Reason: ${input.reason.trim()}`,
        entry.userId,
      );

      return { ok: true };
    }),

  addManualEntry: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        clockIn: z.string().datetime(),
        clockOut: z.string().datetime(),
        reason: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      if (!canManage(department.permissions) && !canEdit(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to add timeclock records.');
      }
      if (workspace.timeclockSettings?.allowManualEntries === false) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Manual time entries are disabled for this workspace.');
      }
      const actorId = user.dbUser.robloxId!.toString();

      const clockIn = new Date(input.clockIn);
      const clockOut = new Date(input.clockOut);
      if (clockOut.getTime() <= clockIn.getTime()) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Clock-out time must be after clock-in time.');
      }

      // File under the distribution that was current when the work happened.
      const distributionDoc = await readminCollections.distribution.findOne({
        groupId: workspace.groupId,
        from: { $lte: clockIn },
        $or: [{ to: { $gte: clockIn } }, { to: { $exists: false } }, { isCurrent: true }],
      }, { sort: { num: -1 } });
      const distribution = distributionDoc?.num ?? (await currentDistributionNum(workspace.groupId));

      const now = new Date();
      const durationMinutes = durationMinutesBetween(clockIn, clockOut);
      const entry: TimeEntry = {
        groupId: workspace.groupId,
        userId: input.userId,
        distribution,
        status: 'completed',
        source: 'manual',
        clockIn,
        clockOut,
        durationMinutes,
        needsReview: shiftExceedsMax({ clockIn, clockOut }, resolveMaxShiftHours(workspace)),
        createdBy: actorId,
        editedBy: actorId,
        adjustments: [
          {
            by: actorId,
            at: now,
            action: 'manual_add',
            reason: input.reason.trim(),
            next: { clockIn, clockOut, durationMinutes },
          },
        ],
        created: now,
      };

      const result = await readminCollections.time_entry.insertOne(entry);
      entry._id = result.insertedId;

      const [actor, subject] = await Promise.all([
        getProcessedUserObject(actorId, true),
        getProcessedUserObject(input.userId, true),
      ]);
      await sendTimeclockLog(
        workspace,
        'timeclock-manager-edit',
        'orange',
        'Manual Time Added',
        `${actor?.name || actorId} added ${durationMinutes}m of manual time for ${subject?.name || input.userId}. Reason: ${input.reason.trim()}`,
        input.userId,
      );

      return entry;
    }),

  // Audit trail / detail for a single entry.
  getEntry: workspaceProcedure
    .input(z.object({ groupId: z.string(), entryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const entry = await findEntryById(workspace.groupId, input.entryId);
      if (!entry) {
        throw ReturnNormalFailure('NOT_FOUND', 'Time entry not found.');
      }
      const isSelf = entry.userId === user.dbUser.robloxId?.toString();
      if (!isSelf && !canView(department.permissions)) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to view this record.');
      }

      const adjustmentActors = await Promise.all(
        (entry.adjustments ?? []).map((a) => getProcessedUserObject(a.by, true)),
      );

      return {
        entry,
        subject: await getProcessedUserObject(entry.userId, true),
        adjustmentActors,
      };
    }),
});
