import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import stripeService, { findMeterOrCreate, findPriceByNameOrCreate, findSetupAssistPriceOrCreate, reAdminProductId, reAdminSubcriptionId, reAdminUsageSubcriptionId, updateStripeUser } from '~/services/stripe.service';
import { env } from '~/services/env';
import { readminCollections } from '~/services/mongo.service';
import { getGroupInfo } from '~/services/roblox.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { SUBSCRIPTIONS_CLOSED_MESSAGE } from '~/services/constants/Subscriptions';
import { isShutdownDeployment } from '~/utils/deployment';

export const workspaceSettingsBillingRouter = router({
  subscribeToWorkspacePlan: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        path: z.string(),
        setupAssist: z
          .object({
            previousTool: z.string().max(120).optional(),
            notes: z.string().max(2000).optional(),
            contactMethod: z.enum(['discord', 'email']),
            contact: z.string().min(1).max(200),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ReAdmin's hosted service is shutting down - no new subscriptions or
      // trials can be started on readmin.app. Self-hosted deployments run their
      // own Stripe account and are unaffected.
      if (isShutdownDeployment(ctx.host)) {
        throw ReturnNormalFailure('FORBIDDEN', SUBSCRIPTIONS_CLOSED_MESSAGE);
      }
      const { department, workspace, user } = ctx;
      if (!user) {
        return;
      }
      const { path, setupAssist } = input;
      if (department.permissions.admin == false) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const url = path;
      const ipAddress = '';

      const isTesting = env.STRIPE_PUBLIC.startsWith('pk_test');
      const group = await getGroupInfo(workspace.groupId);
      const dbUser = await readminCollections.user.findOne({ robloxId: user.dbUser.robloxId });
      if (dbUser) {
        await updateStripeUser(dbUser);
      }

      // Optional one-time done-for-you setup / migration add-on.
      const setupLineItems: { price: string; quantity: number }[] = [];
      let setupMetadata: Record<string, string> = {};
      if (setupAssist) {
        const setupPrice = await findSetupAssistPriceOrCreate();
        setupLineItems.push({ price: setupPrice.id, quantity: 1 });
        setupMetadata = {
          setupAssist: 'true',
          setupAssistType: setupAssist.previousTool ? 'migration' : 'setup',
          setupAssistContactMethod: setupAssist.contactMethod,
          setupAssistContact: setupAssist.contact.trim().slice(0, 200),
          ...(setupAssist.previousTool
            ? { setupAssistPreviousTool: setupAssist.previousTool }
            : {}),
          ...(setupAssist.notes ? { setupAssistNotes: setupAssist.notes } : {}),
        };
      }

      if (workspace?.promotionalRedemptions?.sevenDayTrial !== true) {

        const meter = await findMeterOrCreate(workspace);
        if (!meter) {
          throw ReturnNormalFailure('BAD_REQUEST', 'Could not find meter');
        }
        const price = await findPriceByNameOrCreate(workspace, meter.id);
        if (!price) {
          console.log('No price found for subscription');
          return;
        }
        const checkout = await stripeService.checkout.sessions.create({
          mode: 'subscription',
          line_items: [
            {
              price: reAdminSubcriptionId,
              quantity: 1,
            },
            {
              price: price.id
            },
            ...setupLineItems
          ],
          success_url: `${url}/workspaces/${workspace.groupId}/settings/billing/finish?id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${url}/workspaces/${workspace.groupId}/settings/billing`,
          client_reference_id: workspace.groupId,
          subscription_data: {
            metadata: {
              workspaceId: workspace.groupId,
              subscriberRobloxId: user.dbUser.robloxId as string,
              ip: ipAddress,
              ...setupMetadata,
            },
            trial_period_days: 7,
            trial_settings: {
              end_behavior: {
                missing_payment_method: 'cancel'
              }
            },

            // proration_behavior: 'create_prorations',
          },

          custom_text: {
            submit: {
              message: `Upgrade ${group?.displayName as string
                } Today and Experience Automation`,
            },
          },
          consent_collection: {
            terms_of_service: 'required',
          },
          // submit_type: 'pay',
          allow_promotion_codes: true,
          customer: isTesting ? user.dbUser.testStripeId : user.dbUser.stripeId,
        });
        if (!checkout.url) {
          return false;
        }

        return { success: true, url: checkout.url };


      }
      const meter = await findMeterOrCreate(workspace);
      if (!meter) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Could not find meter');
      }
      const price = await findPriceByNameOrCreate(workspace, meter.id);
      if (!price) {
        console.log('No price found for subscription');
        return;
      }
      const checkout = await stripeService.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price: reAdminSubcriptionId,
            quantity: 1,
          },
          {
            price: price.id,
            // quantity: 10000,
          },
          ...setupLineItems
        ],
        success_url: `${url}/workspaces/${workspace.groupId}/settings/billing/finish?id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${url}/workspaces/${workspace.groupId}/settings/billing`,
        client_reference_id: workspace.groupId,
        subscription_data: {
          metadata: {
            workspaceId: workspace.groupId,
            subscriberRobloxId: user.dbUser.robloxId as string,
            ip: ipAddress,
            ...setupMetadata,
          },
          // proration_behavior: 'create_prorations',
        },
        custom_text: {
          submit: {
            message: `Upgrade ${group?.displayName as string
              } Today and Experience Automation`,
          },
        },
        consent_collection: {
          terms_of_service: 'required',
        },
        // submit_type: 'pay',
        allow_promotion_codes: true,
        customer: isTesting ? user.dbUser.testStripeId : user.dbUser.stripeId,
      });
      if (!checkout.url) {
        return false;
      }

      return { success: true, url: checkout.url };
    }),
  finishWorkspaceSubscribe: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        subscriptionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, user } = ctx;
      if (!user) {
        return;
      }
      const { subscriptionId } = input;
      if (department.permissions.admin == false) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const workspace = ctx.workspace;
      const checkoutId = subscriptionId;

      const session = await stripeService.checkout.sessions.retrieve(checkoutId);
      if (!session.customer) {
        throw ReturnNormalFailure(
          'INTERNAL_SERVER_ERROR',
          'Something went wrong finding checkout',
        );
      }
      const customer = await stripeService.customers.retrieve(
        session.customer as string,
      );
      const subscription = await stripeService.subscriptions.retrieve(
        session.subscription as string,
      );
      if (subscription.metadata.workspaceId !== workspace.groupId) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Bad request');
      }
      if (['active', 'trialing'].includes(subscription.status) == false) {
        await readminCollections.workspace.updateOne({ groupId: workspace.groupId }, { $set: { premium: { is: false } } });
        return ReturnNormalFailure('BAD_REQUEST', 'Subscription is not active -- please contact support.');
      }

      const productId = subscription.items.data[0]?.plan.id as string;
      const subscriptionType = (productId == reAdminSubcriptionId || productId == reAdminUsageSubcriptionId) ? 'premium' : false;

      if (subscriptionType == false) {
        await readminCollections.workspace.updateOne({ groupId: workspace.groupId }, { $set: { premium: { is: false } } });
        throw ReturnNormalFailure('BAD_REQUEST', 'Suspicous request, please contact support.');

      }
      const meter = await findMeterOrCreate(workspace);

      await readminCollections.workspace.updateOne({ groupId: workspace.groupId }, {
        $set: {
          premium: {
            is: true,
            managedBy: {
              robloxId: user.dbUser.robloxId as string,
              customerId: customer.id,
            },
            meterId: meter?.id || '',
            planType: subscriptionType,
            subscriptionId: session.subscription as string,
          },
          ...(subscription.status == 'trialing' ? {
            promotionalRedemptions: {
              sevenDayTrial: true,
            }
          } : {})
        }
      });

      // Record a done-for-you setup / migration request so the team can action it.
      if (subscription.metadata.setupAssist === 'true') {
        const existing = await readminCollections.setup_assist_request.findOne({
          groupId: workspace.groupId,
          subscriptionId: session.subscription as string,
        });
        if (!existing) {
          const dbUserForSetup = await readminCollections.user.findOne({ robloxId: user.dbUser.robloxId });
          const linkedDiscordId =
            dbUserForSetup?.discordId ||
            dbUserForSetup?.discordAccounts?.find((account) => account.primary)?.id ||
            dbUserForSetup?.discordAccounts?.[0]?.id;
          const setupType =
            subscription.metadata.setupAssistType === 'migration'
              ? 'migration'
              : 'setup';
          const contactMethod =
            subscription.metadata.setupAssistContactMethod === 'email'
              ? 'email'
              : 'discord';
          const contact = subscription.metadata.setupAssistContact || undefined;
          const previousTool = subscription.metadata.setupAssistPreviousTool || undefined;
          const notes = subscription.metadata.setupAssistNotes || undefined;

          await readminCollections.setup_assist_request.insertOne({
            groupId: workspace.groupId,
            groupName: workspace.groupName,
            robloxId: user.dbUser.robloxId as string,
            type: setupType,
            previousTool,
            notes,
            contactMethod,
            contact,
            linkedDiscordId: linkedDiscordId || undefined,
            status: 'pending',
            subscriptionId: session.subscription as string,
            created: new Date(),
          });

          try {
            const description = [
              `**Workspace:** ${workspace.groupName || 'Unknown'} (\`${workspace.groupId}\`)`,
              `**Paid by (Roblox ID):** ${user.dbUser.robloxId}`,
              `**Request type:** ${setupType === 'migration' ? 'Migration from another tool' : 'Fresh setup'}`,
              ...(previousTool ? [`**Migrating from:** ${previousTool}`] : []),
              `**Preferred contact:** ${contactMethod === 'email' ? 'Email' : 'Discord'}`,
              `**Contact:** ${contact || 'Not provided'}`,
              ...(linkedDiscordId ? [`**Linked Discord:** <@${linkedDiscordId}> (\`${linkedDiscordId}\`)`] : []),
              ...(notes ? [`**Notes:** ${notes}`] : []),
            ].join('\n');
            await sendReAdminInternalWebhookMessage(
              'setupRequests',
              'green',
              'New done-for-you setup request ($15)',
              description,
            );
          } catch (e) {
            console.error('Failed to send setup request Discord notification', e);
          }
        }
      }

      return true;
    }),
  maangeSubscription: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        path: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const isTesting = env.STRIPE_PUBLIC.startsWith('pk_test');
      if (!user) {
        return;
      }
      const { path } = input;
      if (department.permissions.admin == false) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const customerPortal = await stripeService.billingPortal.sessions.create({
        customer: (isTesting ? user.dbUser.testStripeId : user.dbUser.stripeId) || '',
        return_url: `${path}/workspaces/${workspace.groupId}/settings/billing`,
      });
      if (!customerPortal.url) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Something went wrong');
      }
      return customerPortal.url;
    }),
});
