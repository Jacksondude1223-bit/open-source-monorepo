import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import StringToObjectID from '~/utils/StringToObjectID';
import { z } from 'zod';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { getGroupInfo, getProcessedUserObject, getUserInfo } from '~/services/roblox.service';
import { dmUserDiscord } from '~/services/discord.service';
import { rankUser } from '~/services/group-actions.service';
import { readminCollections } from '~/services/mongo.service';
import { PunishmentType } from '~/services/NewMongoTypes/WriteUps.type';
import { createHistory } from '~/services/workspaceServices/staffHistory';
import { presignArrayOfPaths } from '~/services/CDN-service';

// Applies hidden-writeup visibility: drops 'hidden' entries and blanks the reason +
// evidence of 'reasonHidden' entries for viewers who lack writeUps.viewHidden. The
// author, approver, and admins/viewHidden holders always see full content.
function maskHiddenWriteups<
  T extends {
    visibility?: string;
    reason?: string;
    evidence?: string[];
    disciplinarianId?: number;
    approvedBy?: string;
  },
>(
  rows: T[],
  viewerRobloxId: string | number | null | undefined,
  canSeeHidden: boolean,
): (T & { reasonHidden?: boolean })[] {
  const me = viewerRobloxId?.toString();
  const out: (T & { reasonHidden?: boolean })[] = [];
  for (const r of rows) {
    const isOwnerOrApprover =
      r.disciplinarianId?.toString() === me || (r.approvedBy != null && r.approvedBy.toString() === me);
    if (canSeeHidden || isOwnerOrApprover || !r.visibility || r.visibility === 'public') {
      out.push(r);
    } else if (r.visibility === 'hidden') {
      // Remove the entry entirely.
      continue;
    } else {
      // 'reasonHidden' — keep the entry but mask its reason and evidence.
      out.push({ ...r, reason: '', evidence: [], reasonHidden: true });
    }
  }
  return out;
}

export const workspaceHistoryRouter = router({
  createHistory: workspaceProcedure.input(z.object({
    groupId: z.string(),
    userId: z.string(),
    reason: z.string(),
    type: z.union([z.literal('promotion'), z.literal('writeup'), z.literal('suspension'), z.literal('termination'), z.literal('demotion')]),
    notify: z.boolean(),
    role: z.string().or(z.literal(false)).optional(),
    expires: z.date().optional(),
    files: z.array(z.tuple([z.string(), z.string()])),
    visibility: z.enum(['public', 'reasonHidden', 'hidden']).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { department, workspace, user } = ctx;
    const { groupId, userId, reason, type, notify, role, expires, files, visibility } = input;

    if (type == 'promotion' && !(department.permissions.writeUps.promote || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create promotions.');
    }
    if (type == 'termination' && !(department.permissions.writeUps.terminations || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create terminations.');
    }
    if (type == 'suspension' && !(department.permissions.writeUps.suspensions || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create suspensions.');
    }
    if (type == 'writeup' && !(department.permissions.writeUps.writeUps || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create write ups.');
    }
    if (type == 'demotion' && !(department.permissions.writeUps.demote || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create write ups.');
    }

    if (role !== false && (type == 'suspension' || type == 'termination') && (department.permissions.writeUps.promote || department.permissions.admin) !== true) {
      throw ReturnNormalFailure(
        'BAD_REQUEST',
        'You are not allowed to demote users.',
      );
    }
    if (role !== false && (type == 'promotion') && (department.permissions.writeUps.promote || department.permissions.admin) !== true) {
      throw ReturnNormalFailure(
        'BAD_REQUEST',
        'You are not allowed to promote users.',
      );
    }

    await createHistory({
      groupId,
      actioningUser: user.dbUser.robloxId,
      userId,
      reason,
      type,
      notify,
      role,
      expires,
      approval_required: (department.permissions.writeUps.approval_required == true && department.permissions.writeUps.approver !== true),
      files,
      visibility,
    })

    return true;
  }),
  createBulkHistory: workspaceProcedure.input(z.object({
    groupId: z.string(),
    userIds: z.array(z.string()).min(1).max(200),
    reason: z.string().min(1),
    type: z.union([z.literal('promotion'), z.literal('writeup'), z.literal('suspension'), z.literal('termination'), z.literal('demotion')]),
    notify: z.boolean(),
    expires: z.date().optional(),
    visibility: z.enum(['public', 'reasonHidden', 'hidden']).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { department, user } = ctx;
    const { groupId, userIds, reason, type, notify, expires, visibility } = input;

    if (type == 'promotion' && !(department.permissions.writeUps.promote || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create promotions.');
    }
    if (type == 'termination' && !(department.permissions.writeUps.terminations || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create terminations.');
    }
    if (type == 'suspension' && !(department.permissions.writeUps.suspensions || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create suspensions.');
    }
    if (type == 'writeup' && !(department.permissions.writeUps.writeUps || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create write ups.');
    }
    if (type == 'demotion' && !(department.permissions.writeUps.demote || department.permissions.admin)) {
      throw ReturnNormalFailure('UNAUTHORIZED', 'User is not permitted to create demotions.');
    }

    const approval_required = (department.permissions.writeUps.approval_required == true && department.permissions.writeUps.approver !== true);

    const results = await Promise.allSettled(
      userIds.map((userId) =>
        createHistory({
          groupId,
          actioningUser: user.dbUser.robloxId,
          userId,
          reason,
          type,
          notify,
          role: false,
          expires,
          approval_required,
          files: [],
          visibility,
        }),
      ),
    );

    const created = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - created;

    return { created, failed };
  }),
  getHistory: workspaceProcedure.input(z.object({
    groupId: z.string(),
    userId: z.string().optional(),
  })).query(async ({ ctx, input }) => {
    const { department, workspace, user } = ctx;

    const allowedTypes: PunishmentType[] = [];
    if (department?.permissions?.writeUps?.promote || department?.permissions?.admin == true) allowedTypes.push('promotion');
    if (department?.permissions?.writeUps?.writeUps || department?.permissions?.admin == true) allowedTypes.push('writeup');
    if (department?.permissions?.writeUps?.suspensions || department?.permissions?.admin == true) allowedTypes.push('suspension');
    if (department?.permissions?.writeUps?.terminations || department?.permissions?.admin == true) allowedTypes.push('termination');
    if (department?.permissions?.writeUps?.demote || department?.permissions?.admin == true) allowedTypes.push('demotion');

    const found = await readminCollections.write_ups.find({
      groupId: workspace.groupId,
      ...(input.userId ? { userId: parseInt(input.userId) } : {}),
      type: { $in: allowedTypes },
    }, {
      sort: { created: -1 }
    }).toArray();

    const canSeeHidden = department.permissions.admin || department.permissions.writeUps?.viewHidden || false;
    const punishments = maskHiddenWriteups(found, user.dbUser.robloxId, canSeeHidden);

    const cache = new Map<string, any>();

    return await Promise.all(punishments.map(async (punishment) => {
      const punisherInfo = cache.get(punishment.disciplinarianId.toString()) || await getProcessedUserObject(punishment.disciplinarianId);
      const userInfo = cache.get(punishment.userId.toString()) || await getProcessedUserObject(punishment.userId);
      cache.set(punishment.disciplinarianId.toString(), punisherInfo);
      cache.set(punishment.userId.toString(), userInfo);
      return {
        ...punishment,
        punisherInfo,
        userInfo,
        evidence: await presignArrayOfPaths(punishment.evidence, 160),
      };
    }));
  }),
  getHistoryForUserId: workspaceProcedure.input(z.object({
    groupId: z.string(),
    userId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { department, workspace, user } = ctx;
    const { groupId, userId } = input;

    if (!userId) {
      return []; // used for create punishment modal
    }

    const found = await readminCollections.write_ups.find({
      groupId: workspace.groupId,
      userId: parseInt(userId),
    }).toArray();

    const canSeeHidden = department.permissions.admin || department.permissions.writeUps?.viewHidden || false;
    const punishments = maskHiddenWriteups(found, user.dbUser.robloxId, canSeeHidden);

    const cache = new Map<string, any>();

    return await Promise.all(punishments.map(async (punishment) => {
      const punisherInfo = cache.get(punishment.disciplinarianId.toString()) || await getProcessedUserObject(punishment.disciplinarianId);
      const userInfo = cache.get(punishment.userId.toString()) || await getProcessedUserObject(punishment.userId);
      cache.set(punishment.disciplinarianId.toString(), punisherInfo);
      cache.set(punishment.userId.toString(), userInfo);
      return {
        ...punishment,
        punisherInfo,
        userInfo,
      };
    }));
  }),
  deleteHistory: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        punishmentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, punishmentId } = input;
      if (!department.permissions.writeUps.delete) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'User is not permitted to delete write ups.',
        );
      }

      const found = await readminCollections.write_ups.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(punishmentId),

      });
      if (found) {
        await readminCollections.write_ups.deleteOne({ _id: found._id })
      }
      return true;
    }),
  approvePunishment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        punishmentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { groupId, punishmentId } = input;
      if (!department.permissions.writeUps.approver) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'User is not permitted to approve write ups.',
        );
      }

      const found = await readminCollections.write_ups.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(punishmentId),
      });
      if (!found) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Invalid punishment ID.');
      }

      await readminCollections.write_ups.updateOne({
        _id: found._id,
      }, {
        $set: {
          pendingApproval: false,
          approvedBy: user.dbUser.robloxId as string,
        }
      });

      const groupInfo = await getGroupInfo(groupId);
      const userId = found.userId;
      const reason = found.reason;
      const userInfo = await getUserInfo(found.disciplinarianId);

      const notify = found.notify;
      const rankTo = found.rankTo;
      const role = found.rankFrom;
      const expiry = found.expires;

      if (found.type == 'writeup') {
        if (notify) {
          await dmUserDiscord(
            userId,
            `You were warned by ${userInfo?.name || userId} at ${groupInfo ? groupInfo.displayName : groupId}`,
            reason,
            'red',
            undefined,
            { workspace, category: 'moderation', variables: { groupName: groupInfo ? groupInfo.displayName : groupId, moderatorName: userInfo?.name || userId, action: 'warned', reason } }
          );
        }
      }

      if (found.type == 'suspension') {
        if (notify) {
          const groupInfo = await getGroupInfo(groupId);
          await dmUserDiscord(
            userId,
            `You were suspended by ${userInfo?.name || userId || 'unknown'
            //@ts-expect-error this is ok
            } in ${groupInfo?.name || groupId} until ${new Date(expiry).toLocaleDateString() || expiry
            }`,
            reason,
            'red',
            undefined,
            { workspace, category: 'moderation', variables: { groupName: groupInfo?.displayName || groupId, moderatorName: userInfo?.name || userId || 'unknown', action: 'suspended', reason, expiry: expiry ? new Date(expiry).toLocaleDateString() : String(expiry) } }
          )
        }

        //@ts-expect-error this is ok
        if (role !== false) {
          const resp = await rankUser('group', workspace.groupId, workspace.groupId, userId, rankTo?.toString() as string, 'user', { sourceUserId: (found.disciplinarianId || '').toString(), approverUserId: (user.dbUser.robloxId || '').toString(), suspension: 'suspend' });
          if (resp !== true) {
            throw ReturnNormalFailure('BAD_REQUEST', `Failed to demote user, however, termination was successfully created. ${resp}`)
          }
        }
      }

      if (found.type == 'termination') {
        if (notify) {
          const groupInfo = await getGroupInfo(groupId);
          await dmUserDiscord(
            userId,
            `You were terminated by ${userInfo?.name || userId || 'unknown'} in ${groupInfo?.displayName || groupId
            }`,
            reason,
            'red',
            undefined,
            { workspace, category: 'moderation', variables: { groupName: groupInfo?.displayName || groupId, moderatorName: userInfo?.name || userId || 'unknown', action: 'terminated', reason } },
          );
        }

        //@ts-expect-error this is ok
        if (role !== false) {
          const resp = await rankUser('group', workspace.groupId, workspace.groupId, userId, rankTo?.toString() as string, 'user', { sourceUserId: (found.disciplinarianId || '').toString(), approverUserId: (user.dbUser.robloxId || '').toString(), suspension: 'terminate' });
          if (resp !== true) {
            throw ReturnNormalFailure('BAD_REQUEST', `Failed to demote user, however, termination was successfully created. ${resp}`)
          }
        }
      }

      if (found.type == 'promotion') {
        if (notify) {
          await dmUserDiscord(
            userId,
            `You were promoted by ${userInfo?.name || userId} at ${groupInfo ? groupInfo.displayName : groupId}`,
            reason,
            'green',
            undefined,
            { workspace, category: 'moderation', variables: { groupName: groupInfo ? groupInfo.displayName : groupId, moderatorName: userInfo?.name || userId, action: 'promoted', reason } }
          );
        }

        //@ts-expect-error this is ok
        if (role !== false) {
          const resp = await rankUser('group', workspace.groupId, workspace.groupId, userId, rankTo?.toString() as string, 'user', { sourceUserId: (found.disciplinarianId || '').toString(), approverUserId: (user.dbUser.robloxId || '').toString(), promotion: 'promote' });
          if (resp !== true) {
            throw ReturnNormalFailure('BAD_REQUEST', `Failed to rank user, however, promotion was successfully approved. ${resp}`)
          }
        }
      }

      if (found.type == 'demotion') {
        if (notify) {
          await dmUserDiscord(
            userId,
            `You were demoted by ${userInfo?.name || userId} at ${groupInfo ? groupInfo.displayName : groupId}`,
            reason,
            'red',
            undefined,
            { workspace, category: 'moderation', variables: { groupName: groupInfo ? groupInfo.displayName : groupId, moderatorName: userInfo?.name || userId, action: 'demoted', reason } }
          );
        }

        //@ts-expect-error this is ok
        if (role !== false) {
          const resp = await rankUser('group', workspace.groupId, workspace.groupId, userId, rankTo?.toString() as string, 'user', { sourceUserId: (found.disciplinarianId || '').toString(), approverUserId: (user.dbUser.robloxId || '').toString(), demotion: 'demote' });
          if (resp !== true) {
            throw ReturnNormalFailure('BAD_REQUEST', `Failed to rank user, however, demotion was successfully approved. ${resp}`)
          }
        }
      }

      return true;
    }),
})