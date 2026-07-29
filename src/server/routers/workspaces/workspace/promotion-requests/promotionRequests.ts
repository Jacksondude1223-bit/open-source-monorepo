import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { readminCollections } from '~/services/mongo.service';
import { ObjectId } from 'mongodb';
import { v4 } from 'uuid';
import { uploadImage, presignArrayOfPaths } from '~/services/CDN-service';
import { rankUser, canWorkspaceOrUserRank } from '~/services/group-actions.service';
import { sendWebhookMessage } from '~/services/discord.service';
import { getUserInfo, getUserThumbnail, batchGetRobloxUsers } from '~/services/roblox.service';
import { createHistory } from '~/services/workspaceServices/staffHistory';
import { emitFlowEvent } from '~/services/flows/flowEngine.service';

async function uploadAttachments(files: [string, string][], groupId: string, userId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const [fileName, fileData] of files) {
    const id = v4();
    const filePath = `workspaces/${groupId}/promotion-requests/${userId}/${id}-${fileName}`;
    paths.push(filePath);
    await uploadImage(filePath, fileName, fileData);
  }
  return paths;
}

async function logPromotionRequestWebhook(
  groupId: string,
  event: 'promotion-request-created' | 'promotion-request-closed',
  title: string,
  description: string,
  targetUserId: string,
) {
  const mechanisms = await readminCollections.discord_logging
    .find({ groupId, event: { $in: ['all', event] } })
    .toArray();
  if (mechanisms.length === 0) return;
  const thumbnail = await getUserThumbnail(targetUserId);
  for (const mechanism of mechanisms) {
    await sendWebhookMessage(mechanism.webhookUrl, 'blue', title, description, thumbnail).catch(() => {});
  }
}

export const workspacePromotionRequestsRouter = router({
  getAll: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.view && !perms?.manage) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view promotion requests.',
        });
      }

      const filter: any = { groupId: ctx.workspace.groupId };

      // If user can't view closed requests and isn't a manager/admin, only show pending
      if (!isAdmin && !perms?.viewClosed && !perms?.manage) {
        filter.status = 'pending';
      }

      const requests = await readminCollections.promotion_request
        .find(filter)
        .sort({ created: -1 })
        .toArray();

      // Presign attachment URLs
      const processed = await Promise.all(
        requests.map(async (r) => ({
          ...r,
          attachments: await presignArrayOfPaths(r.attachments || [], 60),
          votes: await Promise.all(
            r.votes.map(async (v) => ({
              ...v,
              attachments: await presignArrayOfPaths(v.attachments || [], 60),
            })),
          ),
          comments: await Promise.all(
            r.comments.map(async (c) => ({
              ...c,
              attachments: await presignArrayOfPaths(c.attachments || [], 60),
            })),
          ),
        })),
      );

      return processed;
    }),

  getForUser: workspaceProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.view && !perms?.manage) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view promotion requests.',
        });
      }

      const filter: any = {
        groupId: ctx.workspace.groupId,
        targetUserId: input.userId.toString(),
      };

      // If user can't view closed requests and isn't a manager/admin, only show pending
      if (!isAdmin && !perms?.viewClosed && !perms?.manage) {
        filter.status = 'pending';
      }

      const requests = await readminCollections.promotion_request
        .find(filter)
        .sort({ created: -1 })
        .toArray();

      const processed = await Promise.all(
        requests.map(async (r) => ({
          ...r,
          attachments: await presignArrayOfPaths(r.attachments || [], 60),
          votes: await Promise.all(
            r.votes.map(async (v) => ({
              ...v,
              attachments: await presignArrayOfPaths(v.attachments || [], 60),
            })),
          ),
          comments: await Promise.all(
            r.comments.map(async (c) => ({
              ...c,
              attachments: await presignArrayOfPaths(c.attachments || [], 60),
            })),
          ),
        })),
      );

      return processed;
    }),

  getById: workspaceProcedure
    .input(z.object({ groupId: z.string(), requestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.view && !perms?.manage) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view promotion requests.',
        });
      }

      const request = await readminCollections.promotion_request.findOne({
        _id: new ObjectId(input.requestId),
        groupId: ctx.workspace.groupId,
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Promotion request not found.' });
      }

      // If closed and user can't view closed, deny
      if (request.status !== 'pending' && !isAdmin && !perms?.viewClosed && !perms?.manage) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view closed promotion requests.',
        });
      }

      // Batch-lookup voter/commenter role names from group_role (canonical source)
      const participantIds = [
        ...request.votes.map((v) => parseInt(v.userId)),
        ...request.comments.map((c) => parseInt(c.userId)),
      ];
      const members = participantIds.length
        ? await readminCollections.group_member
            .find({ groupId: ctx.workspace.groupId, userId: { $in: participantIds } })
            .toArray()
        : [];
      const roleIds = [...new Set(members.map(m => m.roleId))];
      const roles = roleIds.length
        ? await readminCollections.group_role
            .find({ groupId: ctx.workspace.groupId, id: { $in: roleIds } })
            .toArray()
        : [];
      const roleNameMap = new Map(roles.map(r => [r.id, r.name]));
      const memberRoleMap = new Map(members.map(m => [m.userId.toString(), roleNameMap.get(m.roleId) || '']));

      return {
        ...request,
        attachments: await presignArrayOfPaths(request.attachments || [], 60),
        votes: await Promise.all(
          request.votes.map(async (v) => ({
            ...v,
            roleName: memberRoleMap.get(v.userId) || undefined,
            attachments: await presignArrayOfPaths(v.attachments || [], 60),
          })),
        ),
        comments: await Promise.all(
          request.comments.map(async (c) => ({
            ...c,
            roleName: memberRoleMap.get(c.userId) || undefined,
            attachments: await presignArrayOfPaths(c.attachments || [], 60),
          })),
        ),
      };
    }),

  canAutoRank: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const canRank = await canWorkspaceOrUserRank('group', ctx.workspace.groupId);
      return canRank;
    }),

  create: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        targetUserId: z.string(),
        requestedRoleId: z.number().optional(),
        reason: z.string().min(1).max(2000),
        files: z.array(z.tuple([z.string(), z.string()])).max(5).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.create) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to create promotion requests.',
        });
      }

      const targetMember = await readminCollections.group_member.findOne({
        groupId: ctx.workspace.groupId,
        userId: parseInt(input.targetUserId),
      });

      if (!targetMember) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Target user is not a member of this group.',
        });
      }

      // Check for existing pending request for same user
      const existingRequest = await readminCollections.promotion_request.findOne({
        groupId: ctx.workspace.groupId,
        targetUserId: input.targetUserId,
        status: 'pending',
      });

      if (existingRequest) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'There is already a pending promotion request for this user.',
        });
      }

      let requestedRoleName: string | undefined;
      if (input.requestedRoleId) {
        const role = await readminCollections.group_role.findOne({
          groupId: ctx.workspace.groupId,
          id: input.requestedRoleId,
        });
        requestedRoleName = role?.name;
      }

      const attachments = await uploadAttachments(
        input.files,
        ctx.workspace.groupId,
        ctx.user.dbUser.robloxId!,
      );

      // Resolve names from canonical sources (roblox_user + group_role)
      const [targetUserInfo, targetRole, requestingUserInfo] = await Promise.all([
        getUserInfo(input.targetUserId),
        readminCollections.group_role.findOne({ groupId: ctx.workspace.groupId, id: targetMember.roleId }),
        getUserInfo(ctx.user.dbUser.robloxId!),
      ]);

      const newRequest = {
        groupId: ctx.workspace.groupId,
        targetUserId: input.targetUserId,
        targetUserName: targetUserInfo?.displayName || targetUserInfo?.name || input.targetUserId,
        currentRoleId: targetMember.roleId,
        currentRoleName: targetRole?.name || 'Unknown',
        requestedRoleId: input.requestedRoleId,
        requestedRoleName,
        reason: input.reason,
        attachments,
        requestedBy: ctx.user.dbUser.robloxId!,
        requestedByName: requestingUserInfo?.name || ctx.user.dbUser.robloxId!,
        status: 'pending' as const,
        votes: [],
        comments: [],
        created: new Date(),
      };

      await readminCollections.promotion_request.insertOne(newRequest);

      // Notify the Flows engine — fire-and-forget.
      emitFlowEvent({
        groupId: ctx.workspace.groupId,
        type: 'promotionRequest.created',
        subjectUserId: input.targetUserId,
        actorUserId: ctx.user.dbUser.robloxId!,
        event: {
          promotionRequest: {
            toRank: input.requestedRoleId,
            toRankName: requestedRoleName,
            reason: input.reason,
          },
        },
      });

      // Discord webhook logging (userInfo already resolved above as targetUserInfo)
      logPromotionRequestWebhook(
        ctx.workspace.groupId,
        'promotion-request-created',
        'Promotion Request Created',
        `**${targetUserInfo?.name || input.targetUserId}** has been nominated for promotion.\nCurrent role: ${targetRole?.name || 'Unknown'}${requestedRoleName ? `\nRequested role: ${requestedRoleName}` : ''}\nReason: ${input.reason}\nRequested by: ${requestingUserInfo?.name || ctx.user.dbUser.robloxId}`,
        input.targetUserId,
      );

      return newRequest;
    }),

  vote: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        requestId: z.string(),
        vote: z.enum(['support', 'oppose']),
        comment: z.string().min(1, 'You must leave a comment with your vote.').max(2000),
        files: z.array(z.tuple([z.string(), z.string()])).max(5).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.view) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to vote on promotion requests.',
        });
      }

      const request = await readminCollections.promotion_request.findOne({
        _id: new ObjectId(input.requestId),
        groupId: ctx.workspace.groupId,
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Promotion request not found.' });
      }

      if (request.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This promotion request is no longer open for voting.',
        });
      }

      const userId = ctx.user.dbUser.robloxId!;

      const attachments = await uploadAttachments(
        input.files,
        ctx.workspace.groupId,
        userId,
      );

      // Remove existing vote from this user (if changing vote)
      await readminCollections.promotion_request.updateOne(
        { _id: new ObjectId(input.requestId) },
        { $pull: { votes: { userId } } },
      );

      // Add new vote with required comment
      await readminCollections.promotion_request.updateOne(
        { _id: new ObjectId(input.requestId) },
        {
          $push: {
            votes: {
              userId,
              vote: input.vote,
              comment: input.comment,
              attachments,
              created: new Date(),
            },
          },
        },
      );

      // Notify the Flows engine with the running tally — fire-and-forget.
      // Re-read the doc so the counts reflect this vote (and any vote change).
      const updated = await readminCollections.promotion_request.findOne({
        _id: new ObjectId(input.requestId),
      });
      if (updated) {
        const support = updated.votes.filter((v) => v.vote === 'support').length;
        const oppose = updated.votes.filter((v) => v.vote === 'oppose').length;
        emitFlowEvent({
          groupId: ctx.workspace.groupId,
          type: 'promotionRequest.voted',
          subjectUserId: updated.targetUserId,
          actorUserId: userId,
          event: {
            promotionRequest: {
              toRank: updated.requestedRoleId,
              toRankName: updated.requestedRoleName,
            },
            vote: { choice: input.vote },
            votes: { support, oppose, total: support + oppose },
          },
        });
      }

      return { success: true };
    }),

  addComment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        requestId: z.string(),
        message: z.string().min(1).max(2000),
        files: z.array(z.tuple([z.string(), z.string()])).max(5).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.view) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to comment on promotion requests.',
        });
      }

      const request = await readminCollections.promotion_request.findOne({
        _id: new ObjectId(input.requestId),
        groupId: ctx.workspace.groupId,
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Promotion request not found.' });
      }

      if (request.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This promotion request is closed.',
        });
      }

      const attachments = await uploadAttachments(
        input.files,
        ctx.workspace.groupId,
        ctx.user.dbUser.robloxId!,
      );

      const comment = {
        userId: ctx.user.dbUser.robloxId!,
        message: input.message,
        attachments,
        created: new Date(),
      };

      await readminCollections.promotion_request.updateOne(
        { _id: new ObjectId(input.requestId) },
        { $push: { comments: comment } },
      );

      return comment;
    }),

  close: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        requestId: z.string(),
        status: z.enum(['approved', 'declined']),
        closeComment: z.string().max(2000).optional(),
        autoRankToRoleId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.manage) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to manage promotion requests.',
        });
      }

      const request = await readminCollections.promotion_request.findOne({
        _id: new ObjectId(input.requestId),
        groupId: ctx.workspace.groupId,
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Promotion request not found.' });
      }

      if (request.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This promotion request has already been closed.',
        });
      }

      let rankedTo: string | undefined;

      // Auto-rank if approved and a role was specified
      if (input.status === 'approved' && input.autoRankToRoleId) {
        const canRank = await canWorkspaceOrUserRank('group', ctx.workspace.groupId);
        if (canRank) {
          const targetRole = await readminCollections.group_role.findOne({
            groupId: ctx.workspace.groupId,
            id: input.autoRankToRoleId,
          });
          if (targetRole) {
            const result = await rankUser(
              'group',
              ctx.workspace.groupId,
              ctx.workspace.groupId,
              request.targetUserId,
              input.autoRankToRoleId,
              'user',
            );
            if (result === true) {
              rankedTo = targetRole.name;
            }
          }
        }
      }

      // Resolve closer's name from roblox_user
      const closerInfo = await getUserInfo(ctx.user.dbUser.robloxId!);

      await readminCollections.promotion_request.updateOne(
        { _id: new ObjectId(input.requestId) },
        {
          $set: {
            status: input.status,
            closedBy: ctx.user.dbUser.robloxId!,
            closedByName: closerInfo?.name || ctx.user.dbUser.robloxId!,
            closeComment: input.closeComment || (input.status === 'approved' ? 'Approved' : 'Closed'),
            rankedTo,
            closedAt: new Date(),
          },
        },
      );

      // Log promotion in staff history when approved
      if (input.status === 'approved') {
        try {
          await createHistory({
            groupId: ctx.workspace.groupId,
            actioningUser: ctx.user.dbUser.robloxId!,
            userId: request.targetUserId,
            reason: input.closeComment || 'Approved via promotion request',
            type: 'promotion',
            notify: false,
            role: false,
            approval_required: false,
            files: [],
          });
        } catch {
          // Staff history logging should not block the approval
        }
      }

      // Notify the Flows engine — fire-and-forget.
      emitFlowEvent({
        groupId: ctx.workspace.groupId,
        type: input.status === 'approved' ? 'promotionRequest.accepted' : 'promotionRequest.declined',
        subjectUserId: request.targetUserId,
        actorUserId: ctx.user.dbUser.robloxId!,
        event: {
          promotionRequest: {
            toRank: request.requestedRoleId,
            toRankName: request.requestedRoleName,
            reason: input.closeComment,
            rankedTo,
          },
        },
      });

      // Discord webhook logging
      const userInfo = await getUserInfo(request.targetUserId);
      const statusLabel = input.status === 'approved' ? 'Approved' : 'Closed';
      const rankedLine = rankedTo ? `\nRanked to: ${rankedTo}` : '';
      logPromotionRequestWebhook(
        ctx.workspace.groupId,
        'promotion-request-closed',
        `Promotion Request ${statusLabel}`,
        `**${userInfo?.name || request.targetUserId}**'s promotion request has been ${input.status}.${rankedLine}\n${input.closeComment ? `Comment: ${input.closeComment}\n` : ''}Closed by: ${closerInfo?.name || ctx.user.dbUser.robloxId}`,
        request.targetUserId,
      );

      return { success: true, rankedTo };
    }),

  delete: workspaceProcedure
    .input(z.object({ groupId: z.string(), requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const perms = ctx.department.permissions.promotionRequests;
      const isAdmin = ctx.department.permissions.admin;
      if (!isAdmin && !perms?.delete) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to delete promotion requests.',
        });
      }

      const result = await readminCollections.promotion_request.deleteOne({
        _id: new ObjectId(input.requestId),
        groupId: ctx.workspace.groupId,
      });

      if (result.deletedCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Promotion request not found.' });
      }

      return { success: true };
    }),
});
