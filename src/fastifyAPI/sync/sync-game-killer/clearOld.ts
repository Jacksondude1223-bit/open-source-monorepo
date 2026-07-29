import { time } from "discord.js";
import calculateMinutes from "~/services/businessLogic/calculateMinutes";
import { sendReAdminInternalWebhookMessage } from "~/services/discord.service";
import { readminCollections } from '~/services/mongo.service';
import { DateToSeconds } from "~/utils/DateUtils";

const maxNoPingMinutes = 20;

export default async function ClearBadRunningGame() {
  let timeAgo = new Date(Date.now() - (maxNoPingMinutes * 60000));


  const foundGames = await readminCollections.running_games.find(
    {
      lastPing: {
        $lt: timeAgo,
      },
    }
  ).toArray();

  await Promise.all(foundGames.map(async ({ _id, groupId, internalGameId, gameId, placeId, lastPing, created, players }) => {
    console.log(`Killing game for (${groupId}) game (${gameId}) and place (${placeId}) Last ping ${lastPing.toLocaleString()}, Now: ${new Date().toLocaleString()} - Time Delta: ${(Date.now() - lastPing.getTime()) / (1000 * 60)} minutes`)
    sendReAdminInternalWebhookMessage('gameKilling', `red`, `Killing game ${placeId}`, `Workspace: ${groupId} / Game: ${gameId} / Place ${placeId} / Running Game Id: ${_id} / Game Id: ${_id} Last ping ${lastPing.toLocaleString()}, Now: ${new Date().toLocaleString()} - Time Delta: ${(Date.now() - lastPing.getTime()) / (1000 * 60)} minutes. Players: ${players.length} Created: ${time(created, 'F')}`)
    // Delete old games
    const [pendingEndingSessions] = await Promise.all([
      readminCollections.user_game_session.find({
        runningGameId: _id,
        staff: true,
      }),
      readminCollections.user_game_session.deleteMany({
        runningGameId: _id,
        staff: false,
      }),
      readminCollections.running_games.deleteOne({
        _id: _id,
      }),
      readminCollections.running_game_players.deleteMany({
        runningGameId: _id,
      }),
      readminCollections.running_game_logs.deleteMany({
        runningGameId: _id,
      }),
      readminCollections.running_game_chats.deleteMany({
        runningGameId: _id,
      }),
      // Close any call still open on this server. Without this the ticket
      // outlives the server forever, and the caller stays blocked from opening
      // another one (see the duplicate check in the support-create handler).
      readminCollections.in_game_support_ticket.updateMany({
        runningGameId: _id,
        status: { $in: ['open', 'claimed'] },
      }, {
        $set: {
          status: 'closed',
          closed: {
            user: 'ReAdmin',
            reason: 'serverClosed',
            date: new Date(),
            serverAcknowledged: true,
          },
        },
      }),
    ]);
    const sessions = await pendingEndingSessions.toArray();
    await Promise.all(sessions.map(async session => {
      const [workspace, updatedSession] = await Promise.all([
        readminCollections.workspace.findOne({
          groupId,
        }),
        readminCollections.user_game_session.findOneAndUpdate(
          {
            userId: session.userId,
            runningGameId: _id,
            inGame: true,
          },
          {
            $set: {
              ended: DateToSeconds(new Date()),
              inGame: false,
              active: false,
              minutes: {
                total: 0,
                active: 0,
                inactive: 0,
                typing: 0,
                messages: 0,
              },
            },
          }
        ),
        readminCollections.group_member.updateMany({
          groupId: groupId as string,
          inGameId: internalGameId
        }, {
          $set: {
            inGame: false,
          },
          $unset: {
            inGameId: '',
            inRunningGameId: '',
            sessionId: '',
            playerId: '',
          }
        }),
      ]);
      if (updatedSession?._id) {
        await readminCollections.user_game_session_event.insertOne({
          userGameSession: updatedSession?._id,
          groupId: session.groupId,
          userId: session.userId,
          type: 'leave',
          date: new Date(),
          created: new Date()
        })
      }
      const worksp = await readminCollections.workspace.findOne({ groupId: workspace?.groupId });
      if (worksp && updatedSession?._id) {
        calculateMinutes(worksp, updatedSession?._id);
      }
    }))
  }))


}