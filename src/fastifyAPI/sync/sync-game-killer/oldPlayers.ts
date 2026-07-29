import calculateMinutes from "~/services/businessLogic/calculateMinutes";
import { Workspace } from "~/services/NewMongoTypes";
import { readminCollections } from "~/services/mongo.service";
import { DateToSeconds } from "~/utils/DateUtils";

// Clear old sessions which are missing a running game, but for some reason weren't synced.
export default async function EndOldPlayerSessions() {

  const runningServers = await readminCollections.running_games.find({});

  const runningGameIds = await runningServers.map(a => a._id).toArray();

  const sessions = await readminCollections.user_game_session.find({
    runningGameId: { $nin: runningGameIds },
    inGame: true,
  }).toArray()

  await Promise.all(sessions.map(async session => {
    if (session.staff == true) {
      const [wworkspace, updatedSession] = await Promise.all([
        readminCollections.workspace.findOne({
          groupId: session.groupId.toString(),
        }),
        readminCollections.user_game_session.findOneAndUpdate(
          {
            _id: session._id,
          },
          {
            $set: {
              removalMethod: 'internalSyncRemoval',
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
          groupId: session.groupId.toString(),
          inGameId: session.internalGameId,
        }, {
          $set: {
            inGame: false,
          },
          $unset: {
            inGameId: '',
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
      if (updatedSession?._id) {
        calculateMinutes((await readminCollections.workspace.findOne({ groupId: wworkspace?.groupId })) as Workspace, updatedSession?._id);
      }
    } else {
      await readminCollections.user_game_session.deleteOne({
        _id: session._id
      });
    }

  }))

}