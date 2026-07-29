import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { workspaceActivityRouter } from './activity';
import { workspaceFeedRouter } from './feed';
import { workspaceGamesRouter } from './games';
import { workspaceSessionsRouter } from './sessions';
import { workspaceSettingsRouter } from './settings';
import { workspaceHistoryRouter } from './history';
import { workspaceFormsRouter } from './forms';
import { workspaceTasksRouter } from './tasks';
import { workspaceViewsRouter } from './views';
import { readminCollections } from '~/services/mongo.service';
import { RunningGames } from '~/services/NewMongoTypes';
import { workspaceKnowledgeHub } from './hub';
import { workspaceOrderRouter } from './orders';
import { workspaceCallsRouter } from './calls';
import { workspaceFlowsRouter } from './flows';
import { workspacePromotionRequestsRouter } from './promotion-requests/promotionRequests';
import { workspaceTeamsRouter } from './teams';
import { workspaceTimeclockRouter } from './timeclock';
import { presignUrl } from '~/services/CDN-service';
import { getRolesDepartmentCanRankTo, workspaceUsingOpenCloud } from '~/services/workspaces.service';

export const workspaceRouter = router({
  activity: workspaceActivityRouter,
  feed: workspaceFeedRouter,
  games: workspaceGamesRouter,
  sessions: workspaceSessionsRouter,
  history: workspaceHistoryRouter,
  knowledge: workspaceKnowledgeHub,
  orders: workspaceOrderRouter,
  calls: workspaceCallsRouter,
  forms: workspaceFormsRouter,
  tasks: workspaceTasksRouter,
  views: workspaceViewsRouter,
  flows: workspaceFlowsRouter,
  promotionRequests: workspacePromotionRequestsRouter,
  teams: workspaceTeamsRouter,
  timeclock: workspaceTimeclockRouter,
  settings: workspaceSettingsRouter,
  getWorkspace: workspaceProcedure.input(z.object({
    groupId: z.string(),
  }))
    .query(async ({ ctx, input }) => {
      const groupId = input.groupId;
      const department = ctx.department;
      const [groupRoles, userRole, runningPlayer, rankableRoles, usingOpenCloud] = await Promise.all([
        readminCollections.group_role.find({ groupId: groupId, rank: { $ne: 0 } }, { sort: { rank: 1 } }).toArray(),
        readminCollections.group_member.findOne({ groupId, userId: parseInt(ctx?.user?.dbUser?.robloxId || '0') }),
        readminCollections.running_game_players.findOne({ groupId, userId: parseInt(ctx?.user?.dbUser?.robloxId || '0').toString() }),
        getRolesDepartmentCanRankTo(ctx.workspace, department),
        workspaceUsingOpenCloud(groupId)
      ]);
      let runningGame: RunningGames | null = null;
      if (runningPlayer) {
        runningGame = await readminCollections.running_games.findOne({ _id: runningPlayer.runningGameId });
      }

      return {
        ...ctx.workspace,
        loaderId: department.permissions.admin
          ? ctx.workspace.loaderId
          : 'no-sir',
        group: ctx.group,
        department: ctx.department,
        roles: groupRoles,
        userRole,
        runningGame,
        runningPlayer,
        rankableRoles,
        usingOpenCloud,
        brandColor: ctx.workspace.brandColor || 'blue',
      };
    }),
  getWorkspaceLogo: workspaceProcedure.input(z.object({
    groupId: z.string(),
  })).query(async ({ ctx }) => {
    const workspace = ctx.workspace;
    if (!workspace.logoImage) {
      return false;
    }
    const banner = await presignUrl(workspace.logoImage, 1000)
    return banner;
  }),
  getWorkspaceBanner: workspaceProcedure.input(z.object({
    groupId: z.string(),
  })).query(async ({ ctx }) => {
    const workspace = ctx.workspace;
    if (!workspace.bannerImage) {
      return false;
    }
    const banner = await presignUrl(workspace.bannerImage, 1000)
    return banner;
  }),
  getOnboardingStatus: workspaceProcedure.input(z.object({
    groupId: z.string(),
  })).query(async ({ input }) => {
    const { groupId } = input;
    const numericGroupId = parseInt(groupId);
    const [usingOpenCloud, discordBot, game, trackedSession, view, departmentUsers] = await Promise.all([
      workspaceUsingOpenCloud(groupId),
      readminCollections.discord_bots.findOne({ groupId }),
      readminCollections.game.findOne({ groupId }),
      readminCollections.user_game_session.findOne({ groupId: numericGroupId }),
      readminCollections.workspace_view.findOne({ groupId }),
      readminCollections.department_users.distinct('userId', { groupId }),
    ]);

    const steps = {
      linkedRoblox: usingOpenCloud,
      linkedDiscord: !!discordBot,
      installedModule: !!game,
      trackedActivity: !!trackedSession,
      createdView: !!view,
      invitedStaff: departmentUsers.length >= 3,
    };

    const completedCount = Object.values(steps).filter(Boolean).length;
    const totalCount = Object.keys(steps).length;

    return {
      steps,
      completedCount,
      totalCount,
      activated: completedCount === totalCount,
    };
  }),
  getWorkspaceMutation: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const groupId = input.groupId;
      const department = ctx.department;
      const [groupRoles, userRole] = await Promise.all([
        readminCollections.group_role.find({ groupId: groupId, rank: { $ne: 0 } }, { sort: { rank: 1 } }).toArray(),
        readminCollections.group_member.findOne({ groupId, userId: parseInt(ctx?.user?.dbUser?.robloxId || '0') })
      ]);
      return {
        ...ctx.workspace,
        loaderId: department.permissions.admin
          ? ctx.workspace.loaderId
          : 'no-sir',
        group: ctx.group,
        department: ctx.department,
        roles: groupRoles,
        userRole
      };
    }),
  getUpcomingBirthdays: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        daysAhead: z.number().min(1).max(90).optional().default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { groupId, daysAhead } = input;
      
      // Get all department users for this workspace
      const departmentUsers = await readminCollections.department_users.find({
        groupId: groupId,
      }).toArray();

      if (!departmentUsers.length) {
        return [];
      }

      // Get user information for all department users
      const userIds = departmentUsers.map(du => du.userId);
      const users = await readminCollections.user.find({
        robloxId: { $in: userIds },
        birthday: { $exists: true },
      }).toArray();

      // Calculate upcoming birthdays
      const today = new Date();
      const currentMonth = today.getMonth() + 1; // 1-12
      const currentDay = today.getDate();

      interface UpcomingBirthday {
        userId: string;
        name?: string;
        thumbnail?: string;
        month: number;
        day: number;
        daysUntil: number;
      }

      const upcomingBirthdays: UpcomingBirthday[] = users
        .filter(user => user.birthday)
        .map(user => {
          const birthday = user.birthday!;
          
          // Calculate days until birthday
          const currentDate = new Date(today.getFullYear(), currentMonth - 1, currentDay);
          let birthdayThisYear = new Date(today.getFullYear(), birthday.month - 1, birthday.day);
          
          // If birthday already passed this year, check next year
          if (birthdayThisYear < currentDate) {
            birthdayThisYear = new Date(today.getFullYear() + 1, birthday.month - 1, birthday.day);
          }

          const daysUntil = Math.floor((birthdayThisYear.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            userId: user.robloxId,
            name: user.name,
            thumbnail: user.thumbnail,
            month: birthday.month,
            day: birthday.day,
            daysUntil,
          };
        })
        .filter(b => b.daysUntil <= daysAhead)
        .sort((a, b) => a.daysUntil - b.daysUntil);

      return upcomingBirthdays;
    }),
});
