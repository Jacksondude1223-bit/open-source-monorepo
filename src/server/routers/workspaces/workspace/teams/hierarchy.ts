import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import {
  getDirectReports,
  getAllReportsRecursive,
  getManagerChain,
  buildOrgChart,
} from '~/services/teamHierarchy.service';

export const workspaceTeamsHierarchyRouter = router({
  getOrgChart: workspaceProcedure
    .input(z.object({ groupId: z.string(), startTeamId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return buildOrgChart(ctx.workspace.groupId, input.startTeamId);
    }),

  getDirectReports: workspaceProcedure
    .input(z.object({ groupId: z.string(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Default to the current user if no userId specified
      const targetUserId = input.userId ?? ctx.user.dbUser.robloxId!;
      return getDirectReports(ctx.workspace.groupId, targetUserId);
    }),

  getAllReports: workspaceProcedure
    .input(z.object({ groupId: z.string(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId ?? ctx.user.dbUser.robloxId!;
      return getAllReportsRecursive(ctx.workspace.groupId, targetUserId);
    }),

  getManagerChain: workspaceProcedure
    .input(z.object({ groupId: z.string(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId ?? ctx.user.dbUser.robloxId!;
      return getManagerChain(ctx.workspace.groupId, targetUserId);
    }),
});
