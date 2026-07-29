import { RoundNumber } from '~/utils/HexToInt';
import { DateToSeconds } from '~/utils/DateUtils'
import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { getGroupInfo } from '~/services/roblox.service';
import { UserGameSessionEvent, Workspace } from '~/services/NewMongoTypes';
import { dmUserDiscord } from '~/services/discord.service';
import calculateSummaries from '~/services/businessLogic/calculateSummaries';
import calculateSessionCounts from '~/services/businessLogic/calculateSessionCounts';

export default async function calculateMinutes(workspace: Workspace, updatedSessionId: ObjectId, notifyUser = true) {
  const workspaceId = workspace.groupId;
  const groupId = workspace.groupId;

  if (!workspace) {
    return { body: { success: false, reason: "workspace not found" } };
  }
  const userSession = await readminCollections.user_game_session.findOne({
    _id: updatedSessionId
  });
  if (!userSession) {
    return { body: { success: false, reason: "workspace not found" } };
  }
  if (userSession.groupId !== parseInt(workspace.groupId)) {
    return { body: { success: false, reason: "workspace not found" } };
  }
  let events = await readminCollections.user_game_session_event.find({
    userGameSession: updatedSessionId,
  }, {
    sort: {
      date: 1
    }
  }).toArray();
  const numMessages = events.filter((event) => event.type === "message").length;
  const joinSeconds = DateToSeconds(events.find((event) => event.type === "join")?.date || userSession.started || new Date());

  const timeBasedEvents: (UserGameSessionEvent & { secondsSinceJoin: number })[] = [];
  if (events.find((event) => event.type === 'join') === undefined) {
    events = [
      {
        _id: new ObjectId(),
        userGameSession: updatedSessionId,
        groupId: parseInt(groupId),
        userId: userSession.userId,
        type: 'join',
        date: new Date(joinSeconds * 1000), // Convert seconds to milliseconds
        created: new Date(),
      },
      ...events
    ]
  }
  for (const event of events) {
    timeBasedEvents.push({
      ...event,
      //@ts-expect-error this is not a problem
      secondsSinceJoin: (event.date - joinSeconds) / 1000,
    });
  }

  let activeTime = 0;
  let idleTime = 0;
  let typingTime = 0;

  let lastEvent = timeBasedEvents[0];

  for (const event of timeBasedEvents) {
    const { type, secondsSinceJoin } = event;
    if (lastEvent && secondsSinceJoin !== undefined && lastEvent.secondsSinceJoin !== undefined) {
      const timeInSecondsSinceLastEvent = secondsSinceJoin - lastEvent.secondsSinceJoin;

      // Skip messages — they don't represent state changes
      if (type === 'message') {
        continue;
      }

      // Attribute the elapsed time to the PREVIOUS event's state.
      // "active" event means the user just BECAME active, so the time
      // before it was whatever the previous state was (idle/typing/etc).
      // "join" is treated as active (user is active when they first join).
      if (lastEvent.type === 'active' || lastEvent.type === 'join') {
        activeTime += timeInSecondsSinceLastEvent;
      } else if (lastEvent.type === 'idle') {
        idleTime += timeInSecondsSinceLastEvent;
      } else if (lastEvent.type === 'typing') {
        typingTime += timeInSecondsSinceLastEvent;
      }

      lastEvent = event;
    }
  }
  const minutes = {
    total: RoundNumber((activeTime + idleTime + typingTime) / 60, 2),
    active: RoundNumber(activeTime / 60, 2),
    inactive: RoundNumber(idleTime / 60, 2),
    typing: RoundNumber(typingTime / 60, 2),
    messages: numMessages,
  };

  await readminCollections.user_game_session.updateOne(
    {
      _id: new ObjectId(updatedSessionId)
    },
    {
      $set: {
        minutes,
        inGame: false,
        active: false,
      },
    }
  );

  // Now lets handle sessions
  await calculateSessionCounts(workspace, userSession.userId.toString(), false);

  if (notifyUser) {
    const groupInfo = await getGroupInfo(groupId);
    await dmUserDiscord(userSession.userId, `Your playing time is no longer being tracked at ${groupInfo?.displayName}!`,
      `**Here is how long you played in game:**
    \Total Minutes: ${RoundNumber(minutes.total, 2)}
    \Active Minutes: ${RoundNumber(minutes.active, 2)}
    \Idle Minutes: ${RoundNumber(minutes.inactive, 2)}
    \Typing Minutes: ${RoundNumber(minutes.typing, 2)}
    \n**This is how many messsages you sent in chat:**
    \Total Messages: ${minutes.messages}
    \nSee more information: https://panel.readmin.app/workspaces/${workspace.groupId}/personal/activity`, 'blue', `Powered by ReAdmin. This content is not endorsed by ReAdmin, LLC. To disable messaging do /opt-into-messaing false.`, { workspace, category: 'sessionSummary', variables: { groupName: groupInfo?.displayName, totalMinutes: RoundNumber(minutes.total, 2), activeMinutes: RoundNumber(minutes.active, 2), idleMinutes: RoundNumber(minutes.inactive, 2), typingMinutes: RoundNumber(minutes.typing, 2), messages: minutes.messages } });
  }
  await calculateSummaries(workspace, userSession.userId.toString(), notifyUser)

  return { success: true }

}