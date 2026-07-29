import { z } from 'zod';
import { router } from '~/server/trpc';
import { TRPCError } from '@trpc/server';
import {
  createSessionForRobloxUser,
  createSessionFromDBUser,
} from '~/services/auth.service';
import {
  authenticatedProcedure,
  connectedProcedure,
} from '~/server/procedures';
import {
  getGroupRoles,
  getGroupThumbnail,
  getUserGroups,
} from '~/services/roblox.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { GroupRole, UserGroupResponseData } from '~/services/types/roblox.types';
import { PostHogClient } from '~/services/posthog.service';
import { RobloxOAuthAuthorizationExchange, getOAuthInfoUser } from '~/services/opencloud.roblox.service';
import { env } from '~/services/env';
import { getUserFromDiscordOAuthHandshake, OAuth2Handshake } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';

export interface UserGroupResponseType extends UserGroupResponseData {
  thumbnail: string;
}

export interface UserGroupResponseDataType extends UserGroupResponseData {
  thumbnail: string;
  roles: GroupRole[];
}

export const authRouter = router({
  getGroupById: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return;
      if (!ctx.user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Must have a verified Roblox account',
        });
      }

      const { groupId } = input;
      const groups: any = await getUserGroups(ctx.user.dbUser.robloxId);
      let group: any = ReturnNormalFailure(
        'BAD_REQUEST',
        'Could not find group',
      );
      if (groups) {
        const found: UserGroupResponseData = await groups.find(
          (a: UserGroupResponseData) => a.group.id.toString() == groupId,
        );
        if (found && found.role.rank > 240) {
          group = found;
          group.thumbnail = await getGroupThumbnail(group.group.id);
          group.roles = await getGroupRoles(group.group.id);
        }
      }
      return group as UserGroupResponseDataType;
    }),
  robloxLogin: connectedProcedure
    .input(
      z.object({
        code: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { code } = input;

      const OAuthTokenEx = await RobloxOAuthAuthorizationExchange(code);
      if (OAuthTokenEx == false) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong with Roblox',
        });
      }

      const {
        access_token,
        refresh_token
      } = OAuthTokenEx;

      const userInfo = await getOAuthInfoUser(access_token);
      if (await isUserGDPRIgnored(userInfo == false ? '' : userInfo.sub.toString())) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User is GDPR ignored',
        })
      }
      if (userInfo == false) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong with Roblox',
        });
      }

      const [token, user] = await createSessionForRobloxUser(userInfo, OAuthTokenEx);

      if (env.NEXT_PUBLIC_VERCEL_ENV == 'development') {
        if (['Founder', 'Developer', 'Tester'].includes(user.role) == false) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'User is not authorized to access the development enviorment.',
          });
        }
      }



      await PostHogClient.capture({
        distinctId: userInfo.sub.toString(),
        event: 'login'
      })

      return { token, userId: userInfo.sub.toString(), name: userInfo.name };
    }),
  discordLogin: connectedProcedure
    .input(
      z.object({
        code: z.string(),
        redirect_uri: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { code, redirect_uri } = input;

      const handshake = await OAuth2Handshake(code, redirect_uri);
      if (!handshake)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid OAuth2 handshake',
        });

      const userInfo = await getUserFromDiscordOAuthHandshake(
        handshake.access_token,
      );
      if (!userInfo)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Invalid response from Discord',
        });


      const discordId = userInfo.id.toString();
      const foundDiscordUser = await readminCollections.user.findOne({
        $or: [{ discordId }, { 'discordAccounts.id': discordId }],
      });
      if (!foundDiscordUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No ReAdmin account is linked to this Discord account. Log in with Roblox first, then link your Discord account from Settings.',
        });
      }

      if (!foundDiscordUser.accessToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ReAdmin requires all users to have logged in with Roblox at-least once. Please log in with Roblox, then link your Discord account from Settings.',
        });
      }

      const [token, user] = await createSessionFromDBUser(foundDiscordUser);

      if (env.NEXT_PUBLIC_VERCEL_ENV == 'development') {
        if (['Founder', 'Developer', 'Tester'].includes(user.role) == false) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'User is not authorized to access the development enviorment.',
          });
        }
      }



      await PostHogClient.capture({
        distinctId: foundDiscordUser.robloxId.toString(),
        event: 'login'
      })

      return { token, userId: foundDiscordUser.robloxId.toString(), name: foundDiscordUser.name };
    }),
  groups: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return;
    if (!ctx.user.dbUser.robloxId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Must have a verified Roblox account',
      });
    }
    const groups = await getUserGroups(ctx.user.dbUser.robloxId);
    return (await Promise.all(
      groups.map(async (group) => {
        return {
          ...group,
          thumbnail: await getGroupThumbnail(group.group.id),
        };
      }),
    )) as UserGroupResponseType[];
  })
});
