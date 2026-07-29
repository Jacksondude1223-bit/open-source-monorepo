import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';

/**
 * Activity-tracking privacy controls (Roblox scoped-ID rollout). Persists to
 * workspace.privacySettings.{trackStaffOnly,requireConsent}; both default off,
 * so the in-game tracker behaves exactly as before until a workspace opts in.
 */
export const workspaceSettingsPrivacyRouter = router({
  get: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      return {
        trackStaffOnly: ctx.workspace.privacySettings?.trackStaffOnly ?? false,
        requireConsent: ctx.workspace.privacySettings?.requireConsent ?? false,
      };
    }),

  update: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        trackStaffOnly: z.boolean().optional(),
        requireConsent: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }

      const $set: Record<string, boolean> = {};
      if (input.trackStaffOnly !== undefined) {
        $set['privacySettings.trackStaffOnly'] = input.trackStaffOnly;
      }
      if (input.requireConsent !== undefined) {
        $set['privacySettings.requireConsent'] = input.requireConsent;
      }
      if (Object.keys($set).length > 0) {
        await readminCollections.workspace.updateOne({ _id: workspace._id }, { $set });
      }

      return {
        trackStaffOnly: input.trackStaffOnly ?? workspace.privacySettings?.trackStaffOnly ?? false,
        requireConsent: input.requireConsent ?? workspace.privacySettings?.requireConsent ?? false,
      };
    }),
});
