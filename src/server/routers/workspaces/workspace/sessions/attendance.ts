import { z } from 'zod';
import { WithId } from 'mongodb';
import { workspaceProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { Session } from '~/services/NewMongoTypes';
import {
  buildRoleNameMap,
  normalizeServer,
  NormalizedClaim,
} from '~/fastifyAPI/apiHandlers/sessionsV2/_normalize';
import { getDistributionWindow } from '~/services/businessLogic/getDistributionWindow';

export type AttendanceStatus = 'H' | 'A' | 'N' | 'R' | 'C' | 'U' | 'Leave';

// Coerce a started/ended value (Date, or a number in seconds or ms) to epoch ms.
function toMs(v: Date | number | undefined | null, fallback: number): number {
  if (v == null) return fallback;
  if (v instanceof Date) return v.getTime();
  // Numbers below ~1e12 are almost certainly seconds, not milliseconds.
  return v < 1e12 ? v * 1000 : v;
}

// Reduce a user's claims across all servers of a session to the single strongest
// one. A completed claim on a configured host role outranks everything so that
// "Hosted" (H) wins when it should.
function claimScore(claim: NormalizedClaim, hostRoleSet: Set<string>): number {
  const stateScore =
    claim.state === 'completed' || claim.state === 'passed'
      ? 4
      : claim.state === 'current'
        ? 2
        : claim.state === 'failed'
          ? 0
          : 1; // 'none'
  const hostBonus = claim.roleId && hostRoleSet.has(claim.roleId) ? 10 : 0;
  return stateScore + hostBonus;
}

export const workspaceSessionsAttendanceRouter = router({
  // Distributions for the page's period dropdown (newest first).
  listDistributions: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const { workspace } = ctx;
      const distributions = await readminCollections.distribution
        .find({ groupId: workspace.groupId })
        .sort({ num: -1 })
        .toArray();
      return distributions.map((d) => ({
        num: d.num,
        from: d.from,
        to: d.to ?? null,
        isCurrent: d.isCurrent,
      }));
    }),

  // Settings + the option lists the settings UI needs to render its pickers.
  getSettings: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const { workspace } = ctx;
      const settings = workspace.sessionAttendanceSettings ?? {
        visibleDepartmentIds: [],
        hostingRoleIds: [],
      };

      const departments = await readminCollections.department
        .find({ groupId: workspace.groupId })
        .toArray();
      const roleGroups = await readminCollections.session_roles
        .find({ groupId: workspace.groupId })
        .toArray();

      return {
        settings,
        departments: departments.map((d) => ({
          id: d._id.toString(),
          name: d.name,
        })),
        roleGroups: roleGroups.map((g) => ({
          id: g.id,
          name: g.name,
          roles: g.roles.map((r) => ({ id: r.id, name: r.name })),
        })),
      };
    }),

  updateSettings: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        visibleDepartmentIds: z.array(z.string()),
        hostingRoleIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      if (!department.permissions.admin && !department.permissions.sessions.manage) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be able to manage sessions to change attendance settings',
        );
      }

      // Keep only ids that actually belong to this workspace.
      const validDepartments = await readminCollections.department
        .find({ groupId: workspace.groupId })
        .toArray();
      const validDeptIds = new Set(validDepartments.map((d) => d._id.toString()));
      const roleGroups = await readminCollections.session_roles
        .find({ groupId: workspace.groupId })
        .toArray();
      const validRoleIds = new Set(
        roleGroups.flatMap((g) => g.roles.map((r) => r.id)),
      );

      const sessionAttendanceSettings = {
        visibleDepartmentIds: input.visibleDepartmentIds.filter((id) =>
          validDeptIds.has(id),
        ),
        hostingRoleIds: input.hostingRoleIds.filter((id) => validRoleIds.has(id)),
      };

      await readminCollections.workspace.updateOne(
        { _id: workspace._id },
        { $set: { sessionAttendanceSettings } },
      );

      return sessionAttendanceSettings;
    }),

  // The attendance grid: rows = users grouped by department, columns = sessions
  // in the selected distribution, cells = a per-(user, session) status letter.
  getAttendanceGrid: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        distributionNumber: z.number().int().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const groupId = workspace.groupId;

      if (!department.permissions.admin && !department.permissions.sessions.attendance) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to view session attendance',
        );
      }

      // 1. Resolve the distribution + its [from, to] window.
      const distribution =
        input.distributionNumber != null
          ? await readminCollections.distribution.findOne({
              groupId,
              num: input.distributionNumber,
            })
          : await readminCollections.distribution.findOne({
              groupId,
              isCurrent: true,
            });
      if (!distribution) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Distribution not found');
      }
      const now = new Date();
      const { from, to } = getDistributionWindow(workspace, distribution, now);
      const nowMs = now.getTime();

      // 2. Settings.
      const settings = workspace.sessionAttendanceSettings ?? {
        visibleDepartmentIds: [],
        hostingRoleIds: [],
      };
      const hostRoleSet = new Set(settings.hostingRoleIds);

      // 3. Sessions = ordered columns. Normalize claims once per session.
      const sessionDocs = await readminCollections.session
        .find({ groupId, date: { $gte: from, $lte: to } })
        .sort({ date: 1 })
        .toArray();
      const roleNameMap = await buildRoleNameMap(groupId);

      const sessionIds = sessionDocs.map((s) => s._id.toString());
      const sessionIdSet = new Set(sessionIds);

      // sessionId -> (userId -> strongest claim)
      const claimsBySession = new Map<string, Map<string, NormalizedClaim>>();
      const claimantIdSet = new Set<string>();
      for (const session of sessionDocs) {
        const perUser = new Map<string, NormalizedClaim>();
        for (const [serverId, server] of Object.entries(session.servers || {})) {
          const normalized = normalizeServer(serverId, server, roleNameMap);
          for (const claim of normalized.claims) {
            claimantIdSet.add(claim.userId);
            const existing = perUser.get(claim.userId);
            if (
              !existing ||
              claimScore(claim, hostRoleSet) > claimScore(existing, hostRoleSet)
            ) {
              perUser.set(claim.userId, claim);
            }
          }
        }
        claimsBySession.set(session._id.toString(), perUser);
      }

      // 4. Rows: visible departments and their members (explicit + by rank).
      const allDepartments = await readminCollections.department
        .find({ groupId })
        .toArray();
      const visibleDeptIds =
        settings.visibleDepartmentIds.length > 0
          ? allDepartments
              .filter((d) =>
                settings.visibleDepartmentIds.includes(d._id.toString()),
              )
              .map((d) => d._id)
          : allDepartments.map((d) => d._id);

      const [explicitMembers, rankMembers] = await Promise.all([
        readminCollections.department_users
          .find({ groupId, departmentId: { $in: visibleDeptIds } })
          .toArray(),
        readminCollections.group_member
          .find({ groupId, departmentId: { $in: visibleDeptIds } })
          .toArray(),
      ]);

      // deptId -> set of member userIds (string form)
      const membersByDept = new Map<string, Set<string>>();
      const addMember = (deptId: string, userId: string) => {
        if (!membersByDept.has(deptId)) membersByDept.set(deptId, new Set());
        membersByDept.get(deptId)!.add(userId);
      };
      for (const m of explicitMembers) {
        addMember(m.departmentId.toString(), m.userId.toString());
      }
      for (const m of rankMembers) {
        if (m.departmentId) addMember(m.departmentId.toString(), m.userId.toString());
      }

      const rowUserIds = new Set<string>();
      for (const set of membersByDept.values()) {
        for (const id of set) rowUserIds.add(id);
      }

      // 5. Play data — for every row user AND every claimant (needed to decide
      // whether a session was truly Cancelled). One query.
      const playLookupIds = new Set<string>([...rowUserIds, ...claimantIdSet]);
      const playLookupNums = Array.from(playLookupIds)
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n));
      const gameSessions = await readminCollections.user_game_session
        .find(
          {
            groupId: Number(groupId),
            distribution: distribution.num,
            userId: { $in: playLookupNums },
          },
          { projection: { userId: 1, attendedSessions: 1, started: 1, ended: 1 } },
        )
        .toArray();

      const playedByUser = new Map<string, Set<string>>();
      const markPlayed = (userId: string, sessionId: string) => {
        if (!playedByUser.has(userId)) playedByUser.set(userId, new Set());
        playedByUser.get(userId)!.add(sessionId);
      };
      for (const gs of gameSessions) {
        const uid = gs.userId.toString();
        // (a) Sessions the cron already stamped onto this play doc.
        for (const sid of gs.attendedSessions ?? []) {
          if (sessionIdSet.has(sid)) markPlayed(uid, sid);
        }
        // (b) Live overlap — catches the current distribution before the cron runs.
        const gsStart = toMs(gs.started, 0);
        const gsEnd = toMs(gs.ended, nowMs);
        for (const session of sessionDocs) {
          const sStart = new Date(session.date).getTime();
          const sEnd = new Date(session.endsAt).getTime();
          if (gsStart <= sEnd && gsEnd >= sStart) {
            markPlayed(uid, session._id.toString());
          }
        }
      }

      // 6. Leave — approved inactivity windows overlapping the distribution.
      const inactivities = await readminCollections.inactivity
        .find({
          groupId,
          'request.approved': true,
          starts: { $lte: to },
          ends: { $gte: from },
          userId: { $in: Array.from(rowUserIds) },
        })
        .toArray();
      const leaveByUser = new Map<string, Array<{ start: number; end: number }>>();
      for (const inactivity of inactivities) {
        const uid = inactivity.userId.toString();
        if (!leaveByUser.has(uid)) leaveByUser.set(uid, []);
        leaveByUser.get(uid)!.push({
          start: new Date(inactivity.starts).getTime(),
          end: new Date(inactivity.ends).getTime(),
        });
      }

      // 7. Release audit — powers "Replaced" (R).
      const releases = await readminCollections.session_claim_release
        .find({
          groupId,
          sessionId: { $in: sessionIds },
          userId: { $in: Array.from(rowUserIds) },
        })
        .toArray();
      const releasedSet = new Set(
        releases.map((r) => `${r.userId}:${r.sessionId}`),
      );

      // 8. Per-session Cancelled flag: had claimants, none of them played.
      const cancelledSet = new Set<string>();
      for (const session of sessionDocs) {
        const sid = session._id.toString();
        const claimants = claimsBySession.get(sid);
        if (claimants && claimants.size > 0) {
          let anyPlayed = false;
          for (const userId of claimants.keys()) {
            if (playedByUser.get(userId)?.has(sid)) {
              anyPlayed = true;
              break;
            }
          }
          if (!anyPlayed) cancelledSet.add(sid);
        }
      }

      // 8b. Only show sessions that actually had activity. A session document
      // is created the moment anyone merely opens a scheduled slot (with empty
      // claims/servers), so the collection is full of slots nobody ever used.
      // We drop those empty columns and keep a session only if it had at least
      // one claim, one play, or one release somewhere in it.
      const playedSessionIds = new Set<string>();
      for (const set of playedByUser.values()) {
        for (const sid of set) playedSessionIds.add(sid);
      }
      const releaseSessionIds = new Set(releases.map((r) => r.sessionId));
      const displaySessions = sessionDocs.filter((s) => {
        const sid = s._id.toString();
        return (
          (claimsBySession.get(sid)?.size ?? 0) > 0 ||
          playedSessionIds.has(sid) ||
          releaseSessionIds.has(sid)
        );
      });

      // 9. Resolve user info (names + thumbnails) in one batch.
      const robloxUsers = await readminCollections.roblox_user
        .find({ id: { $in: Array.from(rowUserIds).map(Number).filter(Number.isFinite) } })
        .toArray();
      const userInfo: Record<string, { name: string; thumbnail: string }> = {};
      for (const ru of robloxUsers) {
        userInfo[ru.id.toString()] = {
          name: ru.name,
          thumbnail: ru.headshotUrl,
        };
      }

      // 10. Derive cells. Empty cells are simply omitted from the sparse map.
      const deriveStatus = (
        userId: string,
        session: WithId<Session>,
      ): AttendanceStatus | null => {
        const sid = session._id.toString();
        const claim = claimsBySession.get(sid)?.get(userId);
        const played = playedByUser.get(userId)?.has(sid) ?? false;
        const released = releasedSet.has(`${userId}:${sid}`);

        if (!claim && !played && !released) return null;

        if (
          claim &&
          claim.roleId &&
          hostRoleSet.has(claim.roleId) &&
          (claim.state === 'completed' || claim.state === 'passed')
        ) {
          return 'H';
        }
        if (released && !claim) return 'R';

        const sessionStart = new Date(session.date).getTime();
        const onLeave = (leaveByUser.get(userId) ?? []).some(
          (w) => w.start <= sessionStart && sessionStart <= w.end,
        );
        if (onLeave && claim) return 'Leave';
        if (cancelledSet.has(sid) && claim) return 'C';
        if (claim && played) return 'A';
        if (claim && !played) return 'N';
        if (!claim && played) return 'U';
        return null;
      };

      const departments = allDepartments
        .filter((d) => membersByDept.has(d._id.toString()))
        .map((d) => {
          const userIds = Array.from(membersByDept.get(d._id.toString()) ?? []);
          userIds.sort((a, b) =>
            (userInfo[a]?.name ?? a).localeCompare(userInfo[b]?.name ?? b),
          );
          const users = userIds.map((userId) => {
            const cells: Record<string, AttendanceStatus> = {};
            for (const session of displaySessions) {
              const status = deriveStatus(userId, session);
              if (status) cells[session._id.toString()] = status;
            }
            return { userId, cells };
          });
          return { id: d._id.toString(), name: d.name, users };
        });

      return {
        distribution: {
          num: distribution.num,
          from,
          to,
          isCurrent: distribution.isCurrent,
        },
        sessions: displaySessions.map((s) => ({
          id: s._id.toString(),
          name: s.template?.name ?? 'Session',
          date: s.date,
          endsAt: s.endsAt,
          cancelled: cancelledSet.has(s._id.toString()),
        })),
        departments,
        userInfo,
      };
    }),
});
