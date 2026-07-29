import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { v4 } from 'uuid';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import {
  submitTimeOffRequest,
  reviewTimeOffRequest,
  getTimeOffRequestsForUser,
  getAllPendingTimeOff,
  getPendingTimeOffForApprover,
  getTimeOffRequestById,
  addTimeOffComment,
} from '~/services/workspaceServices/approvalRequests';
import { getAllReportsRecursive } from '~/services/teamHierarchy.service';
import {
  buildApprovalChain,
  getTeamsSettings,
  canActionRequest,
  canCommentOnRequest,
} from '~/services/workspaceServices/approvalChain.service';
import { readminCollections } from '~/services/mongo.service';

async function getManagedTeamIds(groupId: string, userId: string): Promise<string[]> {
  const allReports = await getAllReportsRecursive(groupId, userId);
  return [...new Set(allReports.map((r) => r.teamId))];
}

async function getTeamNameMap(groupId: string): Promise<Map<string, string>> {
  const teams = await readminCollections.team.find({ groupId }).toArray();
  return new Map(teams.map((t) => [t._id!.toString(), t.name]));
}

export const workspaceTeamsTimeOffRouter = router({
  submit: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        reason: z.string().min(1).max(1000),
        starts: z.string(),
        ends: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const settings = getTeamsSettings(ctx.workspace);
      if (!settings.enabled) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Teams are disabled for this workspace.' });
      }

      const starts = new Date(input.starts);
      const ends = new Date(input.ends);
      if (ends <= starts) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'End date must be after start date.' });
      }

      const teamNames = await getTeamNameMap(ctx.workspace.groupId);
      const chain = await buildApprovalChain(
        ctx.workspace.groupId,
        ctx.user.dbUser.robloxId!,
        settings.timeOff,
        teamNames,
      );

      return submitTimeOffRequest(
        ctx.workspace.groupId,
        input.teamId,
        ctx.user.dbUser.robloxId!,
        { reason: input.reason, starts, ends },
        chain,
      );
    }),

  getMyRequests: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      return getTimeOffRequestsForUser(ctx.workspace.groupId, ctx.user.dbUser.robloxId!);
    }),

  getPendingApprovals: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const userId = ctx.user.dbUser.robloxId!;
      const isAdmin = ctx.department.permissions.admin || ctx.department.permissions.teams?.approve;

      if (isAdmin) {
        return getAllPendingTimeOff(ctx.workspace.groupId);
      }

      const managedTeamIds = await getManagedTeamIds(ctx.workspace.groupId, userId);
      return getPendingTimeOffForApprover(ctx.workspace.groupId, userId, managedTeamIds);
    }),

  review: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        requestId: z.string(),
        decision: z.enum(['approved', 'denied']),
        reviewNote: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await getTimeOffRequestById(ctx.workspace.groupId, input.requestId);
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found.' });
      if (request.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This request has already been reviewed.' });
      }

      const userId = ctx.user.dbUser.robloxId!;
      const isAdmin = ctx.department.permissions.admin || ctx.department.permissions.teams?.approve;
      const managedTeamIds = isAdmin ? [] : await getManagedTeamIds(ctx.workspace.groupId, userId);

      if (!canActionRequest(request, userId, !!isAdmin, managedTeamIds)) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You cannot approve this request right now.' });
      }

      await reviewTimeOffRequest(
        ctx.workspace.groupId,
        request,
        userId,
        input.decision,
        input.reviewNote,
      );
    }),

  addComment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        requestId: z.string(),
        text: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await getTimeOffRequestById(ctx.workspace.groupId, input.requestId);
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found.' });

      const userId = ctx.user.dbUser.robloxId!;
      const isAdmin = ctx.department.permissions.admin || ctx.department.permissions.teams?.approve;
      const managedTeamIds = isAdmin ? [] : await getManagedTeamIds(ctx.workspace.groupId, userId);

      if (!canCommentOnRequest(request, userId, !!isAdmin, managedTeamIds)) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You cannot comment on this request.' });
      }

      await addTimeOffComment(ctx.workspace.groupId, input.requestId, {
        id: v4(),
        userId,
        text: input.text,
        created: new Date(),
      });
    }),
});
