import { router } from '~/server/trpc';
import { workspaceFormsApplicationsApplicationQuestionsRouter } from './questions/applicationQuestions';
import { workspaceProcedure } from '~/server/procedures';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import StringToObjectID from '~/utils/StringToObjectID';
import { workspaceFormsApplicationsApplicationResponsesRouter } from './responses/applicationResponses';
import { workspaceFormsApplicationsApplicationAutomationsRouter } from './automations/applicationAutomations';
import { workspaceFormsApplicationsApplicationQuizModeRouter } from './quiz-mode/applicationQuizMode';
import { readminCollections } from '~/services/mongo.service';
import { v4 } from 'uuid';
import { uploadImage, presignUrl } from '~/services/CDN-service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';

// Web banner images are stored as private CDN object keys. Older forms may
// still hold a full public https URL — those are returned untouched, while CDN
// keys are turned into a temporary signed URL the browser can render.
async function resolveWebBannerUrl(
  value: unknown,
): Promise<string | undefined> {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return presignUrl(trimmed, 604800);
}

export const workspaceFormsApplicationsApplicationRouter = router({
  questions: workspaceFormsApplicationsApplicationQuestionsRouter,
  quizMode: workspaceFormsApplicationsApplicationQuizModeRouter,
  automations: workspaceFormsApplicationsApplicationAutomationsRouter,
  responses: workspaceFormsApplicationsApplicationResponsesRouter,
  getApplication: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId } = input;
      if (
        !Object.values(department.permissions.applications).filter(
          (a) => a == true,
        )
      ) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to edit applications.',
        });
      }

      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      if (application.appearance?.webBannerUrl) {
        application.appearance.webBannerUrl = await resolveWebBannerUrl(
          application.appearance.webBannerUrl,
        );
      }

      return application;
    }),
  saveSettings: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        settings: z.any(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, settings } = input;
      if (!department.permissions.applications.editApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to edit applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      const {
        name,
        description,
        applyOnlineId,
        enableResponses,
        singleResponse,
        minimumRole,
        maximumRole,
        minimumDaysToApplyAgain,
        appearance,
        buttonType,
        responseWindow,
        responseChannels,
        hideIfIneligible,
        statusOptions,
        applicantVisibility,
        links,
      } = settings;

      const toSet: any = {};

      toSet.name = name;
      toSet.description = description;
      toSet.permissions = {
        acceptingResponses: enableResponses,
        ranking: {
          minRank: parseInt(minimumRole),
          maxRank: parseInt(maximumRole),
        },
        applyOnce: singleResponse,
        timeUntilApplyAgain: parseInt(minimumDaysToApplyAgain),
      };

      const VALID_BUTTON_TYPES = [
        'submit',
        'send',
        'apply',
        'request',
        'complete',
        'sign',
      ];
      if (typeof buttonType === 'string' && VALID_BUTTON_TYPES.includes(buttonType)) {
        toSet.buttonType = buttonType;
      }

      if (responseWindow && typeof responseWindow === 'object') {
        toSet.responseWindow = {
          enabled: !!responseWindow.enabled,
          start:
            typeof responseWindow.start === 'string' && responseWindow.start
              ? responseWindow.start
              : undefined,
          end:
            typeof responseWindow.end === 'string' && responseWindow.end
              ? responseWindow.end
              : undefined,
        };
      }

      if (responseChannels && typeof responseChannels === 'object') {
        toSet.responseChannels = {
          web: !!responseChannels.web,
          game: !!responseChannels.game,
        };
      }

      if (typeof hideIfIneligible === 'boolean') {
        toSet.hideIfIneligible = hideIfIneligible;
      }

      const VALID_STATUSES = [
        'pending',
        'passed',
        'reported',
        'failed',
        'received',
        'read',
        'completed',
        'denied',
        'review',
      ];
      if (Array.isArray(statusOptions)) {
        toSet.statusOptions = statusOptions.filter(
          (s: unknown) => typeof s === 'string' && VALID_STATUSES.includes(s),
        );
      }

      if (applicantVisibility && typeof applicantVisibility === 'object') {
        toSet.applicantVisibility = {
          showAnswers: !!applicantVisibility.showAnswers,
          showQuizCorrectness: !!applicantVisibility.showQuizCorrectness,
          showCorrectAnswers: !!applicantVisibility.showCorrectAnswers,
          showStatus: !!applicantVisibility.showStatus,
        };
      }

      if (links && typeof links === 'object') {
        toSet.links = {
          showRobloxGroup: !!links.showRobloxGroup,
          showDiscord: !!links.showDiscord,
        };
      }

      if (appearance) {
        const hex = (value: unknown): string | undefined => {
          if (typeof value !== 'string') return undefined;
          const trimmed = value.trim();
          return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : undefined;
        };
        const assetId = (value: unknown): string | undefined => {
          if (typeof value !== 'string') return undefined;
          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : undefined;
        };

        const audios = Array.isArray(appearance.audios)
          ? appearance.audios
              .map((audio: any) => ({
                assetId: assetId(audio?.assetId),
                name:
                  typeof audio?.name === 'string' && audio.name.trim().length > 0
                    ? audio.name.trim()
                    : undefined,
              }))
              .filter((audio: any) => audio.assetId)
          : [];

        toSet.appearance = {
          logoAssetId: assetId(appearance.logoAssetId),
          bannerAssetId: assetId(appearance.bannerAssetId),
          // The web banner is managed exclusively through the dedicated upload
          // mutation so users can't supply an unmoderated free URL. Always keep
          // the previously stored value here.
          webBannerUrl: application.appearance?.webBannerUrl,
          soundAssetId: assetId(appearance.soundAssetId),
          font:
            typeof appearance.font === 'string' && appearance.font.trim().length > 0
              ? appearance.font.trim()
              : undefined,
          showLogo: appearance.showLogo !== false,
          showBanner: appearance.showBanner !== false,
          audios,
          theme: {
            accent: hex(appearance.theme?.accent),
            background: hex(appearance.theme?.background),
            surface: hex(appearance.theme?.surface),
            text: hex(appearance.theme?.text),
          },
        };
      }

      if (applyOnlineId != '') {
        // Make sure the applyOnlineId is unique
        const existingApplication = await readminCollections.application.findOne({
          applyOnlineId,
        });
        if (
          existingApplication &&
          existingApplication._id.toString() != application._id.toString()
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Application ID already exists.',
          });
        }
        toSet.applyOnlineId = applyOnlineId;
      }

      await readminCollections.application.updateOne(
        {
          _id: application._id,
        },
        {
          $set: toSet,
        },
      );

      return application;
    }),
  uploadWebBanner: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        name: z.string(),
        data: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department, user } = ctx;
      const { groupId, applicationId, name, data } = input;
      if (!department.permissions.applications.editApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to edit applications.',
        });
      }

      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      const id = v4();
      const filePath = `workspaces/${groupId}/imgs/forms/${applicationId}/banner/${id}-${name}`;
      await uploadImage(filePath, 'image.png', data);
      const presignedUrl = await presignUrl(filePath, 604800);
      await sendReAdminInternalWebhookMessage(
        'imageUploads',
        'blue',
        'Image upload - Form Web Banner',
        `https://cdn.readmin.app/${filePath}`,
        presignedUrl,
        undefined,
        presignedUrl,
      );

      await readminCollections.application.updateOne(
        { _id: application._id },
        { $set: { 'appearance.webBannerUrl': filePath } },
      );

      return presignedUrl;
    }),
  removeWebBanner: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId } = input;
      if (!department.permissions.applications.editApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to edit applications.',
        });
      }

      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      await readminCollections.application.updateOne(
        { _id: application._id },
        { $unset: { 'appearance.webBannerUrl': '' } },
      );

      return true;
    }),
});
