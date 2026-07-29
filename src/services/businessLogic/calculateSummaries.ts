import { RoundNumber } from '~/utils/HexToInt';
import { getMonthNumber, weeksInYear, getWeekNumber, getDayKey } from '~/utils/DateUtils';
import { readminCollections } from "~/services/mongo.service";
import { dmUserDiscord } from '~/services/discord.service';
import { getGroupInfo } from "~/services/roblox.service";
import { UserGameSession, Workspace } from '~/services/NewMongoTypes';
import { ObjectId } from 'mongodb';
import { ActivitygoalNumberType, RequirementTypes } from '../NewMongoTypes/UserGameSessionDistributionSummary.type';

const EmptySummary = {
  sessions: [],
  minutes: {
    total: 0,
    active: 0,
    inactive: 0,
    typing: 0,
    messages: 0,
  },
};

export default async function calculateSummaries(workspace: Workspace, userId: string, sendDms = true) {
  const groupId = workspace.groupId;

  if (!workspace) {
    return { success: false, reason: 'bad' };
  }

  const currentDistribution = await readminCollections.distribution.findOne({
    groupId,
    isCurrent: true,
  });
  if (!currentDistribution) {
    return { success: false, reason: 'bad' };
  }

  const [userSessions, activityGoals, manualMinutes] = await Promise.all([
    readminCollections.user_game_session.find({
      userId: parseInt(userId),
      groupId: parseInt(groupId),
    }).toArray(),
    readminCollections.activity_requirements.find({
      groupId,
    }).toArray(),
    readminCollections.manual_minutes.find({ groupId, userId }).toArray()
  ]);

  const sessionDataCache: {
    [key: number]: {
      minutes: {
        total: number;
        active: number;
        inactive: number;
        typing: number;
        messages: number;
      };
      sessionsAttended: string[];
      sessions: ObjectId[];
      distributionActivityGoalProgress: {
        [requirementId: string]: {
          [requirementType in RequirementTypes]: ActivitygoalNumberType;
        };
      }
      hasManualMinutes: boolean;
    }
  } = {};
  const sessionsBrokenDownIntoYears: Record<string, UserGameSession[]> = {};

  // Process manual minutes
  for (const manual of manualMinutes) {
    const dist = manual.distribution;
    if (!sessionDataCache[dist]) {
      sessionDataCache[dist] = {
        sessionsAttended: [],
        sessions: [],
        minutes: { inactive: 0, active: 0, typing: 0, total: 0, messages: 0 },
        distributionActivityGoalProgress: {},
        hasManualMinutes: true,
      };
    }
    switch (manual.type) {
      case "active":
        sessionDataCache[dist].minutes.total += manual.minutes;
        sessionDataCache[dist].minutes.active += manual.minutes;
        break;
      case "idle":
        sessionDataCache[dist].minutes.total += manual.minutes;
        sessionDataCache[dist].minutes.inactive += manual.minutes;
        break;
      case "typing":
        sessionDataCache[dist].minutes.total += manual.minutes;
        sessionDataCache[dist].minutes.typing += manual.minutes;
        break;
      default:
        break;
    }
  }

  // Process user sessions
  for (const session of userSessions) {
    if (!session.minutes) continue;
    const yearOccurred = new Date(session.created).getFullYear().toString();
    if (!sessionsBrokenDownIntoYears[yearOccurred]) {
      sessionsBrokenDownIntoYears[yearOccurred] = [];
    }
    sessionsBrokenDownIntoYears[yearOccurred].push(session);

    const dist = session.distribution;
    if (!sessionDataCache[dist]) {
      sessionDataCache[dist] = {
        sessionsAttended: [],
        sessions: [],
        minutes: { inactive: 0, active: 0, typing: 0, total: 0, messages: 0 },
        distributionActivityGoalProgress: {},
        hasManualMinutes: false,
      };
    }

    sessionDataCache[dist].minutes.inactive += session.minutes.inactive;
    sessionDataCache[dist].minutes.active += session.minutes.active;
    sessionDataCache[dist].minutes.typing += session.minutes.typing;
    sessionDataCache[dist].minutes.total += session.minutes.total;
    sessionDataCache[dist].minutes.messages += session.minutes.messages || 0;

    sessionDataCache[dist].sessionsAttended.push(...(session.attendedSessions || []));
    sessionDataCache[dist].sessions.push(session._id);
  }

  // Compute distribution activity goal progress once per distribution
  /*
  Needs to be updated to look for sessions at specific gamed
  */
  for (const dist of Object.keys(sessionDataCache)) {
    const data = sessionDataCache[dist as unknown as number];
    if (!data) continue;
    const progress: Record<string, any> = {};
    const playSessionsForDistribution = userSessions.filter((session) => session.distribution === parseInt(dist));
    for (const activityGoal of activityGoals) {
      const ID = activityGoal._id.toString();
      if (activityGoal.gameId) {
        // we need to handle these differently
        const foundSessionsForGame = playSessionsForDistribution.filter((session) => {
          return session.gameId?.toString() == activityGoal.gameId?.toString();
        })
        const totalMinutes = foundSessionsForGame.reduce((acc, session) => acc + (session.minutes?.total || 0), 0)
        const activeMinutes = foundSessionsForGame.reduce((acc, session) => acc + (session.minutes?.active || 0), 0)
        const typingMinutes = foundSessionsForGame.reduce((acc, session) => acc + (session.minutes?.typing || 0), 0)
        const messages = foundSessionsForGame.reduce((acc, session) => acc + (session.minutes?.messages || 0), 0)
        const sessions = foundSessionsForGame.reduce((acc, session) => acc + (session.attendedSessions?.length || 0), 0)
        progress[ID] = {
          minutes: {
            at: RoundNumber(totalMinutes, 2),
            goal: activityGoal.minimumMinutes,
          },
          activeMinutes: {
            at: RoundNumber(activeMinutes + typingMinutes, 2),
            goal: activityGoal.minimumActiveMinutes,
          },
          minimumMessages: {
            at: RoundNumber(messages, 2),
            goal: activityGoal.minimumMessages,
          },
          minimumSessions: {
            at: RoundNumber(sessions, 2),
            goal: activityGoal.minimumSessions,
          },
        }
      } else {
        progress[ID] = {
          minutes: {
            at: RoundNumber(data.minutes.total, 2),
            goal: activityGoal.minimumMinutes,
          },
          activeMinutes: {
            at: RoundNumber(data.minutes.active + data.minutes.typing, 2),
            goal: activityGoal.minimumActiveMinutes,
          },
          minimumMessages: {
            at: RoundNumber(data.minutes.messages, 2),
            goal: activityGoal.minimumMessages,
          },
          minimumSessions: {
            at: RoundNumber(data.sessionsAttended.length, 2),
            goal: activityGoal.minimumSessions,
          },
        };
      }
      for (const key in progress[ID]) {
        const value = progress[ID][key];
        progress[ID][key] = {
          ...value,
          metGoal: value.goal === 0 ? true : value.at >= value.goal,
          percentage: value.goal === 0 ? 100 : (100 / value.goal) * value.at,
        };
      }
    }
    data.distributionActivityGoalProgress = progress;
  }

  // Save distribution summaries and send DMs if required
  for (const dist of Object.keys(sessionDataCache)) {
    const data = sessionDataCache[dist as unknown as number];
    if (!data) continue;
    await readminCollections.user_game_session_distribution_summary.updateOne(
      {
        groupId,
        userId: userId,
        distribution: dist,
      },
      {
        $set: {
          groupId,
          userId: userId,
          distribution: dist,
          sessions: data.sessions,
          attendedSessions: data.sessionsAttended,
          minutes: data.minutes,
          goals: data.distributionActivityGoalProgress,
          created: new Date(),
        },
      },
      { upsert: true }
    );

    if (sendDms && dist.toString() === currentDistribution.num.toString()) {
      const groupInfo = await getGroupInfo(workspace.groupId);
      await dmUserDiscord(
        userId,
        `Here is your updated distribution summary at ${groupInfo?.displayName}!`,
        `**The current distribution is:** ${currentDistribution.num.toLocaleString()}!
\nTotal Minutes: ${RoundNumber(data.minutes.total, 2)}
\nTotal Active Minutes: ${RoundNumber(data.minutes.active, 2)}
\nIdle Minutes: ${RoundNumber(data.minutes.inactive, 2)}
\nTyping Minutes: ${RoundNumber(data.minutes.typing, 2)}
\nTotal Messages: ${data.minutes.messages}
\nSee more information: https://panel.readmin.app/workspaces/${workspace.groupId}/personal/activity`,
        'blue',
        `Powered by ReAdmin. This content is not endorsed by ReAdmin, LLC. To disable messaging do /opt-into-messaing false.`,
        { workspace, category: 'distributionSummary', variables: { groupName: groupInfo?.displayName, distribution: currentDistribution.num, totalMinutes: RoundNumber(data.minutes.total, 2), activeMinutes: RoundNumber(data.minutes.active, 2), idleMinutes: RoundNumber(data.minutes.inactive, 2), typingMinutes: RoundNumber(data.minutes.typing, 2), messages: data.minutes.messages } }
      );
    }
  }

  // Generate Yearly Summary
  for (const year of Object.keys(sessionsBrokenDownIntoYears)) {
    const sessions: any[] = [];
    const minutes = {
      inactive: 0,
      active: 0,
      typing: 0,
      total: 0,
      messages: 0,
    };
    const summaries: any = { weeks: {}, months: {}, days: {} };
    let attendedSessions: any[] = [];

    // Setup summaries for weeks and months
    const weeksCount = weeksInYear(parseInt(year));
    for (let weekNumber = 0; weekNumber <= weeksCount; weekNumber++) {
      summaries.weeks[weekNumber] = JSON.parse(JSON.stringify(EmptySummary));
    }
    for (let monthNumber = 0; monthNumber <= 12; monthNumber++) {
      summaries.months[monthNumber] = JSON.parse(JSON.stringify(EmptySummary));
    }
    if (!sessionsBrokenDownIntoYears[year]) {
      continue;
    }
    for (const session of sessionsBrokenDownIntoYears[year]) {
      if (!session.minutes) {
        continue;
      }
      sessions.push(session._id);
      const weekNumber = getWeekNumber(session.created);
      const monthNumber = getMonthNumber(session.created);
      const dayKey = getDayKey(session.created);
      // Daily buckets are sparse: only create an entry for days that have sessions
      // so heatmap data stays compact within the yearly summary document.
      if (!summaries.days[dayKey]) {
        summaries.days[dayKey] = JSON.parse(JSON.stringify(EmptySummary));
      }
      attendedSessions.push(...(session.attendedSessions || []));

      // Update weekly, monthly, daily and overall minutes
      (["active", "inactive", "messages", "total", "typing"] as Array<'active' | 'inactive' | 'messages' | 'total' | 'typing'>).forEach((key) => {
        //@ts-expect-error ok
        summaries.weeks[weekNumber].minutes[key] += session.minutes[key];
        //@ts-expect-error ok
        summaries.months[monthNumber].minutes[key] += session.minutes[key];
        //@ts-expect-error ok
        summaries.days[dayKey].minutes[key] += session.minutes[key];
        //@ts-expect-error ok
        minutes[key] += session.minutes[key];
      });
    }

    await readminCollections.user_game_session_yearly_summary.updateOne(
      {
        groupId,
        userId: userId,
        year,
      },
      {
        $set: {
          groupId,
          userId: userId,
          year,
          sessions,
          minutes,
          summaries,
          attendedSessions,
          created: new Date(),
        },
      },
      { upsert: true }
    );
  }
}
