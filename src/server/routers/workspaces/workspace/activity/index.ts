import { router } from '~/server/trpc';
import { workspaceActivityInactivityRouter } from './inactivity';
import { workspaceActivityStaffRouter } from './staff';
import { workspaceActivityUsersRouter } from './users';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { z } from 'zod';
import { processObjectsWithUserIdToUserData } from '~/services/roblox.service';

export const workspaceActivityRouter = router({
  inactivity: workspaceActivityInactivityRouter,
  users: workspaceActivityUsersRouter,
  staff: workspaceActivityStaffRouter,
  leaderboard: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;

      const distribution = await readminCollections.distribution.findOne({
        groupId: workspace.groupId,
        isCurrent: true,
      })

      const staffMembers = await readminCollections.group_member.find({
        groupId: workspace.groupId,
        rankId: { $gte: workspace.minSyncRole },
      }, { projection: { userId: 1 } }).toArray();
      const staffUserIds = staffMembers.map((member) => member.userId.toString());

      const leaderboard = await readminCollections.user_game_session_distribution_summary.find({
        groupId: workspace.groupId,
        distribution: distribution?.num?.toString(),
        userId: { $in: staffUserIds },
      }, {
        limit: 50,
        sort: {
          'minutes.total': -1
        }
      }).toArray();
      

      return await processObjectsWithUserIdToUserData(leaderboard);

    }),
});
