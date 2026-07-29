import { router } from '~/server/trpc';
import { workspacePremiumProcedure } from '~/server/procedures';
import { z } from 'zod';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { readminCollections } from '~/services/mongo.service';
import { DiscordLogType } from '~/services/NewMongoTypes/DiscordLogging.type';
import { getWebhookInfo, isValidDiscordWebhookURL, sendWebhookMessage } from '~/services/discord.service';
import { getGroupInfoFresh } from '~/services/roblox.service';
import { buildMilestoneMessage, DEFAULT_MILESTONE_STEP } from '~/services/memberMilestone.service';
import StringToObjectID from '~/utils/StringToObjectID';

export const workspaceSettingsDiscordLoggingRouter = router({
  get: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId } = input;

      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const foundWebhooks = await readminCollections.discord_logging.find({ groupId }).toArray();
      return foundWebhooks;
    }),
  create: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        url: z.string(),
        events: z.custom<DiscordLogType[]>()
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, url, events } = input;
      const newUrl = url.trim().split(' ').join('');
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      if (isValidDiscordWebhookURL(newUrl) == false) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'The provided URL is not a valid Discord webhook',
        );
      }

      const webhookInfo = await getWebhookInfo(newUrl);
      if (webhookInfo?.type !== 1) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'The provided URL is not a bot webhook',
        );
      }

      const creating = await readminCollections.discord_logging.insertOne({
        groupId: groupId,
        webhookUrl: newUrl,
        event: events,
        webhookInfo,
        created: new Date(),
      });
      return await readminCollections.discord_logging.findOne({ _id: creating.insertedId });

    }),
  edit: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        id: z.string(),
        url: z.string(),
        events: z.custom<DiscordLogType[]>()
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, id, url, events } = input;
      const newUrl = url.trim().split(' ').join('');
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      if (isValidDiscordWebhookURL(newUrl) == false) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'The provided URL is not a valid Discord webhook',
        );
      }

      const webhookInfo = await getWebhookInfo(newUrl);
      if (webhookInfo?.type !== 1) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'The provided URL is not a bot webhook',
        );
      }

      await readminCollections.discord_logging.updateOne({ _id: StringToObjectID(id), groupId }, {
        $set: {
          webhookUrl: newUrl,
          event: events,
          webhookInfo,
        }
      });
      return true;
    }),
  delete: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, id } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      await readminCollections.discord_logging.deleteOne({ _id: StringToObjectID(id), groupId });
      return true;
    }),

  // ----- Group member counting (milestone) feature ------------------------
  // Config is stored one-per-workspace in `group_member_milestone`. The 10-min
  // sync poller reads enabled configs and posts to the webhook when the count
  // grows. All operations require workspace admin.
  getMemberMilestone: workspacePremiumProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }
      const config = await readminCollections.group_member_milestone.findOne({ groupId });
      return config;
    }),

  saveMemberMilestone: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        enabled: z.boolean(),
        url: z.string(),
        growthEnabled: z.boolean(),
        growthTemplate: z.string().max(1500).optional(),
        milestoneEnabled: z.boolean(),
        milestoneStep: z.number().int().min(1).max(10_000_000),
        milestoneTemplate: z.string().max(1500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId, enabled, url, growthEnabled, growthTemplate, milestoneEnabled, milestoneStep, milestoneTemplate } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }

      const newUrl = url.trim().split(' ').join('');
      if (isValidDiscordWebhookURL(newUrl) == false) {
        throw ReturnNormalFailure('BAD_REQUEST', 'The provided URL is not a valid Discord webhook');
      }
      const webhookInfo = await getWebhookInfo(newUrl);
      if (webhookInfo?.type !== 1) {
        throw ReturnNormalFailure('BAD_REQUEST', 'The provided URL is not a bot webhook');
      }

      const fields = {
        enabled,
        webhookUrl: newUrl,
        webhookInfo,
        growthEnabled,
        growthTemplate: growthTemplate?.trim() ? growthTemplate : '',
        milestoneEnabled,
        milestoneStep,
        milestoneTemplate: milestoneTemplate?.trim() ? milestoneTemplate : '',
      };

      const existing = await readminCollections.group_member_milestone.findOne({ groupId });
      if (existing) {
        await readminCollections.group_member_milestone.updateOne(
          { _id: existing._id },
          { $set: fields },
        );
      } else {
        await readminCollections.group_member_milestone.insertOne({
          groupId,
          ...fields,
          created: new Date(),
        });
      }
      return await readminCollections.group_member_milestone.findOne({ groupId });
    }),

  deleteMemberMilestone: workspacePremiumProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }
      await readminCollections.group_member_milestone.deleteOne({ groupId });
      return true;
    }),

  // Sends a one-off preview of a member-count message to the configured webhook,
  // using the group's live member count so admins can see exactly how it renders.
  sendTestMemberMilestone: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        url: z.string(),
        type: z.enum(['growth', 'milestone']),
        growthTemplate: z.string().max(1500).optional(),
        milestoneTemplate: z.string().max(1500).optional(),
        milestoneStep: z.number().int().min(1).max(10_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId, url, type, growthTemplate, milestoneTemplate, milestoneStep } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }
      const newUrl = url.trim().split(' ').join('');
      if (isValidDiscordWebhookURL(newUrl) == false) {
        throw ReturnNormalFailure('BAD_REQUEST', 'The provided URL is not a valid Discord webhook');
      }

      const groupInfo = await getGroupInfoFresh(groupId);
      const currentCount = typeof groupInfo?.memberCount === 'number' ? groupInfo.memberCount : 0;
      // Pretend we last posted one step ago so the preview shows a realistic
      // "gained" value even on the first run.
      const baseline = Math.max(0, currentCount - (milestoneStep || DEFAULT_MILESTONE_STEP));
      const { title, description } = buildMilestoneMessage(
        {
          growthTemplate: growthTemplate?.trim() ? growthTemplate : '',
          milestoneTemplate: milestoneTemplate?.trim() ? milestoneTemplate : '',
          milestoneStep,
        },
        type,
        currentCount,
        baseline,
        groupInfo?.displayName,
      );

      await sendWebhookMessage(
        newUrl,
        type === 'milestone' ? 'green' : 'blue',
        title,
        description,
        undefined,
        undefined,
        undefined,
        { timestamp: new Date(), footerText: `${groupInfo?.displayName || 'Preview'} • Powered by ReAdmin` },
      );
      return true;
    }),
})