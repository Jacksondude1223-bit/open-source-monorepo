import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import {
  lookupTrackedUsers,
  gatherWorkspaceUserData,
  purgeWorkspaceUserData,
  logDataRequest,
} from '~/services/workspaceUserData.service';

/**
 * Workspace-admin tooling to fulfil player data-access and data-deletion
 * requests (Roblox scoped-ID privacy rollout). Players are told in-game to
 * "contact the group" for these — never linked to our site (Roblox ToS) — so an
 * admin actions them here. Every export/delete is audit-logged.
 */
export const workspaceSettingsDataManagementRouter = router({
  // Search people tracked in this workspace by key, Roblox id, or name.
  search: workspaceProcedure
    .input(z.object({ groupId: z.string(), query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }
      return lookupTrackedUsers(input.groupId, input.query);
    }),

  // Export (data-access request) — returns the full bundle + logs the action.
  export: workspaceProcedure
    .input(z.object({ groupId: z.string(), userKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }
      const { bundle, subject } = await gatherWorkspaceUserData(input.groupId, input.userKey.trim(), ctx.workspace.groupName);
      await logDataRequest({
        groupId: input.groupId,
        actorRobloxId: ctx.user.dbUser.robloxId.toString(),
        actorName: ctx.user.dbUser.name,
        subject,
        action: 'export',
        counts: bundle.counts,
      });
      return bundle;
    }),

  // Delete (data-deletion request) — purges the workspace's activity data,
  // permanently opts the player out of future tracking, and logs the action.
  delete: workspaceProcedure
    .input(z.object({ groupId: z.string(), userKey: z.string().min(1), confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }
      const { counts, subject } = await purgeWorkspaceUserData(input.groupId, input.userKey.trim());
      await logDataRequest({
        groupId: input.groupId,
        actorRobloxId: ctx.user.dbUser.robloxId.toString(),
        actorName: ctx.user.dbUser.name,
        subject,
        action: 'delete',
        counts,
      });
      return { counts };
    }),

  // Recent audit trail of data requests for this workspace.
  recentLogs: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }
      return readminCollections.workspace_data_request_log
        .find({ groupId: input.groupId })
        .sort({ created: -1 })
        .limit(50)
        .toArray();
    }),
});
