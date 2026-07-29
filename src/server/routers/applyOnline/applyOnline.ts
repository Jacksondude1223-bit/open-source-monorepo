import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { authenticatedProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import {
  AnswerType,
  canUserApplyToApplication,
  submitUserApplication,
} from '~/services/applications';
import { readminCollections } from '~/services/mongo.service';
import { presignUrl } from '~/services/CDN-service';

export const applyOnlineRouter = router({
  getCenterById: authenticatedProcedure
    .input(
      z.object({
        applyOnlineId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.roblox?.id;
      if (input.applyOnlineId == '') {
        throw new TRPCError({
          message: 'Invalid applyOnlineId',
          code: 'BAD_REQUEST',
        });
      }
      const foundApplication = await readminCollections.application.findOne({
        applyOnlineId: input.applyOnlineId,

      });
      if (!foundApplication) {
        throw new TRPCError({
          message: 'Application not found',
          code: 'NOT_FOUND',
        });
      }

      const canApply = await canUserApplyToApplication(foundApplication.groupId, foundApplication._id.toString(), userId?.toString() || '0')

      const workspace = await readminCollections.workspace.findOne({
        groupId: foundApplication.groupId,
      });

      const now = Date.now();
      const responseWindow = foundApplication.responseWindow;
      let windowClosed = false;
      if (responseWindow?.enabled) {
        if (responseWindow.start && now < new Date(responseWindow.start).getTime()) {
          windowClosed = true;
        }
        if (responseWindow.end && now > new Date(responseWindow.end).getTime()) {
          windowClosed = true;
        }
      }
      const webChannelDisabled = foundApplication.responseChannels?.web === false;

      // Web banners are stored as private CDN object keys. Resolve them to a
      // temporary signed URL so the public apply page can render the image.
      // Legacy full URLs (http/https) are passed through untouched.
      let appearance = foundApplication.appearance || null;
      if (appearance?.webBannerUrl) {
        const banner = appearance.webBannerUrl.trim();
        appearance = {
          ...appearance,
          webBannerUrl: /^https?:\/\//i.test(banner)
            ? banner
            : await presignUrl(banner, 604800),
        };
      }

      return {
        name: foundApplication.name,
        description: foundApplication.description,
        questions: foundApplication.questions,
        created: foundApplication.created,
        canApply: canApply,
        buttonType: foundApplication.buttonType || 'submit',
        appearance: appearance,
        links: foundApplication.links || null,
        permissions: foundApplication.permissions,
        responseWindow: responseWindow || null,
        responseChannels: foundApplication.responseChannels || null,
        windowClosed,
        webChannelDisabled,
        workspace: workspace
          ? {
              groupId: workspace.groupId,
              groupName: workspace?.groupName || null,
              logoImage: workspace.logoImage || null,
              bannerImage: workspace.bannerImage || null,
              brandColor: workspace.brandColor || null,
              discordInvite: null,
            }
          : null,
      };
    }),
  submitApplication: authenticatedProcedure
    .input(
      z.object({
        applyOnlineId: z.string(),
        applicationBody: z.any(),
        startTime: z.number(),
        endTime: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.roblox?.id?.toString() || '0';
      const applicationBody = input.applicationBody as AnswerType;
      if (input.applyOnlineId == '') {
        throw new TRPCError({
          message: 'Invalid applyOnlineId',
          code: 'BAD_REQUEST',
        });
      }
      const foundApplication = await readminCollections.application.findOne({
        applyOnlineId: input.applyOnlineId,

      });
      if (!foundApplication) {
        throw new TRPCError({
          message: 'Application not found',
          code: 'NOT_FOUND',
        });
      }
      const canApply = await canUserApplyToApplication(foundApplication.groupId, foundApplication._id.toString(), userId)

      if (!canApply.canApply) {
        throw new TRPCError({
          message: `You are not able to apply for this application ${canApply.reason}`,
          code: 'UNAUTHORIZED',
        });
      }

      const workspace = await readminCollections.workspace.findOne({
        groupId: foundApplication.groupId,
      });

      if (!workspace) {
        throw new TRPCError({
          message: `Could not find affiliated workspace for this application`,
          code: 'UNAUTHORIZED',
        });
      }

      const resp = await submitUserApplication(
        workspace,
        foundApplication,
        userId,
        applicationBody,
        input.startTime,
        input.endTime,
        'online',
      );

      if (resp.success == true) {
        return resp;
      } else {
        throw new TRPCError({
          message: resp.reason,
          code: 'BAD_REQUEST',
        });
      }
    }),
});
