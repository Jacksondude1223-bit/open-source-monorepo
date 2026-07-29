import { z } from 'zod';
import { on } from 'events';
import { workspaceRunningGameProcedure } from '~/server/procedures';
import { RunningGamePlayers } from '~/services/NewMongoTypes';
import { sendWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import {
  getUserInfo,
  getUserThumbnail,
  processObjectsWithUserIdToUserData,
  processObjectsWithUserIdToUserDataResponse,
} from '~/services/roblox.service';
import { searchChatMessages } from '~/services/opensearch.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import StringToObjectID from '~/utils/StringToObjectID';

export type RunningGamePlayerWithInfo = RunningGamePlayers &
  processObjectsWithUserIdToUserDataResponse;

export const workspaceGamesGameRunningRouter = router({
  getRunningServer: workspaceRunningGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, running } = ctx;
      if (!user) return;
      const { } = input;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }
      const players = await readminCollections.running_game_players.find({
        runningGameId: running._id,
      }).toArray();

      return {
        server: running,
        players,
      };
    }),
  getPlayers: workspaceRunningGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, running } = ctx;
      if (!user) return;
      const { } = input;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }

      const players = await processObjectsWithUserIdToUserData(
        await readminCollections.running_game_players.find({
          runningGameId: running._id,
        }).toArray(),
      );

      return players;
    }),
  getLogs: workspaceRunningGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, running } = ctx;
      if (!user) return;
      const { cursor } = input;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }
      const added: any = cursor
        ? {
          _id: { $lt: StringToObjectID(cursor) },
        }
        : {};

      const logs = await readminCollections.running_game_logs.find({
        runningGameId: running._id,
        ...added,
      }, { sort: { created: -1 }, limit: 50 });
      return logs;
    }),
  getChats: workspaceRunningGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, running } = ctx;
      if (!user) return;
      const { cursor } = input;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }

      const added: any = cursor ? {
        _id: { $lt: StringToObjectID(cursor) },
      } : {};

      const chats = await readminCollections.running_game_chats.find({
        runningGameId: running._id,
        ...added,
      }, { sort: { created: -1 }, limit: 50 }).toArray();

      return await processObjectsWithUserIdToUserData(
        chats.map((chat) => {
          return {
            _id: chat._id,
            message: chat.message,
            userId: chat.userId,
            date: chat.created,
          };
        }),
      );
    }),
  searchChats: workspaceRunningGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
        query: z.string().optional(),
        // How far back to search, in minutes. Defaults to the last hour. Pass a
        // larger value (or 0 for "all history") to widen the window.
        windowMinutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, running } = ctx;
      if (!user) return [];
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }
      const { query, windowMinutes } = input;
      const window = windowMinutes ?? 60; // default: last hour
      const sinceMs = window === 0 ? undefined : Date.now() - window * 60 * 1000;

      const hits = await searchChatMessages(query || '', {
        runningGameId: running._id.toString(),
        sinceMs,
        size: 100,
      });

      return await processObjectsWithUserIdToUserData(
        hits.map((hit) => ({
          _id: StringToObjectID(hit.id),
          message: hit.message,
          userId: hit.userId,
          date: new Date(hit.createdAt),
        })),
      );
    }),
  onNewChat: workspaceRunningGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
      }),
    )
    .subscription(async function* ({ ctx, signal }) {
      const { user, running } = ctx;
      if (!user) return;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }

      // Tail new chat inserts for this running server via a MongoDB change
      // stream so the panel updates live without polling. The change stream
      // works across API pods because the event originates from Mongo itself.
      const stream = readminCollections.running_game_chats.watch(
        [
          {
            $match: {
              operationType: 'insert',
              'fullDocument.runningGameId': running._id,
            },
          },
        ],
        { fullDocument: 'whenAvailable' },
      );

      signal?.addEventListener('abort', () => {
        stream.close().catch(() => { });
      });

      try {
        for await (const [change] of on(stream, 'change', { signal })) {
          const doc = change?.fullDocument;
          if (!doc) continue;
          const [enriched] = await processObjectsWithUserIdToUserData([
            {
              _id: doc._id,
              message: doc.message,
              userId: doc.userId,
              date: doc.created,
            },
          ]);
          if (enriched) yield enriched;
        }
      } finally {
        await stream.close().catch(() => { });
      }
    }),
  createGameAction: workspaceRunningGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        serverId: z.string(),
        type: z.enum(['kick', 'notify', 'shutdown']),
        userId: z.string(),
        message: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user, running } = ctx;
      if (!user) return;
      if (!ctx.department.permissions.games.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }
      const { groupId, type, userId, message } = input;
      if (!['kick', 'notify', 'shutdown'].includes(type)) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Incorrect request body');
      }
      if ((type == 'kick' || type == 'notify') && !userId) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'This request requies a userId',
        );
      }
      if (!message) {
        throw ReturnNormalFailure('BAD_REQUEST', 'You must provide a message');
      }
      if (userId) {
        const foundUser = await readminCollections.running_game_players.findOne({
          runningGameId: running._id,
          userId: userId,
        });
        if (!foundUser) {
          throw ReturnNormalFailure('BAD_REQUEST', 'User is not in the game');
        }
      }

      await readminCollections.queued_game_action.insertOne({
        internalGameId: running.internalGameId,
        runningGameId: running._id,
        type,
        userId,
        message,
        created: new Date(),
      });


      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: groupId,
        event: { $in: ['all', 'remote-admin-action'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(userId);
        const userThumbnail = await getUserThumbnail(userId);

        const desc = `**${userInfo?.name || userId}** has been ${type} from the game by ${user.roblox?.name}. Reason: ${message}`;

        await sendWebhookMessage(url, 'blue', 'Game Action', desc, userThumbnail)
      }

      return { success: true };
    }),
});
