import { router } from '~/server/trpc';
import { workspaceSettingsBillingRouter } from './billing';
import { workspaceSettingsDepartmentsRouter } from './departments';
import { workspaceSettingsIntegrationsRouter } from './integrations';
import { workspaceProcedure } from '~/server/procedures';
import { z } from 'zod';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { workspaceSettingsDistributionsRouter } from './distributions';
import { workspaceSettingsActivityGoalsRouter } from './activity-goals';
import { generateSecureString } from '~/services/Crypto-service.service';
import { workspaceSettingsUserTagsRouter } from './user-tags';
import { workspaceSettingsRankingKeysRouter } from './ranking-keys';
import { workspaceSettingsDiscordLoggingRouter } from './logging';
import { readminCollections } from '~/services/mongo.service';
import { v4 } from 'uuid';
import { uploadImage, presignUrl } from '~/services/CDN-service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { workspaceSettingsRemoteAdminRouter } from './remote-admin';
import { workspaceSettingsTimeclockRouter } from './timeclock';
import { workspaceSettingsTeamsRouter } from './teams';
import { workspaceSettingsNotificationsRouter } from './notifications';
import { workspaceSettingsBannersRouter } from './banners';
import { workspaceSettingsPartnershipRouter } from './partnership';
import { workspaceSettingsModulesRouter } from './modules';
import { workspaceSettingsPrivacyRouter } from './privacy';
import { workspaceSettingsDataManagementRouter } from './dataManagement';
import { workspaceSettingsDataExportRouter } from './dataExport';

export const workspaceSettingsRouter = router({
  departments: workspaceSettingsDepartmentsRouter,
  modules: workspaceSettingsModulesRouter,
  billing: workspaceSettingsBillingRouter,
  integrations: workspaceSettingsIntegrationsRouter,
  discordLogging: workspaceSettingsDiscordLoggingRouter,
  activityGoals: workspaceSettingsActivityGoalsRouter,
  distributions: workspaceSettingsDistributionsRouter,
  userTags: workspaceSettingsUserTagsRouter,
  rankingKeys: workspaceSettingsRankingKeysRouter,
  remoteAdmin: workspaceSettingsRemoteAdminRouter,
  timeclock: workspaceSettingsTimeclockRouter,
  teams: workspaceSettingsTeamsRouter,
  notifications: workspaceSettingsNotificationsRouter,
  banners: workspaceSettingsBannersRouter,
  partnership: workspaceSettingsPartnershipRouter,
  privacy: workspaceSettingsPrivacyRouter,
  dataManagement: workspaceSettingsDataManagementRouter,
  dataExport: workspaceSettingsDataExportRouter,
  updateGeneralSettings: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        minSyncRole: z.string(),
        selectedColor: z.enum(['red', 'orange', 'yellow', 'green', 'teal', 'sky', 'cyan', 'blue', 'indigo', 'purple', 'rose', 'pink']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, minSyncRole, selectedColor } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      await readminCollections.workspace.updateOne({
        _id: workspace._id,
      }, {
        $set: {
          minSyncRole: parseInt(minSyncRole),
          brandColor: selectedColor || 'blue',
        },
      })

      return workspace;
    }),
  uploadBannerImage: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        data: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, user, workspace } = ctx;
      const { groupId, name, data } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }


      const id = v4();
      const filePath = `workspaces/${workspace.groupId}/imgs/banner/${user.dbUser.robloxId}/${id}-${name}`;
      await uploadImage(filePath, 'image.png', data)
      const presignedUrl = await presignUrl(filePath, 604800);
      await sendReAdminInternalWebhookMessage('imageUploads', 'blue', 'Image upload - Banner Upload', `https://cdn.readmin.app/${filePath}`, presignedUrl, undefined, presignedUrl)

      await readminCollections.workspace.updateOne({
        _id: workspace._id,
      }, {
        $set: {
          bannerImage: filePath,
        },
      })

      return workspace;
    }),
  uploadWorkspaceLogo: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        data: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, user, workspace } = ctx;
      const { groupId, name, data } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }


      const id = v4();
      const filePath = `workspaces/${workspace.groupId}/imgs/logos/${user.dbUser.robloxId}/${id}-${name}`;
      await uploadImage(filePath, 'image.png', data)
      const presignedUrl = await presignUrl(filePath, 604800);
      await sendReAdminInternalWebhookMessage('imageUploads', 'blue', 'Image upload - Logo Upload', `https://cdn.readmin.app/${filePath}`, presignedUrl, undefined, presignedUrl)

      await readminCollections.workspace.updateOne({
        _id: workspace._id,
      }, {
        $set: {
          logoImage: filePath,
        },
      })

      return workspace;
    }),
  removeWorkspaceLogo: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      await readminCollections.workspace.updateOne({
        _id: workspace._id,
      }, {
        $unset: {
          logoImage: '',
        },
      })

      return workspace;
    }),
  removeBannerImage: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      await readminCollections.workspace.updateOne({
        _id: workspace._id,
      }, {
        $unset: {
          bannerImage: '',
        },
      })

      return workspace;
    }),
  resetLoaderId: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      await readminCollections.workspace.updateOne({
        _id: workspace._id,
      }, {
        $set: {
          loaderId: `ReAdmin_Loader_ID=${await generateSecureString(100)}`,
        },
      })

      return workspace;
    }),
});
