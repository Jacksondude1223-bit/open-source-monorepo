import { z } from 'zod';
import { workspaceGameProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { workspaceGamesGameRunningRouter } from './running';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { RunningGamePlayers, RunningGames, UserGameSession } from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';
import { ObjectId } from 'mongodb';

//@ts-expect-error
export interface ExtendedRunningGames extends RunningGames {
  _id: string;
  staff: UserGameSession[];
  players: RunningGamePlayers[];
}

export const workspaceGamesGameRouter = router({
  running: workspaceGamesGameRunningRouter,
  getGameInfo: workspaceGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, game } = ctx;
      if (!user) return;
      const { } = input;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }
      return game;
    }),
  getRunningGames: workspaceGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user, game } = ctx;
      if (!user) return;
      const { } = input;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }

      const running = await readminCollections.running_games.find({
        groupId: workspace.groupId,
        gameId: game.gameId,
        placeId: game.placeId,
      }).toArray();
      const processed = await Promise.all(running.map(async (game) => {
        const [staff, players] = await Promise.all([
          readminCollections.user_game_session.find({
            runningGameId: game._id,
            inGame: true,
            staff: true,
          }).toArray(),
          readminCollections.running_game_players.find({
            runningGameId: game._id,
          }).toArray()
        ]);
        return { ...game, staff, players, _id: game._id.toString() };
      })) as unknown as ExtendedRunningGames[];

      return processed as ExtendedRunningGames[];
    }),
  getPlayers: workspaceGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user, game } = ctx;
      if (!user) return;
      const { } = input;
      if (!ctx.department.permissions.games.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to view games',
        );
      }
      const running = await readminCollections.running_games.find({
        groupId: workspace.groupId,
        gameId: game.gameId,
        placeId: game.placeId,
      }).toArray();
      const players = await readminCollections.running_game_players.find({
        runningGameId: { $in: running ? running.map((runningGame) => runningGame._id) : [] },
      }).toArray();
      return players;
    }),
  updateGameSettings: workspaceGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
        viewable: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user, game } = ctx;
      if (!user) return;
      const { } = input;
      if (!ctx.department.permissions.games.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to manage games',
        );
      }
      await readminCollections.game.updateOne({
        _id: game._id
      }, {
        $set: {
          viewable: input.viewable,
        }
      })
      return game;
    }),
  deleteGame: workspaceGameProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, user, game } = ctx;
      if (!user) return;
      const { } = input;
      if (!ctx.department.permissions.games.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You are not permitted to manage games',
        );
      }

      // Only allow removing games with no active servers/players and that
      // haven't been seen running in the last 30 days. Tracking data is kept;
      // we simply mark the game as hidden from dashboards.
      const activeServers = await readminCollections.running_games.countDocuments({
        groupId: workspace.groupId,
        gameId: game.gameId,
        placeId: game.placeId,
      });
      if (activeServers > 0) {
        throw ReturnNormalFailure(
          'PRECONDITION_FAILED',
          'This game still has active servers. Wait until they shut down before removing it.',
        );
      }

      const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
      if (game.lastSeen && game.lastSeen > thirtyDaysAgo) {
        throw ReturnNormalFailure(
          'PRECONDITION_FAILED',
          'This game has run within the last 30 days and cannot be removed yet.',
        );
      }

      await readminCollections.game.updateOne({
        _id: game._id
      }, {
        $set: {
          hideFromDashboard: true,
          viewable: false,
        }
      });
      return { success: true };
    }),
});
