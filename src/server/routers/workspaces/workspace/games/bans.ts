import { Filter } from 'mongodb';
import { z } from 'zod';
import { v4 } from 'uuid';
import { workspacePremiumProcedure } from '~/server/procedures';
import { WorkspaceBans } from '~/services/NewMongoTypes';
import { sendWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { presignArrayOfPaths, uploadImage } from '~/services/CDN-service';
import {
  getProcessedUserObject,
  getProcessedUserObjectType,
  getUserInfo,
  getUserThumbnail,
  searchRobloxUsersByUsername,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import StringToObjectID from '~/utils/StringToObjectID';

export interface ExtendedBans extends WorkspaceBans {
  user?: getProcessedUserObjectType;
  disciplinarian?: getProcessedUserObjectType;
}

export const workspaceGamesBansRouter = router({
  getBans: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        search: z.string().optional(),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { search, cursor } = input;

      if (!department.permissions.games.manageBans) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to mange bans, contact your group administrator if you believe this is incorrect.',
        );
      }

      const query: Filter<WorkspaceBans> = {};
      if (search !== undefined && search !== '') {
        const findUsernames = await searchRobloxUsersByUsername(search);
        query.userId = { $in: findUsernames.map((user) => user.id.toString()) };
      }
      if (cursor !== undefined && cursor !== '') {
        query._id = {
          $gt: StringToObjectID(cursor),
        };
      }

      const bans: ExtendedBans[] = await readminCollections.workspace_bans.find({
        groupId: workspace.groupId,
        ...query,
        $or: [
          { expires: { $exists: false } },
          { expires: { $gt: new Date() } },
        ]
      }, {
        limit: 10,
        sort: { created: -1 }
      }).toArray();

      const hasNextPage = bans[bans.length - 1] ? (await readminCollections.workspace_bans.countDocuments({
        groupId: workspace.groupId,
        ...query,
        _id: {
          //@ts-expect-error more untyped things
          $gt: StringToObjectID(bans[bans.length - 1]?._id),
        }
      })) !== 0 : false;

      for (const ban of bans) {
        ban.user = await getProcessedUserObject(ban.userId);
        ban.disciplinarian = await getProcessedUserObject(ban.disciplinarianId);
        if (ban.evidence && ban.evidence.length > 0) {
          ban.evidence = await presignArrayOfPaths(ban.evidence, 604800);
        }
      }

      if (bans[bans.length - 1]) {
        //@ts-expect-error it will exit
        bans[bans.length - 1].hasNextPage = hasNextPage;
      }

      return bans;
    }),
  createBan: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        reason: z.string(),
        expires: z.date().optional(),
        files: z.array(z.tuple([z.string(), z.string()])).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { userId, reason, expires, files } = input;
      if (!department.permissions.games.manageBans) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to mange bans, contact your group administrator if you believe this is incorrect.',
        );
      }

      if (!userId || !reason || !user.dbUser.robloxId) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'Invalid request, please fill out the form.',
        );
      }

      const existingBan = await readminCollections.workspace_bans.findOne({
        groupId: workspace.groupId,
        userId,
        active: true,
      })

      if (existingBan) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'User is already banned.',
        )
      };

      const evidencePaths: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const [fileName, fileData] = file;
          const id = v4();
          const filePath = `workspaces/${workspace.groupId}/imgs/${user.dbUser.robloxId}/ban-${id}-${fileName}`;
          await uploadImage(filePath, fileName, fileData);
          evidencePaths.push(filePath);
        }
      }

      const newBan: WorkspaceBans = {
        groupId: workspace.groupId,
        userId,
        reason,
        disciplinarianId: user.dbUser.robloxId,
        active: true,
        created: new Date(),
      };
      if (evidencePaths.length > 0) {
        newBan.evidence = evidencePaths;
      }
      if (expires) {
        if (expires <= new Date()) {
          throw ReturnNormalFailure(
            'BAD_REQUEST',
            'Bans expiry can not be in the past',
          );
        }
        newBan.expires = expires;
      }

      await readminCollections.workspace_bans.insertOne(newBan);


      const foundUser = await readminCollections.running_game_players.findOne({
        groupId: workspace.groupId,
        userId: userId,
      });

      if (foundUser) {
        await readminCollections.queued_game_action.insertOne({
          internalGameId: foundUser.internalGameId,
          runningGameId: foundUser.runningGameId,
          type: 'kick',
          userId,
          message: `You were banned for ${reason}`,
          created: new Date(),
        });


        const foundLoggingMechanisms = await readminCollections.discord_logging.find({
          groupId: workspace.groupId,
          event: { $in: ['all', 'remote-admin-action'] }
        }).toArray();

        for (const loggingMechanism of foundLoggingMechanisms) {
          const url = loggingMechanism.webhookUrl;
          const userInfo = await getUserInfo(userId);
          const userThumbnail = await getUserThumbnail(userId);

          const desc = `**${userInfo?.name || userId}** has been banned from the game by ${user.roblox?.name}. Reason: ${reason}`;

          await sendWebhookMessage(url, 'blue', 'Game Action', desc, userThumbnail)
        }
      }


      return newBan;
    }),
  delete: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        banId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { banId } = input;
      if (!department.permissions.games.manageBans) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to mange bans, contact your group administrator if you believe this is incorrect.',
        );
      }

      const foundBan = await readminCollections.workspace_bans.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(banId),
      });

      if (!foundBan) {
        throw ReturnNormalFailure('NOT_FOUND', 'Ban could not be found');
      }
      await readminCollections.workspace_bans.deleteOne({
        _id: StringToObjectID(banId),
      });
    }),
});
