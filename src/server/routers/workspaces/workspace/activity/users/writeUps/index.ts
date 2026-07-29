import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { getProcessedUserObject } from '~/services/roblox.service';
import { router } from '~/server/trpc';

export const workspaceActivityUsersWriteUpsRouter = router({
  get: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, userId } = input;
      const found = await readminCollections.write_ups.find({
        groupId: workspace.groupId,
        userId: parseInt(userId),
      }).toArray();

      // Hidden writeups: drop 'hidden' entries and mask the reason/evidence of
      // 'reasonHidden' entries for viewers without writeUps.viewHidden.
      const canSeeHidden = department.permissions.admin || department.permissions.writeUps?.viewHidden || false;
      const me = user.dbUser.robloxId?.toString();
      const visible = found.filter(
        (wu) =>
          canSeeHidden ||
          wu.visibility !== 'hidden' ||
          wu.disciplinarianId?.toString() === me ||
          (wu.approvedBy != null && wu.approvedBy.toString() === me),
      );

      const formatted = await Promise.all(
        visible.map(async (wu) => {
          const isOwnerOrApprover =
            wu.disciplinarianId?.toString() === me || (wu.approvedBy != null && wu.approvedBy.toString() === me);
          const mask = !canSeeHidden && !isOwnerOrApprover && wu.visibility === 'reasonHidden';
          return {
            ...wu,
            ...(mask ? { reason: '', evidence: [], reasonHidden: true } : {}),
            disciplinarian: await getProcessedUserObject(wu.disciplinarianId),
          };
        }),
      );

      return formatted;
    }),

});
