import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import {
  submitExpenseRequest,
  reviewExpenseRequest,
  getExpenseRequestsForUser,
  getAllPendingExpenses,
  getPendingExpensesForApprover,
  getExpenseRequestById,
  addExpenseComment,
} from '~/services/workspaceServices/approvalRequests';
import { getAllReportsRecursive } from '~/services/teamHierarchy.service';
import {
  buildApprovalChain,
  getTeamsSettings,
  canActionRequest,
  canCommentOnRequest,
} from '~/services/workspaceServices/approvalChain.service';
import { readminCollections } from '~/services/mongo.service';
import { uploadImage, presignArrayOfPaths } from '~/services/CDN-service';
import { v4 } from 'uuid';

async function getManagedTeamIds(groupId: string, userId: string): Promise<string[]> {
  const allReports = await getAllReportsRecursive(groupId, userId);
  return [...new Set(allReports.map((r) => r.teamId))];
}

async function getTeamNameMap(groupId: string): Promise<Map<string, string>> {
  const teams = await readminCollections.team.find({ groupId }).toArray();
  return new Map(teams.map((t) => [t._id!.toString(), t.name]));
}

export const workspaceTeamsExpensesRouter = router({
  submit: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        category: z.enum(['robux', 'budget', 'general']),
        amount: z.number().min(0),
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(2000),
        attachments: z
          .array(z.tuple([z.string(), z.string()])) // [fileName, base64Data]
          .max(5)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const settings = getTeamsSettings(ctx.workspace);
      if (!settings.enabled) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Teams are disabled for this workspace.' });
      }

      const canApprove =
        ctx.department.permissions.admin ||
        ctx.department.permissions.teams?.approve ||
        ctx.department.permissions.teams?.manage;
      if (settings.allowMemberExpenseRequests === false && !canApprove) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Expense requests are restricted to managers in this workspace.',
        });
      }

      const paths: string[] = [];
      for (const [fileName, fileData] of input.attachments ?? []) {
        const id = v4();
        const filePath = `workspaces/${ctx.workspace.groupId}/expenses/${ctx.user.dbUser.robloxId}/${id}-${fileName}`;
        paths.push(filePath);
        await uploadImage(filePath, fileName, fileData);
      }

      const teamNames = await getTeamNameMap(ctx.workspace.groupId);
      const chain = await buildApprovalChain(
        ctx.workspace.groupId,
        ctx.user.dbUser.robloxId!,
        settings.expenses,
        teamNames,
      );

      return submitExpenseRequest(
        ctx.workspace.groupId,
        input.teamId,
        ctx.user.dbUser.robloxId!,
        {
          category: input.category,
          amount: input.amount,
          title: input.title,
          description: input.description,
          attachments: paths,
        },
        chain,
      );
    }),

  getMyRequests: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const requests = await getExpenseRequestsForUser(ctx.workspace.groupId, ctx.user.dbUser.robloxId!);
      return Promise.all(
        requests.map(async (r) => ({
          ...r,
          attachments: await presignArrayOfPaths(r.attachments, 60),
        })),
      );
    }),

  getPendingApprovals: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const userId = ctx.user.dbUser.robloxId!;
      const isAdmin = ctx.department.permissions.admin || ctx.department.permissions.teams?.approve;

      const requests = isAdmin
        ? await getAllPendingExpenses(ctx.workspace.groupId)
        : await getPendingExpensesForApprover(
            ctx.workspace.groupId,
            userId,
            await getManagedTeamIds(ctx.workspace.groupId, userId),
          );

      return Promise.all(
        requests.map(async (r) => ({
          ...r,
          attachments: await presignArrayOfPaths(r.attachments, 60),
        })),
      );
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
      const request = await getExpenseRequestById(ctx.workspace.groupId, input.requestId);
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found.' });
      if (request.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This request has already been reviewed.' });
      }

      const userId = ctx.user.dbUser.robloxId!;
      const isAdmin = ctx.department.permissions.admin || ctx.department.permissions.teams?.approve;
      const managedTeamIds = isAdmin ? [] : await getManagedTeamIds(ctx.workspace.groupId, userId);

      if (!canActionRequest(request, userId, !!isAdmin, managedTeamIds)) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You cannot approve this expense right now.' });
      }

      await reviewExpenseRequest(
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
      const request = await getExpenseRequestById(ctx.workspace.groupId, input.requestId);
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found.' });

      const userId = ctx.user.dbUser.robloxId!;
      const isAdmin = ctx.department.permissions.admin || ctx.department.permissions.teams?.approve;
      const managedTeamIds = isAdmin ? [] : await getManagedTeamIds(ctx.workspace.groupId, userId);

      if (!canCommentOnRequest(request, userId, !!isAdmin, managedTeamIds)) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You cannot comment on this expense.' });
      }

      await addExpenseComment(ctx.workspace.groupId, input.requestId, {
        id: v4(),
        userId,
        text: input.text,
        created: new Date(),
      });
    }),
});
