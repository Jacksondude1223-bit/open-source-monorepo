import { TRPCError } from '@trpc/server';
import { APIGuild, APIGuildChannel } from 'discord-api-types/v10';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { encrypt } from '~/services/Crypto-service.service';
import { DiscordBots, GroupRole, RobloxBots } from '~/services/NewMongoTypes';
import {
  OAuth2Handshake,
  getGuild,
  getGuildChannels,
  leaveGuild,
} from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { RobloxOAuthAuthorizationExchange, getOAuthInfoUser } from '~/services/opencloud.roblox.service';
import {
  getGroupInfo,
  getGroupRoles,
  getUserInfoByUsername,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { SyncWorkspace } from '~/fastifyAPI/sync/sync-workspaces';

export type GetLinkagesType = {
  roblox: RobloxBots | undefined;
  discord: DiscordBots | undefined;
  guild: APIGuild | undefined;
  channels: APIGuildChannel<any>[] | undefined;
  groupRoles: GroupRole[]
}

export const workspaceSettingsIntegrationsRouter = router({
  get_linkages: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      const { workspace } = ctx;
      const groupId = workspace.groupId;
      const discord = await readminCollections.discord_bots.findOne({ groupId });
      let guild: APIGuild = {} as APIGuild;
      let channels: APIGuildChannel<any>[] = [];
      if (discord) {
        guild = await getGuild(discord.guildId);
        channels = await getGuildChannels(discord.guildId);
      }
      const roblox = await readminCollections.roblox_bots.findOne({ groupId });
      const groupRoles = await getGroupRoles(groupId);
      return {
        roblox,
        discord,
        guild,
        channels,
        groupRoles,
      };
    }),
  update_inactivity_role: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        roleId: z.string(),
      }),
    ).mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, roleId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      if (roleId === 'disabled') {
        await readminCollections.workspace.updateOne(
          { groupId },
          {
            $unset: {
              inactivityRole: '',
            },
          },
        );
        return {};
      }

      await readminCollections.workspace.updateOne(
        { groupId },
        {
          $set: {
            inactivityRole: roleId,
          },
        },
      );
      return {};
    }),
  update_call_discord_settings: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        enabled: z.boolean(),
        categoryId: z.string().optional(),
        accessRoleIds: z.array(z.string()).optional(),
        closeAction: z.enum(['delete', 'move']).optional(),
        archiveCategoryId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, enabled, categoryId, accessRoleIds, closeAction, archiveCategoryId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const bot = await readminCollections.discord_bots.findOne({ groupId });
      if (!bot) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'You must link a Discord guild before configuring call channels',
        );
      }

      if (!enabled) {
        await readminCollections.workspace.updateOne(
          { groupId },
          { $unset: { callDiscordSettings: '' } },
        );
        return {};
      }

      if (!categoryId) {
        throw ReturnNormalFailure('BAD_REQUEST', 'A category is required to enable call channels');
      }
      if (!accessRoleIds || accessRoleIds.length === 0) {
        throw ReturnNormalFailure('BAD_REQUEST', 'At least one access role is required');
      }
      if (closeAction === 'move' && !archiveCategoryId) {
        throw ReturnNormalFailure('BAD_REQUEST', 'An archive category is required when moving channels on close');
      }

      await readminCollections.workspace.updateOne(
        { groupId },
        {
          $set: {
            callDiscordSettings: {
              categoryId,
              accessRoleIds,
              closeAction: closeAction || 'delete',
              ...(closeAction === 'move' && archiveCategoryId ? { archiveCategoryId } : {}),
            },
          },
        },
      );
      return {};
    }),
  discord_link: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        guild_id: z.string(),
        code: z.string(),
        redirect_uri: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, guild_id, code, redirect_uri } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const discord = await readminCollections.discord_bots.findOne({ groupId });
      if (discord) {
        await leaveGuild(discord.guildId);
        await readminCollections.discord_bots.deleteOne({ _id: discord._id });
      }

      const handshake = await OAuth2Handshake(code, redirect_uri);
      if (!handshake) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid code',
        });
      }

      const newBot = {
        groupId,
        guildId: guild_id,
        token: handshake.access_token,
        created: new Date(),
      }

      await readminCollections.discord_bots.insertOne(newBot);

      return {};
    }),
  unlink_discord: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const discord = await readminCollections.discord_bots.findOne({ groupId });
      if (!discord) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'There is no bot in this workspace',
        });
      }
      await leaveGuild(discord.guildId);
      await readminCollections.discord_bots.deleteOne({ _id: discord._id })

      return {};
    }),
  get_roblox_oauth: workspaceProcedure.input(z.object({
    groupId: z.string()
  })).query(async ({ ctx, input }) => {
    const { department } = ctx;
    const { groupId } = input;
    if (!department.permissions.admin) {
      throw ReturnNormalFailure(
        'UNAUTHORIZED',
        'You must be a workspace admin to do this operation',
      );
    }

    const found = await readminCollections.group_oauth_authorization.findOne({
      groupId
    })

    if (!found) {
      return false
    }

    const [groupMember, groupRoles] = await Promise.all([
      readminCollections.group_member.findOne({ groupId, userId: parseInt(found.sub.toString()) }),
      readminCollections.group_role.find({ groupId, rank: { $ne: 0 } }, { sort: { rank: 1 } }).toArray()
    ])

    return {
      sub: found.sub,
      name: found.name,
      nickname: found.nickname,
      preferred_username: found.preferred_username,
      created_at: found.created_at,
      profile: found.profile,
      picture: found.picture,
      created: found.created,
      lastUsed: found.lastUsed,
      scope: found.scope,
      maxRank: groupMember?.rankId || 0,
      groupRoles: groupRoles,
      rankableRoles: groupRoles.filter(a => a.rank < (groupMember?.rankId || 0))
    }
  }),
  roblox_oauth: workspaceProcedure.input(z.object({
    code: z.string(),
    groupId: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const { department, workspace, user } = ctx;
    const { code } = input;
    if (!department.permissions.admin) {
      throw ReturnNormalFailure(
        'UNAUTHORIZED',
        'You must be a workspace admin to do this operation',
      );
    }

    const alreadyExisting = await readminCollections.group_oauth_authorization.findOne({
      groupId: workspace.groupId

    })

    const exchange = await RobloxOAuthAuthorizationExchange(code);

    if (exchange == false) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong with Roblox',
      });
    }

    const {
      access_token,
      refresh_token,
      scope
    } = exchange;

    // console.log(access_token)

    const userInfo = await getOAuthInfoUser(access_token);
    if (userInfo == false) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong with Roblox',
      });
    }

    if (alreadyExisting) {
      await readminCollections.group_oauth_authorization.deleteOne({ _id: alreadyExisting._id })
    }

    await readminCollections.group_oauth_authorization.insertOne({
      groupId: workspace.groupId,
      refreshToken: encrypt(refresh_token),
      currentAccessToken: encrypt(access_token),
      accessTokenUpdatedAt: new Date(),
      scope: scope,
      lastUsed: new Date(),
      sub: userInfo.sub,
      name: userInfo.name,
      nickname: userInfo.nickname,
      preferred_username: userInfo.preferred_username,
      created_at: userInfo.created_at,
      profile: userInfo.profile,
      picture: userInfo.picture,
      created: new Date(),
    })

    // If this is the first time the workspace links Open Cloud, kick off a
    // workspace sync so their Roblox data (members, roles, etc.) is populated
    // right away instead of waiting for the next scheduled sync tick.
    if (!alreadyExisting) {
      SyncWorkspace(workspace).catch((err) => {
        console.error(`First-time Open Cloud link sync failed for ${workspace.groupId}`, err);
      });
    }

    return {};
  })
});
