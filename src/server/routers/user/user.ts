import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  authenticatedProcedure,
  connectedProcedure,
} from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { getGroupInfo, getGroupThumbnail } from '~/services/roblox.service';
import stripeService from '~/services/stripe.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';
import { getDiscordUser, OAuth2Handshake, getUserFromDiscordOAuthHandshake, sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { env } from '~/services/env';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import type { User } from '~/services/NewMongoTypes/User.type';

type DiscordAccount = NonNullable<User['discordAccounts']>[number];

/**
 * Returns the user's linked Discord accounts. Legacy users only have a top-level
 * `discordId` (previously resolved via Bloxlink); for those we lazily migrate the
 * single id into the `discordAccounts` array so it can be managed in the UI.
 */
async function resolveDiscordAccounts(dbUser: User): Promise<DiscordAccount[]> {
  if (dbUser.discordAccounts && dbUser.discordAccounts.length > 0) {
    return dbUser.discordAccounts;
  }

  if (!dbUser.discordId) {
    return [];
  }

  const profile = await getDiscordUser(dbUser.discordId);
  const migrated: DiscordAccount = {
    id: dbUser.discordId,
    username: profile?.username ?? dbUser.name ?? 'Discord User',
    globalName: profile?.global_name ?? null,
    avatar: profile?.avatar ?? null,
    primary: true,
    linkedAt: new Date(),
  };

  await readminCollections.user.updateOne(
    { _id: dbUser._id },
    { $set: { discordAccounts: [migrated] } },
  );

  return [migrated];
}

export const userRouter = router({
  info: connectedProcedure.query(async ({ ctx }) => {
    return {
      loggedIn: ctx.user?.secureToken !== undefined,
      user: ctx.user,
    };
  }),
  logout: authenticatedProcedure.mutation(async ({ ctx }) => {
    await readminCollections.user_auth_session.deleteOne({ _id: ctx.user.secureToken });
  }),
  getStripeBillingPortal: authenticatedProcedure.input(z.object({
    path: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const user = ctx.user;
    const path = input.path;
    const isTesting = env.STRIPE_PUBLIC.startsWith('pk_test');
    if (!user.dbUser.stripeId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User does not have a Stripe account linked',
      });
    }
    try {
      const customerPortal = await stripeService.billingPortal.sessions.create({
        customer: (isTesting ? user.dbUser.testStripeId : user.dbUser.stripeId) || '',
        return_url: `${path}/dashboard/settings`,
      });
      if (!customerPortal.url) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Something went wrong');
      }
      return customerPortal.url;
    } catch (error) {
      console.error('Error creating Stripe billing portal session:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create billing portal session',
      });
    }
  }),
  getDiscordAccounts: authenticatedProcedure.query(async ({ ctx }) => {
    const accounts = await resolveDiscordAccounts(ctx.user.dbUser);
    return accounts.sort((a, b) => Number(b.primary) - Number(a.primary));
  }),
  linkDiscordAccount: authenticatedProcedure.input(z.object({
    code: z.string(),
    redirect_uri: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const { code, redirect_uri } = input;
    const dbUser = ctx.user.dbUser;

    const handshake = await OAuth2Handshake(code, redirect_uri);
    if (!handshake) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid Discord authorization. Please try linking your account again.',
      });
    }

    const discordUser = await getUserFromDiscordOAuthHandshake(handshake.access_token);
    if (!discordUser) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not read your Discord profile. Please try again.',
      });
    }

    const discordId = discordUser.id.toString();

    // Prevent linking a Discord account that already belongs to a different ReAdmin user.
    const conflictingUser = await readminCollections.user.findOne({
      robloxId: { $ne: dbUser.robloxId },
      $or: [{ discordId }, { 'discordAccounts.id': discordId }],
    });
    if (conflictingUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This Discord account is already linked to another ReAdmin user.',
      });
    }

    const existingAccounts = await resolveDiscordAccounts(dbUser);
    if (existingAccounts.some((account) => account.id === discordId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That Discord account is already linked to your profile.',
      });
    }

    const isFirstAccount = existingAccounts.length === 0;
    const newAccount: DiscordAccount = {
      id: discordId,
      username: discordUser.username,
      globalName: discordUser.global_name ?? null,
      avatar: discordUser.avatar ?? null,
      primary: isFirstAccount,
      linkedAt: new Date(),
    };

    const update: Record<string, unknown> = {
      $push: { discordAccounts: newAccount },
    };
    // Keep the legacy top-level discordId in sync with the primary account so
    // existing lookups (DMs, login, ticketing) continue to work.
    if (isFirstAccount) {
      update.$set = { discordId };
    }

    await readminCollections.user.updateOne({ _id: dbUser._id }, update);

    return { success: true, account: newAccount };
  }),
  unlinkDiscordAccount: authenticatedProcedure.input(z.object({
    discordId: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const { discordId } = input;
    const dbUser = ctx.user.dbUser;

    const accounts = await resolveDiscordAccounts(dbUser);
    const target = accounts.find((account) => account.id === discordId);
    if (!target) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That Discord account is not linked to your profile.',
      });
    }

    // If we removed the primary account, promote the next remaining one (if any).
    const promotePrimary = target.primary;
    const remaining: DiscordAccount[] = accounts
      .filter((account) => account.id !== discordId)
      .map((account, index) => ({
        ...account,
        primary: promotePrimary ? index === 0 : account.primary,
      }));

    const newPrimaryId = remaining.find((account) => account.primary)?.id;

    await readminCollections.user.updateOne(
      { _id: dbUser._id },
      {
        $set: {
          discordAccounts: remaining,
          discordId: newPrimaryId,
        },
      },
    );

    return { success: true };
  }),
  getSubscriptions: authenticatedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    const [workspaces, userSubscriptions] = await Promise.all([
      readminCollections.workspace.find({
        'premium.managedBy.robloxId': user.dbUser.robloxId,
      }).toArray(),
      stripeService.subscriptions.list({ // TO DO ONLY FETCH ACTIVE/TRIAL SUBSCRIPTIONS -- NOT CANCELLED OR OLD ONES.
        customer: user.dbUser.stripeId,
        limit: 100,
      })]);
    const updatedWorkspaces = await Promise.all(workspaces.map(async workspace => {
      const thumbnail = await getGroupThumbnail(workspace.groupId);
      return { ...workspace, thumbnail }
    }))

    return { workspaces: updatedWorkspaces, userSubscriptions: userSubscriptions.data };
  }),
  uncancelSubscriptionByworkspaceId: authenticatedProcedure.input(z.object({
    groupId: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const user = ctx.user;
    const { groupId } = input;
    const workspace = await readminCollections.workspace.findOne({
      groupId,
      'premium.managedBy.robloxId': user.dbUser.robloxId,
    });
    if (!workspace) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workspace not found or not managed by you',
      });
    }
    if (!workspace.premium.is) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workspace is not premium',
      });
    }
    await stripeService.subscriptions.update(workspace.premium.subscriptionId as string, {
      cancel_at_period_end: false,
    })
    return true;
  }),
  cancelSubscriptionByWorkspaceId: authenticatedProcedure.input(z.object({
    groupId: z.string(),
    reason: z.enum([
      'switched_to_competitor',
      'too_expensive',
      'group_inactive',
      'setup_confusing',
      'didnt_understand_value',
      'missing_feature',
      'bugs_reliability',
      'support_issue',
      'other',
    ]).optional(),
    details: z.string().max(2000).optional(),
  })).mutation(async ({ ctx, input }) => {
    const user = ctx.user;
    const { groupId, reason, details } = input;
    const workspace = await readminCollections.workspace.findOne({
      groupId,
      'premium.managedBy.robloxId': user.dbUser.robloxId,
    });
    if (!workspace) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workspace not found or not managed by you',
      });
    }
    if (!workspace.premium.is) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workspace is not premium',
      });
    }
    await stripeService.subscriptions.update(workspace.premium.subscriptionId as string, {
      cancel_at_period_end: true,
    })
    if (reason) {
      await readminCollections.cancellation_feedback.insertOne({
        groupId,
        groupName: workspace.groupName,
        robloxId: user.dbUser.robloxId,
        reason,
        details: details?.trim() || undefined,
        created: new Date(),
      });
    }
    try {
      const CANCELLATION_PING_USER_IDS = ['115147252850360325', '246773711087075339'];
      const reasonLabels: Record<string, string> = {
        switched_to_competitor: 'Switched to a competitor',
        too_expensive: 'Too expensive',
        group_inactive: 'Group inactive',
        setup_confusing: 'Setup was confusing',
        didnt_understand_value: "Didn't understand the value",
        missing_feature: 'Missing a feature',
        bugs_reliability: 'Bugs / reliability',
        support_issue: 'Support issue',
        other: 'Other',
      };
      const description = [
        `**Workspace:** ${workspace.groupName || 'Unknown'} (\`${groupId}\`)`,
        `**Cancelled by:** ${user.dbUser.robloxId}`,
        `**Reason:** ${reason ? (reasonLabels[reason] ?? reason) : 'Not provided'}`,
        `**Details:** ${details?.trim() || '—'}`,
      ].join('\n');
      await sendReAdminInternalWebhookMessage(
        'cancellations',
        'red',
        'Subscription cancellation',
        description,
        undefined,
        undefined,
        undefined,
        {
          content: CANCELLATION_PING_USER_IDS.map((id) => `<@${id}>`).join(' '),
          mentionUserIds: CANCELLATION_PING_USER_IDS,
        },
      );
    } catch (e) {
      console.error('Failed to send cancellation Discord notification', e);
    }
    return true;
  }), configureDarkMode: authenticatedProcedure.input(z.object({
    enable: z.boolean()
  })).mutation(async ({ ctx, input }) => {
    const { enable } = input;
    const user = ctx.user;
    await readminCollections.user.updateOne({ _id: user.dbUser._id }, { $set: { darkMode: enable } })
    return enable;
  }),
  setPrimaryDiscordAccount: authenticatedProcedure.input(z.object({
    discordId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { discordId } = input;
    const dbUser = ctx.user.dbUser;

    const accounts = await resolveDiscordAccounts(dbUser);
    if (!accounts.some((account) => account.id === discordId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That Discord account is not linked to your profile.',
      });
    }

    const updatedAccounts = accounts.map((account) => ({
      ...account,
      primary: account.id === discordId,
    }));

    await readminCollections.user.updateOne(
      { _id: dbUser._id },
      { $set: { discordAccounts: updatedAccounts, discordId } },
    );

    return {
      success: true,
      message: 'Primary Discord account updated successfully',
      discordId,
    };
  }),
  previousApplications: authenticatedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    const responses = await readminCollections.response.find({
      userId: user.dbUser.robloxId

    }).toArray();
    const mappedResponses = await Promise.all(responses.map(async (resp) => {
      const [application, groupInfo] = await Promise.all([
        readminCollections.application.findOne({

          _id: StringToObjectID(resp.applicationId)

        }),
        getGroupInfo(resp.groupId)
      ])

      return {
        id: resp._id,
        application: application?.name,
        group: groupInfo?.displayName,
        groupId: groupInfo?.id,
        source: resp.source,
        status: resp.status,
        score: resp.score,
        created: resp.created,
      }
    }))
    return mappedResponses;
  }),
  reactivateWarnedAccount: authenticatedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user;
    if (
      user.dbUser.isModerated !== false &&
      user.dbUser.isModerated.type == 'ban'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cant unwarn account which is banned',
      });
    }

    await readminCollections.user.updateOne({ _id: user.dbUser._id }, { $set: { isModerated: false } })

    return true;
  }),
  alerts: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().optional().nullable(),
      }),
    ).query(async ({ ctx, input }) => {
      const user = ctx.user;
      const { groupId } = input;


      const alerts = await readminCollections.site_alert.find({
        $or: [
          {
            userIds: { $in: [user.dbUser.robloxId?.toString()] }
          },
          {
            groupIds: { $in: groupId ? [groupId?.toString()] : [] }
          },
          {
            public: true
          }
        ]
      }).toArray();

      return alerts;
    }),
  updateBirthday: authenticatedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        day: z.number().min(1).max(31),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const { month, day } = input;

      // Validate day for the given month
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
      if (day > (daysInMonth[month - 1] as number)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid day for the selected month`,
        });
      }

      await readminCollections.user.updateOne(
        { _id: user.dbUser._id },
        { $set: { birthday: { month, day } } }
      );

      return { success: true, birthday: { month, day } };
    }),
  removeBirthday: authenticatedProcedure
    .mutation(async ({ ctx }) => {
      const user = ctx.user;

      await readminCollections.user.updateOne(
        { _id: user.dbUser._id },
        { $unset: { birthday: "" } }
      );

      return { success: true };
    }),
});
