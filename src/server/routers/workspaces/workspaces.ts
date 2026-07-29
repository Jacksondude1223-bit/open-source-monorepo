import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { authenticatedProcedure } from '~/server/procedures';
import {
  getGroupInfo,
  getGroupRoles,
  getGroupThumbnail,
  getUserGroups,
} from '~/services/roblox.service';
import {
  getUserWorkspaces,
  workspaceUsingOpenCloud,
} from '~/services/workspaces.service';
import { GroupRole, UserGroupResponseData } from '~/services/types/roblox.types';
import { workspaceRouter } from './workspace';
import { PostHogClient } from '~/services/posthog.service';
import { router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';
import { ObjectId } from 'mongodb';
import { generateSecureString } from '~/services/Crypto-service.service';
import stripeService, { findMeterOrCreate, findPriceByNameOrCreate, findSetupAssistPriceOrCreate, reAdminSubcriptionId, updateStripeUser } from '~/services/stripe.service';
import { env } from '~/services/env';
import SyncMembers from '~/fastifyAPI/sync/sync-workspaces/members';
import SyncRoles from '~/fastifyAPI/sync/sync-workspaces/roles';
import { SIGNUPS_CLOSED_MESSAGE } from '~/services/constants/Subscriptions';
import { isShutdownDeployment } from '~/utils/deployment';

export const workspacesRouter = router({
  workspace: workspaceRouter,
  getUserWorkspacesEligibleForCreation: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return [];
    }
    const [groups, userWorkspaces] = await Promise.all([getUserGroups(ctx.user.dbUser.robloxId), getUserWorkspaces(ctx.user.dbUser)]);
    const workspaceList: string[] = userWorkspaces.map(group => group.groupId);
    if (!groups) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Could not find your groups',
      });
    }
    const elibibleToCreateGroups = groups
      .filter((group: UserGroupResponseData) => group.role.rank >= 240)
      .filter((group: UserGroupResponseData) => workspaceList.includes(group.group.id.toString()) == false);

    return await Promise.all(elibibleToCreateGroups.map(async group => {
      const [groupInfo, thumbnail, roles] = await Promise.all([
        getGroupInfo(group.group.id),
        getGroupThumbnail(group.group.id),
        getGroupRoles(group.group.id),
      ]);
      return {
        ...group, group: { id: group.group.id, ...groupInfo, thumbnail }, roles
      }
    }));

  }),
  // Group info for the workspace creation flow. This intentionally uses ReAdmin's
  // Open Cloud key (via getGroupInfo/getGroupRoles/getGroupThumbnail) rather than the
  // workspace's linked OAuth integration, since the workspace may not have linked
  // Roblox OAuth yet during creation. Only requires that the user is an eligible
  // owner/high-rank member of the group.
  getGroupCreationInfo: authenticatedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not logged in.',
        });
      }
      if (!ctx.user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must have a verified Roblox account.',
        });
      }
      const groups = await getUserGroups(ctx.user.dbUser.robloxId);
      const found = groups?.find(
        (g: UserGroupResponseData) => g.group.id.toString() === input.groupId,
      );
      if (!found || found.role.rank < 240) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not find group, or your role is not sufficient.',
        });
      }
      const [groupInfo, thumbnail, roles] = await Promise.all([
        getGroupInfo(input.groupId),
        getGroupThumbnail(input.groupId),
        getGroupRoles(input.groupId),
      ]);
      return {
        ...found,
        group: { id: found.group.id, ...groupInfo, thumbnail },
        roles: roles || [],
      };
    }),
  // Lightweight status poll used by the creation flow to drive its state machine:
  // whether the workspace has linked Open Cloud OAuth yet, and whether the first
  // member sync has completed.
  getWorkspaceCreationStatus: authenticatedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user || !ctx.user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must have a verified Roblox account.',
        });
      }
      const workspace = await readminCollections.workspace.findOne({ groupId: input.groupId });
      if (!workspace || workspace.owner.robloxId !== ctx.user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not find a workspace you own for this group.',
        });
      }
      const usingOpenCloud = await workspaceUsingOpenCloud(input.groupId);
      return {
        usingOpenCloud,
        finishedSetup: workspace.finishedSetup ?? false,
        groupName: workspace?.groupName ?? null,
      };
    }),
  getUsersWorkspaces: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return [];
    }
    const foundWorkspaces = await Promise.all(
      (
        await getUserWorkspaces(ctx.user.dbUser)
      ).map(async (workspace) => {
        const thumbnail = await getGroupThumbnail(workspace.groupId);
        const roles: GroupRole[] = (await readminCollections.group_role.find({ groupId: workspace.groupId }).toArray()).map(r => ({
          id: r.id,
          name: r.name,
          rank: r.rank,
          memberCount: r.memberCount
        }));
        return { ...workspace, group: { thumbnail }, roles, isVerified: workspace.isVerified };
      }),
    );
    return foundWorkspaces;
  }),
  createWorkspace: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string(),
        roleId: z.string(),
        path: z.string(),
        redeemPromotion: z.boolean(),
        // Optional one-time "done-for-you" setup / migration add-on. Only offered
        // when the user is starting the premium trial, so it rides along on the
        // subscription's first invoice (recorded later by finishWorkspaceSubscribe).
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
      // ReAdmin's hosted service is shutting down, so no new workspaces are
      // created on readmin.app. Self-hosted deployments are unaffected.
      if (isShutdownDeployment(ctx.host)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: SIGNUPS_CLOSED_MESSAGE,
        });
      }
      if (!ctx.user) {
        return {
          created: false,
          syncing: true,
        };
      }
      if (ctx.user.dbUser.robloxId == undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User must have a verified Roblox account',
        });
      }
      const { groupId, roleId, redeemPromotion, path, setupAssist } = input;
      const groups: any = await getUserGroups(ctx.user.dbUser.robloxId);
      if (!groups) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not find your groups',
        });
      }
      const found: UserGroupResponseData = await groups.find(
        (a: UserGroupResponseData) => a.group.id.toString() == groupId,
      );
      if (!found || found.role.rank < 240) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not find group, or role is not sufficent.',
        });
      }
      PostHogClient.capture({
        event: 'create-workspace',
        distinctId: ctx.user.dbUser.robloxId,
      })

      const minSyncRole = parseInt(roleId);
      const user = ctx.user;


      const existingWorkspace = await readminCollections.workspace.findOne({
        groupId
      })

      if (existingWorkspace) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Workspace already exists, if you desire to take over the workspace, please contact us on Discord.',
        });
      }

      await readminCollections.distribution.insertOne({
        groupId,
        num: 1,
        from: new Date(),
        isCurrent: true,
        created: new Date()
      });
      // Resolve the group's display name up-front via Open Cloud so the workspace
      // has a name immediately, even before the first member sync (which only runs
      // once the user links their Roblox Open Cloud OAuth integration).
      const creationGroupInfo = await getGroupInfo(groupId);
      const thumbnail = await getGroupThumbnail(groupId);
      const insertedWorkspace = await readminCollections.workspace.insertOne({
        groupId,
        minSyncRole: minSyncRole,
        ...(creationGroupInfo?.displayName ? { groupName: creationGroupInfo.displayName } : {}),
        owner: {
          reAdminId: !user.dbUser?._id ? new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaaa') : user.dbUser._id,
          robloxId: user.dbUser.robloxId || '',
        },
        currentDistribution: 1,
        loaderId: `ReAdmin_Loader_ID=${await generateSecureString(100)}`,
        premium: {
          is: false,
        },
        tags: [],
        distributionPeriod: 'manual',
        distributionDMs: false,
        promotionalRedemptions: {
          sevenDayTrial: redeemPromotion
        },
        created: new Date(),
      })

      const workspace = await readminCollections.workspace.findOne({ _id: insertedWorkspace.insertedId });
      if (workspace) {
        Promise.all([
          SyncMembers(workspace, true),
          SyncRoles(workspace)
        ]);
      }
      if (!workspace) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not find workspace',
        });
      }



      if (redeemPromotion == true) {
        const url = path;
        const ipAddress = '';

        const isTesting = env.STRIPE_PUBLIC.startsWith('pk_test');
        const group = await getGroupInfo(groupId);
        const dbUser = await readminCollections.user.findOne({ robloxId: user.dbUser.robloxId });
        if (dbUser) {
          await updateStripeUser(dbUser);
        }

        const meter = await findMeterOrCreate(workspace);
        if (!meter) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Could not find meter',
          })
        }
        const price = await findPriceByNameOrCreate(workspace, meter.id);
        if (!price) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No price found for subscription',
          });
        }

        // Optional one-time done-for-you setup / migration add-on, billed on the
        // first invoice. The request itself is recorded later by
        // finishWorkspaceSubscribe, which reads the subscription metadata below.
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

        const checkout = await stripeService.checkout.sessions.create({
          mode: 'subscription',
          billing_address_collection: 'required',
          line_items: [
            {
              price: reAdminSubcriptionId,
              quantity: 1,
            },
            {
              price: price.id,
            },
            ...setupLineItems
          ],
          success_url: `${url}/workspaces/create?resume_finish_creating=${groupId}&checkout_session={CHECKOUT_SESSION_ID}`,
          cancel_url: `${url}/workspaces/create?resume_finish_creating=${groupId}&checkout_abandoned=true`,
          client_reference_id: groupId,
          subscription_data: {
            metadata: {
              workspaceId: groupId,
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
          return {
            created: true,
            syncing: true,
          };
        }

        return {
          created: true,
          syncing: true,
          url: checkout.url
        };
      }


      return {
        created: true,
        syncing: true,
      };
    }),
  // workspaceCreationFinished: 
});
