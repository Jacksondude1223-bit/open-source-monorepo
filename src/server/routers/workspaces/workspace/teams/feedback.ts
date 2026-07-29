import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import {
  submitFeedback,
  getFeedbackForUser,
  getFeedbackByTeam,
  deleteFeedback,
} from '~/services/workspaceServices/teamFeedback';
import { getAllReportsRecursive } from '~/services/teamHierarchy.service';
import { createHistory } from '~/services/workspaceServices/staffHistory';
import { canManageTeam, requireManageAllTeams } from './auth';

export const workspaceTeamsFeedbackRouter = router({
  submit: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        toUserId: z.string(),
        type: z.enum(['commendation', 'poor_performance', 'strike', 'demotion_recommendation']),
        note: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fromUserId = ctx.user.dbUser.robloxId!;

      // Admins, manage-all, and leads of this team can give feedback to anyone in it.
      // Everyone else may only give feedback to users who report to them.
      if (!(await canManageTeam(ctx, input.teamId))) {
        const allReports = await getAllReportsRecursive(ctx.workspace.groupId, fromUserId);
        const isReport = allReports.some((r) => r.userId === input.toUserId);
        if (!isReport) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You can only give feedback to users who report to you.',
          });
        }
      }

      // Disciplinary feedback (strike / demotion recommendation) lives only in staff
      // history (write_ups) so it shows on the employee history page and fires the
      // usual Discord webhooks. No separate feedback row is kept.
      if (input.type === 'strike' || input.type === 'demotion_recommendation') {
        const writeUpType = input.type === 'strike' ? 'writeup' : 'demotion';
        await createHistory({
          groupId: ctx.workspace.groupId,
          actioningUser: fromUserId,
          userId: input.toUserId,
          reason: `[Team Feedback] ${input.note}`,
          type: writeUpType,
          notify: false,
          role: false,
          approval_required: false,
          files: [],
        });
        return { ok: true as const };
      }

      // Advisory feedback (commendation / poor performance) is stored as a
      // categorized user_note, reusing the canonical notes store.
      return submitFeedback(
        ctx.workspace.groupId,
        input.teamId,
        fromUserId,
        input.toUserId,
        input.type,
        input.note,
      );
    }),

  getForUser: workspaceProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const requestingUserId = ctx.user.dbUser.robloxId!;
      const isAdmin = ctx.department.permissions.admin || ctx.department.permissions.teams?.manageAll;

      // You can view your own feedback, or your direct reports' feedback if a manager/admin
      if (!isAdmin && requestingUserId !== input.userId) {
        const allReports = await getAllReportsRecursive(ctx.workspace.groupId, requestingUserId);
        const isReport = allReports.some((r) => r.userId === input.userId);
        if (!isReport) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You can only view feedback for users who report to you.',
          });
        }
      }

      return getFeedbackForUser(ctx.workspace.groupId, input.userId);
    }),

  getByTeam: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Leads of this team (and admins / manage-all) can view its feedback.
      if (!(await canManageTeam(ctx, input.teamId))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to view team feedback.' });
      }
      return getFeedbackByTeam(ctx.workspace.groupId, input.teamId);
    }),

  delete: workspaceProcedure
    .input(z.object({ groupId: z.string(), feedbackId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // No team context on a feedback id, so deletion needs the workspace-wide capability.
      requireManageAllTeams(ctx);
      await deleteFeedback(ctx.workspace.groupId, input.feedbackId);
    }),
});
