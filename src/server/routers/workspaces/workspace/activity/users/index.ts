import { router } from '~/server/trpc';
import { workspaceActivityUsersActivityRouter } from './activity';
import { workspaceActivityUsersNotesRouter } from './notes';
import { workspaceActivityUsersWriteUpsRouter } from './writeUps';
import { workspaceActivityUsersDetailsRouter } from './details';
import { workspaceProcedure } from '~/server/procedures';
import { z } from 'zod';
import {
  getUserInfo,
  getUserThumbnail,
} from '~/services/roblox.service';
import { getDepartmentForGroupMember } from '~/services/workspaces.service';
import { readminCollections } from '~/services/mongo.service';
import { Game, RunningGames, UserGameSession, UserGameSessionEvent } from '~/services/NewMongoTypes';

export const workspaceActivityUsersRouter = router({
  getUserBaseInfo: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace } = ctx;
      const { groupId, userId } = input;
      const user = await readminCollections.group_member.findOne({
        groupId: groupId,
        userId: parseInt(userId),
      });
      const role = await readminCollections.group_role.findOne({
        groupId,
        rank: parseInt(user?.rankId.toString() || '0') || 0,
      });

      const [
        thumbnail,
        robloxInfo,
        department,
        currentInactivity,
        readminUser,
        lastSession,
        playerInGame
      ] = await Promise.all([
        getUserThumbnail(userId),
        getUserInfo(userId),
        //@ts-expect-error ignore
        getDepartmentForGroupMember(user, workspace),
        readminCollections.inactivity.findOne({ groupId, userId, active: true }),
        readminCollections.user.findOne({ robloxId: userId }, { projection: { discordId: 1, lastLogin: 1, created: 1 } }),
        readminCollections.user_game_session.findOne(user?.lastSessionId ? { _id: user.lastSessionId } : { groupId: parseInt(groupId), userId: parseInt(userId) }, { sort: { created: -1 } }),
        user?.lastSessionId ? await readminCollections.running_game_players.findOne({
          _id: user?.playerId
        }) : null
      ]);

      let gameSession: {
        session: (UserGameSession) | null;
        events: UserGameSessionEvent[] | null;
        runningGame: RunningGames | null;
        game: Game | null;
      } = { session: null, runningGame: null, events: null, game: null };

      if (user?.inGame) {
        const runningGame = await await readminCollections.running_games.findOne({
          _id: user.inRunningGameId, // soon to move to runningGameId
          groupId,
        });
        const [session, game] = await Promise.all([
          readminCollections.user_game_session.findOne({
            _id: user.sessionId
          }),
          readminCollections.game.findOne({
            gameId: runningGame?.gameId,
            groupId,
          })
        ]);
        const events = await readminCollections.user_game_session_event.find({
          userGameSession: session?._id,
        }, { sort: { date: 1 } }).toArray();
        gameSession = {
          session,
          events,
          runningGame,
          game,
        };
      }

      return {
        ...user,
        role,
        thumbnail,
        robloxInfo,
        department,
        currentInactivity,
        readminUser,
        playerInGame,
        gameSession,
        lastSession
      };
    }),
  getRankHistory: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { groupId, userId } = input;

      const [logs, roles] = await Promise.all([
        readminCollections.group_audit_log
          .find({ groupId, userId: userId.toString() }, { sort: { date: -1 } })
          .toArray(),
        readminCollections.group_role.find({ groupId }).toArray(),
      ]);

      const roleNameById = new Map<number, string>();
      for (const role of roles) {
        roleNameById.set(role.id, role.name);
      }

      return logs.map((log) => ({
        _id: log._id?.toString() ?? '',
        action: log.action,
        date: log.date,
        newRole: log.newRole,
        newRank: log.newRank,
        oldRole: log.oldRole,
        oldRank: log.oldRank,
        newRoleName: roleNameById.get(log.newRole) ?? null,
        oldRoleName: roleNameById.get(log.oldRole) ?? null,
      }));
    }),
  activity: workspaceActivityUsersActivityRouter,
  notes: workspaceActivityUsersNotesRouter,
  writeUps: workspaceActivityUsersWriteUpsRouter,
  details: workspaceActivityUsersDetailsRouter,
});
