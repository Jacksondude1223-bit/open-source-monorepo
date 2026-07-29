import * as Roblox from '~/services/roblox.service';
import { readminCollections } from "~/services/mongo.service";
import { Workspace } from '~/services/NewMongoTypes';
import { dmUserDiscord } from '~/services/discord.service';
import { emitFlowEvent } from '~/services/flows/flowEngine.service';
import { andFilters, roleIdInFilter } from '~/services/groupMember.helpers';

// Distribution close fans out one Discord DM per member per goal. For a 26k+
// member group, firing those un-awaited would open tens of thousands of
// concurrent Discord HTTP calls at once — tripping rate limits and risking OOM.
// Process members through a small fixed worker pool so DMs are awaited and
// back-pressured. (emitFlowEvent is already internally queued/bounded.)
const DM_CONCURRENCY = Number(process.env.DISTRIBUTION_DM_CONCURRENCY) || 6;

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) continue;
      try {
        await fn(item);
      } catch (err) {
        console.error('[newDistributionMessaging] member task error', err);
      }
    }
  });
  await Promise.all(workers);
}

export default async function newDistributionMessaging(workspace: Workspace, distributionNumber: number) {
  const groupId = workspace.groupId;
  const num = distributionNumber;

  const [distribution, groupInfo] = await Promise.all([
    readminCollections.distribution.findOne({
      groupId,
      num: parseInt(num.toString()),
    }),
    Roblox.getGroupInfo(groupId),
  ]);

  if (!distribution || distribution.isCurrent == true) {
    return {
      body: { reason: "could not be found, or distribution is active" },
    };
  }

  // Pre-load who was on approved time off / inactivity during this period so
  // Flows can exempt them. Fetched once and reused for every member below.
  const windowStart = new Date(distribution.from);
  const windowEnd = distribution.to ? new Date(distribution.to) : new Date();
  const [activeInactivity, approvedTimeOff] = await Promise.all([
    readminCollections.inactivity
      .find({ groupId, starts: { $lte: windowEnd }, ends: { $gte: windowStart } })
      .toArray(),
    readminCollections.time_off_request
      .find({ groupId, status: 'approved', starts: { $lte: windowEnd }, ends: { $gte: windowStart } })
      .toArray(),
  ]);
  const inactivitySet = new Set(activeInactivity.map((a) => a.userId.toString()));
  const timeOffSet = new Set(approvedTimeOff.map((a) => a.userId.toString()));

  const goals = readminCollections.activity_requirements.find({
    groupId,
  });

  for await (const goal of goals) {
    const departments = goal.departments;
    const [users, roles] = await Promise.all([
      readminCollections.department_users.find({
        groupId,
        departmentId: {
          $in: departments,
        },
      }),
      readminCollections.department_role.find({
        groupId,
        departmentId: {
          $in: departments,
        },
      }),
    ]);
    const [usersArray, rolesArray] = await Promise.all([
      users.toArray(),
      roles.toArray(),
    ]);

    // Matches on any of the member's roles. Still one document per user, so
    // this cannot produce duplicate rows — and therefore no duplicate DMs from
    // the runWithConcurrency loop below.
    const actualGroupUsers = await readminCollections.group_member.find(andFilters(
      { groupId },
      {
        $or: [
          ...(roleIdInFilter(rolesArray.map((a) => parseInt(a.roleId.toString()))).$or ?? []),
          {
            userId: {
              $in: usersArray.map((a) => parseInt(a.userId)),
            },
          },
        ],
      },
    ));

    const groupMembers = await actualGroupUsers.toArray();

    const summaries = await (
      await readminCollections.user_game_session_distribution_summary.find({
        groupId,
        userId: { $in: groupMembers.map((a) => a.userId.toString()) },
        distribution: num.toString(),
      })
    ).toArray();

    // Index summaries by userId so the per-member lookup below is O(1) instead
    // of an O(members) array scan — that scan is O(members²) overall and is a
    // real CPU hot spot for large groups.
    const summaryMap = new Map(summaries.map((s) => [s.userId.toString(), s]));

    await runWithConcurrency(groupMembers, DM_CONCURRENCY, async (member) => {
      const uid = member.userId.toString();
      const onInactivity = inactivitySet.has(uid);
      const onTimeOff = timeOffSet.has(uid);
      const foundSummary = summaryMap.get(uid);
      if (!foundSummary) {
        emitFlowEvent({
          groupId,
          type: 'distribution.evaluated',
          subjectUserId: uid,
          refId: `dist:${num}:${goal._id.toString()}:${uid}`,
          event: {
            distribution: parseInt(num.toString()),
            goalId: goal._id.toString(),
            goalName: goal.name || goal._id.toString(),
            metAll: false,
            failedAny: true,
            minutes: { at: 0, goal: goal.minimumMinutes || 0, metGoal: (goal.minimumMinutes || 0) === 0 },
            activeMinutes: { at: 0, goal: goal.minimumActiveMinutes || 0, metGoal: (goal.minimumActiveMinutes || 0) === 0 },
            messages: { at: 0, goal: goal.minimumMessages || 0, metGoal: (goal.minimumMessages || 0) === 0 },
            sessions: { at: 0, goal: goal.minimumSessions || 0, metGoal: (goal.minimumSessions || 0) === 0 },
            onTimeOff,
            onInactivity,
          },
        });
        await dmUserDiscord(
          member.userId,
          `#${parseInt(num.toString()).toLocaleString()} Distribution summary for ${groupInfo?.displayName || groupId
          }`,
          `You had no tracked minutes for the workspace, and for the goal ${goal.name}.`,
          "red",
          undefined,
          { workspace, category: 'distributionSummary', variables: { groupName: groupInfo?.displayName || groupId, distribution: parseInt(num.toString()), goalName: goal.name || goal._id.toString() } }
        );
        return;
      }
      const foundGoalMinutes = foundSummary.goals[goal._id.toString()];
      if (!foundGoalMinutes) {
        // this should not happen, unless it did not exist
        emitFlowEvent({
          groupId,
          type: 'distribution.evaluated',
          subjectUserId: uid,
          refId: `dist:${num}:${goal._id.toString()}:${uid}`,
          event: {
            distribution: parseInt(num.toString()),
            goalId: goal._id.toString(),
            goalName: goal.name || goal._id.toString(),
            metAll: false,
            failedAny: true,
            onTimeOff,
            onInactivity,
          },
        });
        await dmUserDiscord(
          member.userId,
          `#${parseInt(num.toString()).toLocaleString()} Distribution summary for ${groupInfo?.displayName || groupId
          }`,
          `You had no tracked minutes for goal ${goal.name}`,
          "red",
          undefined,
          { workspace, category: 'distributionSummary', variables: { groupName: groupInfo?.displayName || groupId, distribution: parseInt(num.toString()), goalName: goal.name || goal._id.toString() } }
        );
        return;
      }
      const { minutes, activeMinutes, minimumMessages, minimumSessions } =
        foundGoalMinutes;
      const metAll = Boolean(
        minutes?.metGoal &&
          activeMinutes?.metGoal &&
          minimumMessages?.metGoal &&
          minimumSessions?.metGoal,
      );
      emitFlowEvent({
        groupId,
        type: 'distribution.evaluated',
        subjectUserId: uid,
        refId: `dist:${num}:${goal._id.toString()}:${uid}`,
        event: {
          distribution: parseInt(num.toString()),
          goalId: goal._id.toString(),
          goalName: goal.name || goal._id.toString(),
          metAll,
          failedAny: !metAll,
          minutes,
          activeMinutes,
          messages: minimumMessages,
          sessions: minimumSessions,
          onTimeOff,
          onInactivity,
        },
      });
      // Also fire the dedicated "goal met" trigger so flows can congratulate or
      // reward members who hit every requirement of this goal.
      if (metAll) {
        emitFlowEvent({
          groupId,
          type: 'goal.met',
          subjectUserId: uid,
          refId: `goalmet:${num}:${goal._id.toString()}:${uid}`,
          event: {
            distribution: parseInt(num.toString()),
            goalId: goal._id.toString(),
            goalName: goal.name || goal._id.toString(),
            minutes,
            activeMinutes,
            messages: minimumMessages,
            sessions: minimumSessions,
            onTimeOff,
            onInactivity,
          },
        });
      }
      await dmUserDiscord(
        member.userId,
        `Distribution goal ${goal.name || goal?._id?.toString() as string} summary for ${groupInfo?.displayName || groupId
        }`,
        `Total Minutes: ${minutes.at}/${minutes.goal} ${minutes.metGoal ? "Met Goal" : "Failed to meet Goal"
        }\n
          Active Minutes: ${activeMinutes.at}/${activeMinutes.goal} ${activeMinutes.metGoal ? "Met Goal" : "Failed to meet Goal"
        }\n
          # Messages: ${minimumMessages.at}/${minimumMessages.goal} ${minimumMessages.metGoal ? "Met Goal" : "Failed to meet Goal"
        }\n
          Sessions Attended: ${minimumSessions.at}/${minimumSessions.goal} ${minimumSessions.metGoal ? "Met Goal" : "Failed to meet Goal"
        }`,
        undefined,
        undefined,
        { workspace, category: 'distributionSummary', variables: { groupName: groupInfo?.displayName || groupId, distribution: parseInt(num.toString()), goalName: goal.name || goal._id.toString(), totalMinutes: `${minutes.at}/${minutes.goal}`, activeMinutes: `${activeMinutes.at}/${activeMinutes.goal}`, messages: `${minimumMessages.at}/${minimumMessages.goal}`, sessions: `${minimumSessions.at}/${minimumSessions.goal}` } }
      );
    });
  }



}