import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import {
  getGroupInfo,
  getProcessedUserObject,
  getUserInfo,
  getUserThumbnail,
  processObjectsWithUserIdToUserData,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';
import { addRoleDiscordUser, BloxlinkSearch, dmUserDiscord, removeRoleDiscordUser } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { returnDiscordMessageFormatForDate, sendWebhookMessage } from '~/services/discord.service';
import { DepartmentUser, GroupMember } from '~/services/NewMongoTypes';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';

// ── Time-off / inactivity list helpers ──────────────────────────────────────
// Workspaces are expected to scale to thousands of requests, so the list is
// server-paginated and the timeline pulls a single month window. These helpers
// keep the status mapping + visibility scoping consistent across both queries.

type TimeOffStatus = 'all' | 'pending' | 'approved' | 'declined';
type TimeOffCounts = { all: number; pending: number; approved: number; declined: number };
type TimeOffUserContext = {
  total: number;
  pending: number;
  approvedDaysLast90: number;
  activeNow: boolean;
  lastEnded: Date | null;
};

// Maps a UI status onto the `request` shape (false = pending, object.approved = decision).
function timeOffStatusFilter(status: TimeOffStatus): Record<string, unknown> {
  switch (status) {
    case 'pending':
      return { request: false };
    case 'approved':
      return { 'request.approved': true };
    case 'declined':
      return { 'request.approved': false };
    default:
      return {};
  }
}

// Resolve a username search to the set of member userIds in this workspace.
// Returns null when no search term is supplied (i.e. "no user filter").
async function resolveTimeOffUserIds(groupId: string, username: string): Promise<string[] | null> {
  if (!username) return null;
  const matchingRobloxUsers = await readminCollections.roblox_user
    .find(
      {
        $or: [
          { name: { $regex: username, $options: 'i' } },
          { displayName: { $regex: username, $options: 'i' } },
        ],
      },
      { projection: { id: 1 } },
    )
    .limit(100)
    .toArray();
  if (matchingRobloxUsers.length === 0) return [];
  const matchingIds = matchingRobloxUsers.map((u) => u.id);
  const members = await readminCollections.group_member
    .find({ groupId, userId: { $in: matchingIds } }, { projection: { userId: 1 } })
    .toArray();
  return members.map((m) => m.userId.toString());
}

// Strips the free-text reason from time-off entries that don't belong to the
// viewer when they lack permission to read others' reasons. The entry itself stays
// visible (dates/status) — only the reason is masked, flagged with `reasonHidden`
// so the UI can render a placeholder.
function maskTimeOffReasons<T extends { userId: unknown; reason?: string }>(
  rows: T[],
  viewerRobloxId: string | number | null | undefined,
  canSeeReasons: boolean,
): (T & { reasonHidden?: boolean })[] {
  if (canSeeReasons) return rows;
  const me = viewerRobloxId?.toString();
  return rows.map((r) =>
    r.userId?.toString() === me ? r : { ...r, reason: '', reasonHidden: true },
  );
}

// Builds the visibility-scoped base filter (groupId + who-can-see-what + username),
// excluding any status filter or date window.
function buildTimeOffBaseFilter(params: {
  groupId: string;
  canSeeAll: boolean;
  robloxId?: string | number | null;
  userIds: string[] | null;
}): Record<string, any> {
  const filter: Record<string, any> = { groupId: params.groupId };
  if (params.canSeeAll) {
    if (params.userIds !== null) filter.userId = { $in: params.userIds };
  } else {
    filter.userId = params.robloxId;
    // Non-managers only ever see their own currently-active or upcoming time off.
    filter.$or = [{ active: true }, { ends: { $gt: new Date() } }];
  }
  return filter;
}

// Single aggregation that returns per-status counts for the chips, respecting the
// base (visibility + username) filter but ignoring the selected status.
async function computeTimeOffCounts(baseFilter: Record<string, any>): Promise<TimeOffCounts> {
  const agg = await readminCollections.inactivity
    .aggregate<{ all: number; pending: number; approved: number; declined: number }>([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          all: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$request', false] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$request.approved', true] }, 1, 0] } },
          declined: { $sum: { $cond: [{ $eq: ['$request.approved', false] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const row = agg[0];
  return {
    all: row?.all ?? 0,
    pending: row?.pending ?? 0,
    approved: row?.approved ?? 0,
    declined: row?.declined ?? 0,
  };
}

// Per-user approval context (recent days off, request count, currently out) for the
// pending requesters on the current page. Bounded to the page's distinct users.
async function computeTimeOffContext(
  groupId: string,
  userIds: string[],
): Promise<Record<string, TimeOffUserContext>> {
  if (userIds.length === 0) return {};
  const docs = await readminCollections.inactivity
    .find(
      { groupId, userId: { $in: userIds } },
      { projection: { userId: 1, request: 1, starts: 1, ends: 1 } },
    )
    .toArray();
  const now = Date.now();
  const windowStart = now - 90 * 86400000;
  const map = new Map<string, TimeOffUserContext>();
  for (const d of docs) {
    const uid = d.userId.toString();
    const c =
      map.get(uid) || { total: 0, pending: 0, approvedDaysLast90: 0, activeNow: false, lastEnded: null };
    c.total++;
    if (d.request === false) {
      c.pending++;
    } else if (d.request && d.request.approved === true) {
      const s = new Date(d.starts).getTime();
      const e = new Date(d.ends).getTime();
      const cs = Math.max(s, windowStart);
      const ce = Math.min(e, now);
      if (ce > cs) c.approvedDaysLast90 += Math.max(1, Math.round((ce - cs) / 86400000));
      if (s <= now && now <= e) c.activeNow = true;
      if (e <= now && (!c.lastEnded || e > c.lastEnded.getTime())) c.lastEnded = new Date(e);
    }
    map.set(uid, c);
  }
  return Object.fromEntries(map);
}

export const workspaceActivityInactivityRouter = router({
  getTimeOffDuringDistribution: workspaceProcedure.input(z.object({
    groupId: z.string(),
    distributionId: z.number(),
  })).query(async ({ ctx, input }) => {
    const { department, workspace } = ctx;
    const { distributionId } = input;
    if (!department.permissions.activity.view) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You are not authorized to view this activity',
      });
    }

    const distribution = await readminCollections.distribution.findOne({ groupId: workspace.groupId, num: distributionId });
    if (!distribution) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Could not find distribution',
      });
    }
    const from = distribution.from;
    const to = distribution.isCurrent ? new Date() : distribution.to;

    const inactivity = await readminCollections.inactivity.find({
      groupId: workspace.groupId,
      starts: { $lte: to },
      ends: { $gte: from },
    }).toArray();

  }),
  getTimeOff: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        username: z.string().optional().default(''),
        status: z.enum(['all', 'pending', 'approved', 'declined']).optional().default('all'),
        page: z.number().int().min(0).optional().default(0),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const canSeeAll =
        department.permissions.activity.view || department.permissions.activity.manageInactivity;

      const userIds = canSeeAll ? await resolveTimeOffUserIds(workspace.groupId, input.username) : null;
      const baseFilter = buildTimeOffBaseFilter({
        groupId: workspace.groupId,
        canSeeAll,
        robloxId: user.dbUser.robloxId,
        userIds,
      });

      // Counts power the filter chips; total for the selected status drives pagination.
      const counts = await computeTimeOffCounts(baseFilter);
      const total = input.status === 'all' ? counts.all : counts[input.status];

      const requests = await readminCollections.inactivity
        .find(
          { ...baseFilter, ...timeOffStatusFilter(input.status) },
          { sort: { created: -1 }, skip: input.page * input.limit, limit: input.limit },
        )
        .toArray();

      // Per-user context (requests made, recent days off) for every requester on the page.
      const contexts = await computeTimeOffContext(
        workspace.groupId,
        [...new Set(requests.map((r) => r.userId.toString()))],
      );

      const canSeeReasons =
        department.permissions.admin ||
        department.permissions.activity.manageInactivity ||
        department.permissions.activity.viewTimeOffReasons ||
        false;

      return {
        requests: maskTimeOffReasons(requests, user.dbUser.robloxId, canSeeReasons),
        total,
        page: input.page,
        limit: input.limit,
        counts,
        contexts,
      };
    }),
  getTimeOffTimeline: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        username: z.string().optional().default(''),
        year: z.number().int(),
        month: z.number().int().min(0).max(11),
        status: z.enum(['all', 'pending', 'approved', 'declined']).optional().default('all'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const canSeeAll =
        department.permissions.activity.view || department.permissions.activity.manageInactivity;

      const userIds = canSeeAll ? await resolveTimeOffUserIds(workspace.groupId, input.username) : null;
      const baseFilter = buildTimeOffBaseFilter({
        groupId: workspace.groupId,
        canSeeAll,
        robloxId: user.dbUser.robloxId,
        userIds,
      });

      // Counts span the whole dataset (not just the month) so the chips stay stable
      // as the manager pages between months.
      const counts = await computeTimeOffCounts(baseFilter);

      const monthStart = new Date(input.year, input.month, 1);
      const monthEnd = new Date(input.year, input.month + 1, 1);
      // Overlap: any request that starts before the month ends and ends on/after it begins.
      const requests = await readminCollections.inactivity
        .find(
          {
            ...baseFilter,
            ...timeOffStatusFilter(input.status),
            starts: { $lt: monthEnd },
            ends: { $gte: monthStart },
          },
          { sort: { starts: 1 }, limit: 5000 },
        )
        .toArray();

      const canSeeReasons =
        department.permissions.admin ||
        department.permissions.activity.manageInactivity ||
        department.permissions.activity.viewTimeOffReasons ||
        false;

      return {
        requests: maskTimeOffReasons(requests, user.dbUser.robloxId, canSeeReasons),
        counts,
      };
    }),
  getUserTimeOff: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { userId } = input;
      const canSeeAll = department.permissions.activity.view || department.permissions.activity.manageInactivity;
      const isOwnRecord = userId === user.dbUser.robloxId?.toString();

      if (!canSeeAll && !isOwnRecord) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to view this user\'s time off',
        });
      }

      const inactivityFound = await readminCollections.inactivity.find({
        groupId: workspace.groupId,
        userId: userId.toString(),
      }, {
        sort: {
          created: -1,
        },
      }).toArray();

      for (const inactivity of inactivityFound) {
        if (inactivity.request) {
          if (inactivity.request.adminUser) {
            //@ts-expect-error Not meant to be defined, only done for the request
            inactivity.request.user = await getProcessedUserObject(
              inactivity.request.adminUser,
            );
          }
        }
      }
      const processed = await processObjectsWithUserIdToUserData(
        inactivityFound,
      );
      const canSeeReasons =
        department.permissions.admin ||
        department.permissions.activity.manageInactivity ||
        department.permissions.activity.viewTimeOffReasons ||
        false;
      return maskTimeOffReasons(processed, user.dbUser.robloxId, canSeeReasons);
    }),
  getEveryonesInactivity: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { } = input;
      if (!department.permissions.activity.view) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to view this activity',
        });
      }
      const inactivityFound = await readminCollections.inactivity.find({
        groupId: workspace.groupId,
        $or: [
          {
            active: true,
          },
          {
            ends: { $gt: new Date() },
          },
        ],
      }).toArray();
      for (const inactivity of inactivityFound) {
        if (inactivity.request) {
          if (inactivity.request.adminUser) {
            //@ts-expect-error Not meant to be defined, only done for the request
            inactivity.request.user = await getProcessedUserObject(
              inactivity.request.adminUser,
            );
          }
        }
      }
      const processed = await processObjectsWithUserIdToUserData(
        inactivityFound,
      );
      const canSeeReasons =
        department.permissions.admin ||
        department.permissions.activity.manageInactivity ||
        department.permissions.activity.viewTimeOffReasons ||
        false;
      return maskTimeOffReasons(processed, user.dbUser.robloxId, canSeeReasons);
    }),

  getMyInactivity: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      if (!user) return;
      const { } = input;
      if (!user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must have a verified Roblox account',
        });
      }
      const foundInactivity = await readminCollections.inactivity.find({
        groupId: workspace.groupId,
        userId: user.dbUser.robloxId,
        $or: [
          {
            active: true,
          },
          {
            ends: { $gt: new Date() }
          }
        ]
      }).toArray();
      for (const inactivity of foundInactivity) {
        //@ts-expect-error Not meant to be defined, only done for the request
        inactivity.user = await getProcessedUserObject(inactivity.userId);
        if (inactivity.request) {
          if (inactivity.request.adminUser) {
            //@ts-expect-error Not meant to be defined, only done for the request
            inactivity.request.user = await getProcessedUserObject(
              inactivity.request.adminUser,
            );
          }
        }
      }
      const processed = await processObjectsWithUserIdToUserData(
        foundInactivity,
      );
      return processed;
    }),
  requestInactivity: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        reason: z.string(),
        start: z.date(),
        end: z.date(),
        userId: z.any().optional()
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { reason, start, end, userId } = input;

      if (await isUserGDPRIgnored(userId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User is GDPR ignored',
        });
      }
      const autoApproveRequests = department.permissions.activity.approveInactivity;
      const requestInactivityForOtherUsers =
        department.permissions.activity.requestInactivityForOtherUsers;

      if (!reason || !start || !end || !user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid request',
        });
      }

      // if the user id is not false and the user does not have access to request inactivity for other
      if (userId !== 'false' && !requestInactivityForOtherUsers) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to request time off for other users',
        });

      }

      if (!department.permissions.activity.createInactivity) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not permitted to create time off',
        });
      }

      const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));
      const startDate = start;
      const endDate = end;
      // if (startDate < yesterday || endDate < startDate) {
      //   throw new TRPCError({
      //     code: 'BAD_REQUEST',
      //     message: 'Inactivity must be in the future',
      //   });
      // }
      const robloxId = userId == 'false' ? user.dbUser.robloxId : userId;
      let foundUser: GroupMember | DepartmentUser | null = await readminCollections.group_member.findOne({
        groupId: workspace.groupId,
        userId: parseInt(robloxId)
      })
      if (!foundUser) {
        const member = await readminCollections.department_users.findOne({ groupId: workspace.groupId, userId: parseInt(robloxId).toString() });
        if (!member) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Could not find user in the workspace (not in workspace department or in Roblox synced group roles)',
          });
        }
        foundUser = member;
      }

      await readminCollections.inactivity.insertOne({
        groupId: workspace.groupId,
        userId: foundUser.userId.toString(),
        request: autoApproveRequests == true
          ? {
            approved: true,
            adminUser: '2611329969',
          }
          : false,
        active: false,
        createdBy: user.dbUser.robloxId,
        starts: startDate,
        ends: endDate,
        reason,
        created: new Date(),
      });

      const groupInfo = await getGroupInfo(workspace.groupId);
      await dmUserDiscord(
        foundUser.userId,
        `An inactivity request was created for you at ${groupInfo ? groupInfo.displayName : workspace.groupId}`,
        `Provided reason: ${reason}.\nIt ${autoApproveRequests ? 'was approved' : 'is pending approval.'}`, undefined, undefined, { workspace, category: 'inactivity', variables: { groupName: groupInfo ? groupInfo.displayName : workspace.groupId, reason, status: autoApproveRequests ? 'approved' : 'pending approval' } })


      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'inactivity-request-created'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(foundUser.userId?.toString() || '1');
        const createdBy = await getUserInfo(user.dbUser.robloxId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(foundUser.userId?.toString() || '1');
        const desc = `From ${returnDiscordMessageFormatForDate(startDate, 'short_date')} to ${returnDiscordMessageFormatForDate(endDate, 'short_date')}\nProvided reason: ${reason}.\nCreated by: ${createdBy?.name || user.dbUser.robloxId}\nIt ${autoApproveRequests ? 'was automatically approved due to user permissions' : 'is pending approval.'}`;
        await sendWebhookMessage(url, 'blue', `Inactivity Request Created for ${userInfo?.name}`, desc, userThumbnail)
      }

      return { success: true };
    }),
  updateInactivityRequestStatus: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        id: z.string(),
        status: z.enum(['accept', 'decline']),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      if (!user) return;
      const { id, status, reason } = input;
      if (!department.permissions.activity.manageInactivity) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to approve/decline this activity',
        });
      }

      const foundInactivityRequest = await readminCollections.inactivity.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(id),
      })
      if (!foundInactivityRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Could not find inactivity',
        });
      }
      const approved = status == 'accept';

      await readminCollections.inactivity.updateOne({
        _id: foundInactivityRequest._id
      }, {
        $set: {
          request: {
            approved,
            adminUser: user.dbUser.robloxId,
            reason,
          }
        }
      })

      const groupInfo = await getGroupInfo(workspace.groupId);
      await dmUserDiscord(
        foundInactivityRequest.userId,
        `Your inactivity request at ${groupInfo ? groupInfo.displayName : workspace.groupId
        } was ${approved ? 'approved' : 'declined'}`,
        approved
          ? `It takes affect ${new Date(
            foundInactivityRequest.starts,
          ).toLocaleString()}`
          : `It was declined for ${reason}`,
        approved ? 'green' : 'red',
        undefined,
        { workspace, category: 'inactivity', variables: { groupName: groupInfo ? groupInfo.displayName : workspace.groupId, status: approved ? 'approved' : 'declined', reason } }
      );

      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'inactivity-request-approved-or-declined'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const inactiveUser = await getUserInfo(foundInactivityRequest.userId?.toString() || '1');
        const createdBy = await getUserInfo(foundInactivityRequest.createdBy?.toString() || '1');
        const approvingUser = await getUserInfo(user.dbUser.robloxId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(foundInactivityRequest.userId?.toString() || '1');
        const desc = `From ${returnDiscordMessageFormatForDate(foundInactivityRequest.starts, 'short_date')} to ${returnDiscordMessageFormatForDate(foundInactivityRequest.ends, 'short_date')}\nInactivity Reason: ${foundInactivityRequest.reason}.\nCreated by: ${createdBy?.name || user.dbUser.robloxId}\nIt was ${approved ? 'approved' : 'declined'} by ${approvingUser?.name} ${approved ? '' : `with reason: ${reason}`}`;
        await sendWebhookMessage(url, 'blue', `Inactivity Request ${approved ? 'Approved' : 'Declined'} for ${inactiveUser?.name}`, desc, userThumbnail)
      }

      return { success: true };
    }),
  deleteInactivityRequest: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { id } = input;
      const foundInactivityRequest = await readminCollections.inactivity.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(id),
      })
      if (!foundInactivityRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Could not find inactivity',
        });
      }

      if (
        foundInactivityRequest.userId !== user.dbUser.robloxId &&
        !department.permissions.activity.manageInactivity
      ) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not permitted to delete this inactivity request',
        });
      }

      if (foundInactivityRequest.active) {

        dmUserDiscord(
          foundInactivityRequest.userId.toString(),
          `You are no longer inactive at ${workspace?.groupName}`,
          "Your inactivity was deleted, you are now marked as active again.",
          undefined,
          undefined,
          { workspace, category: 'inactivity', variables: { groupName: workspace?.groupName } }
        );
        // add inactivty role
        if (workspace.inactivityRole && workspace.inactivityRole !== 'disabled') {
          const integration = await readminCollections.discord_bots.findOne({ groupId: workspace.groupId });
          if (integration) {
            const foundDBUser = await readminCollections.user.findOne({ robloxId: foundInactivityRequest.userId.toString() });
            const DiscordID = foundDBUser?.discordId ? [foundDBUser?.discordId] : [];
            if (DiscordID && DiscordID.length !== 0) {
              for (const discordId of DiscordID) {
                await removeRoleDiscordUser(integration.guildId, discordId, workspace.inactivityRole);
              }
            }
          }
        }
      }
      await readminCollections.inactivity.deleteOne({
        _id: foundInactivityRequest._id
      })


      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'inactivity-deleted'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(foundInactivityRequest.userId?.toString() || '1');
        const createdBy = await getUserInfo(user.dbUser.robloxId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(foundInactivityRequest.userId?.toString() || '1');
        const desc = `From ${returnDiscordMessageFormatForDate(foundInactivityRequest.starts, 'short_date')} to ${returnDiscordMessageFormatForDate(foundInactivityRequest.ends, 'short_date')}\nInactivity Reason: ${foundInactivityRequest.reason}.\nCreated by: ${createdBy?.name || user.dbUser.robloxId}\nIt was deleted by ${createdBy?.name}`;
        await sendWebhookMessage(url, 'blue', `Inactivity Request Deleted for ${userInfo?.name}`, desc, userThumbnail)
      }


      return { success: true };
    }),
});
