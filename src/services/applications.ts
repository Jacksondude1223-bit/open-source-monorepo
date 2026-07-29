import { env } from '~/services/env';
import { readminCollections } from '~/services/mongo.service';
import { addRoleDiscordUser, banDiscordUser, kickDiscordUser, sendWebhookMessage } from './discord.service';
import { getGroupInfo, getRankInGroup, getUserInfo, getUserThumbnail } from './roblox.service';
import { Application, Response, Workspace } from './NewMongoTypes';
import { ApplicationDiscordAutomation, ApplicationRobloxAutomation, ResponseApplicationQuestion } from './NewMongoTypes/Application.type';
import { ObjectId } from 'mongodb';
import StringToObjectID from '../utils/StringToObjectID';
import { canWorkspaceOrUserRank, exile, rankUser } from './group-actions.service';
import { dmUserDiscord } from '~/services/discord.service';

// Submit Application

export type AnswerType = {
  [questionId: string]: string | string[];
};

export async function submitUserApplication(
  workspace: Workspace,
  application: Application,
  robloxUserId: string,
  answers: AnswerType,
  startTime: number,
  endTime: number,
  source: 'game' | 'online' | 'discord',
) {
  const userId = robloxUserId;
  const quizModeSettings = application.autoGrading;
  const questions: ResponseApplicationQuestion[] =
    application.questions as unknown as ResponseApplicationQuestion[];
  const responseBody = answers;
  let totalQuestions = 0;
  let totalCorrect = 0;

  if (Object.keys(responseBody).length !== questions.length) {
    return { success: false, reason: 'All questions must be answered' };
  }

  const mappedAnswers: ResponseApplicationQuestion[] = questions.map((q) => {
    q.answer = responseBody[q.id] || '';
    return q;
  });

  if (!application?._id) {
    return { success: false, reason: 'something went wrong' };
  }

  const newResponse = {} as Response;
  newResponse.groupId = workspace.groupId;
  newResponse.applicationId = application._id.toString();
  newResponse.source = source;
  // Each button verb produces a distinct log line on the response timeline.
  const buttonVerbPastTense = {
    submit: 'Submitted',
    send: 'Sent',
    apply: 'Application submitted',
    request: 'Request submitted',
    complete: 'Completed',
    sign: 'Signed',
  }[application.buttonType || 'submit'];
  newResponse.comments = [
    {
      message: `${buttonVerbPastTense} by applicant`,
      userId: env.ROBLOX_USER_ID,
      created: new Date(),
    },
  ];
  newResponse.timeTakenSeconds = endTime - startTime;
  newResponse.userId = userId;
  newResponse.responseBody = mappedAnswers;
  newResponse.created = new Date();

  if (quizModeSettings.enabled) {
    for (const question of mappedAnswers) {
      const answer = quizModeSettings.questions[question.id];
      if (!answer) {
        continue;
      }
      let correct = false;
      if (question.type == 'text_response') {
        if (question.answer.toString() == '') {
          continue;
        }
        const lowercaseResponse = question.answer.toString().toLowerCase();
        const correctAnswer = answer.toString().toLowerCase().split(' ');
        correct = correctAnswer
          .map((right) => lowercaseResponse.includes(right))
          .includes(true);
      } else if (question.type == 'multiple_choice') {
        const lowercaseResponse = question.answer.toString().toLowerCase();
        if (!question.allow_multiple_selections) {
          // Applicant selects a single answer; any configured choice counts.
          const acceptedAnswers = Array.isArray(answer)
            ? answer
            : [answer];
          correct = acceptedAnswers
            .map((right) => right.toString().toLowerCase().trim())
            .includes(lowercaseResponse.trim());
        } else {
          const correctAnswer = answer
            //@ts-expect-error this will be ana rray
            .join(' ')
            .toString()
            .toLowerCase()
            .split(' ');
          correct = correctAnswer
            .map((right: string) => lowercaseResponse.includes(right))
            .includes(true);
        }
      } else if (question.type == 'scaled_response') {
        //@ts-expect-error it does exist
        const min = parseInt(answer?.min || '0');
        //@ts-expect-error it does exist
        const max = parseInt(answer?.max || '0');
        const lowercaseResponse = parseInt(question.answer.toString());
        correct = lowercaseResponse <= max && lowercaseResponse >= min;
      } else if (question.type == 'typing_speed_test') {
        const lowercaseResponse = parseInt(question.answer.toString());
        const min = parseInt(answer.toString() || '0');
        correct = lowercaseResponse >= min;
      }
      totalQuestions++;
      if (correct) {
        question.correct = true;
        totalCorrect++;
      }
      if (!correct) {
        question.correct = false;
      }
    }
    // Guard against division by zero: a quiz with no gradeable questions
    // (e.g. no correct answers configured) would otherwise produce "NaN".
    //@ts-expect-error strange, strange, strange type problems.
    newResponse.score = (totalQuestions > 0
      ? (100 / totalQuestions) * totalCorrect
      : 0
    ).toFixed(2);
  }

  // Decide pass/fail now that the score has actually been calculated above.
  // parseFloat keeps fractional percentages intact so a threshold such as 100
  // (or e.g. 79.5 vs 80) compares correctly.
  newResponse.status = quizModeSettings.enabled
    ? parseFloat(newResponse?.score?.toString() || '0') >=
      quizModeSettings.mingrade
      ? 'passed'
      : 'failed'
    : 'pending';

  if (newResponse.score !== undefined && newResponse.score !== null) {
    newResponse.comments.push({
      message: `Automatically graded application, applicant ${newResponse.status == 'passed' ? 'passed' : 'failed'
        } with a ${newResponse.score}%`,
      userId: env.ROBLOX_USER_ID,
      created: new Date(),
    });
  }


  const insertedResponse = await readminCollections.response.insertOne(newResponse);

  handleUserApplicationEvent(workspace.groupId, application._id.toString(), insertedResponse.insertedId.toString(), 'pending', newResponse.status);


  const foundLoggingMechanisms = await readminCollections.discord_logging.find({
    groupId: workspace.groupId,
    event: { $in: ['all', 'new-application'] }
  }).toArray();

  for (const loggingMechanism of foundLoggingMechanisms) {
    const url = loggingMechanism.webhookUrl;
    const userInfo = await getUserInfo(userId);
    const userThumbnail = await getUserThumbnail(userId);

    const desc = `**${userInfo?.name || userId}** has submitted an application for the group. It is ${newResponse.status}`;

    await sendWebhookMessage(url, 'blue', 'Application', desc, userThumbnail)
  }


  return {
    success: true,
    response: newResponse,
    quizModeEnabled: quizModeSettings.enabled,
  };
}

export async function canUserApplyToApplication(groupId: string, applicationId: string, userId: string) {
  if (!groupId || !applicationId || !userId) {
    return { success: false, reason: 'bad request' }
  }

  const application = await readminCollections.application.findOne({
    groupId: groupId,
    _id: StringToObjectID(applicationId)

  })


  if (!application) {
    return { success: false, reason: 'application not found' }
  }


  const permissions = application.permissions;

  if (!permissions.acceptingResponses) {
    return {
      success: true,
      canApply: false,
      reason: "Application isn't accepting responses",
    };
  }

  const PastResponse = await readminCollections.response.findOne({
    userId: userId.toString(),
    applicationId: applicationId,
  }, {
    sort: { created: -1 }
  })


  if (permissions.applyOnce && PastResponse) {
    return {
      success: true,
      canApply: false,
      reason: "You've already applied to this application",
    };
  }


  if (permissions.timeUntilApplyAgain > 0 && PastResponse) {
    const timeUntilApplyAgain = permissions.timeUntilApplyAgain;
    const created = PastResponse.created;
    const now = new Date();
    const timeSinceCreated = now.getTime() - created.getTime();
    const timeSinceCreatedInDays = timeSinceCreated / 1000 / 60 / 60 / 24;
    if (timeSinceCreatedInDays < timeUntilApplyAgain) {
      return {
        success: true,
        canApply: false,
        reason: `You can apply again in ${timeUntilApplyAgain} days`,
      };
    }
  }


  const minRank = permissions.ranking.minRank;
  const maxRank = permissions.ranking.maxRank;

  // If there is no rank restriction we don't need to query Roblox at all.
  if (minRank === 0 && maxRank === 0) {
    return {
      success: true,
      canApply: true,
    };
  }

  // Finally check ranking
  const foundUserRank = await getRankInGroup(groupId, userId);

  if (!foundUserRank) {
    return {
      success: true,
      canApply: false,
      reason: "You're not in the group",
    };
  }

  const lowRank = await readminCollections.group_role.findOne({

    groupId: application.groupId.toString(),
    rank: minRank,

  });
  const highRank = await readminCollections.group_role.findOne({

    groupId: application.groupId.toString(),
    rank: maxRank,

  });

  if (minRank !== 0 && foundUserRank?.rank < minRank) {
    return {
      success: true,
      canApply: false,
      reason: `Your rank is too low, you must be ${lowRank?.name || "unknown"
        } or above.`,
    };
  }

  if (maxRank !== 0 && foundUserRank?.rank > maxRank) {
    return {
      success: true,
      canApply: false,
      reason: `Your rank is too high, you must be ${highRank?.name || "unknown"
        } or below.`,
    };
  }

  return {
    success: true,
    canApply: true,
  };

}

export async function handleUserApplicationEvent(groupId: string, applicationId: string, responseId: string, oldStatus: string, status: string) {
  if (!groupId || !applicationId || !responseId || !status) {
    return {
      body: {
        success: false,
        reason: "Bad request",
      },
      statusCode: 400,
    };
  }

  try {
    const workspace = await readminCollections.workspace.findOne({ groupId: groupId });
    const application = await readminCollections.application.findOne(
      {
        groupId: groupId,
        _id: new ObjectId(applicationId),
      }
    );

    const foundResponse = await readminCollections.response.findOne({
      _id: StringToObjectID(responseId)
    });

    if (!foundResponse || !application || !workspace) {
      return { success: false, reason: "Bad request" };
    }
    if (!workspace.premium.is) {
      return { success: false, reason: "Workspace must be premium" };
    }


    const foundLoggingMechanisms = await readminCollections.discord_logging.find({
      groupId: workspace.groupId,
      event: { $in: ['all', 'read-application'] }
    }).toArray();

    for (const loggingMechanism of foundLoggingMechanisms) {
      if (status == 'pending') continue; // don't log pending applications
      const url = loggingMechanism.webhookUrl;
      const userInfo = await getUserInfo(foundResponse.userId);
      const userThumbnail = await getUserThumbnail(foundResponse.userId);
      const desc = `${userInfo?.name}'s application for the group has been read. It is ${status}`;
      await sendWebhookMessage(url, 'blue', 'Application Event', desc, userThumbnail)
    }

    const parsed = {
      pending: 'sent',
      received: 'sent',
      passed: 'passed',
      completed: 'passed',
      reported: 'reported',
      failed: 'failed',
      denied: 'failed',
      read: undefined,
      review: undefined,
    }[status];

    const automations = application.automations || {};
    const robloxAutomations = automations?.roblox;
    const discordAutomations = automations?.discord;

    // Roblox automations run through the workspace's Open Cloud OAuth link, not
    // the legacy cookie-bot account. Gating them on a `roblox_bots` document —
    // a collection nothing has written to since the Open Cloud migration —
    // silently disabled every Roblox automation (auto-rank on pass included) for
    // any workspace created since.
    const canPerformRobloxActions = await canWorkspaceOrUserRank('group', groupId);
    const discordBot = await readminCollections.discord_bots.findOne({ groupId }) as any;


    const groupInfo = await getGroupInfo(workspace.groupId)
    const userId = foundResponse.userId.toString();

    async function doRobloxAutomations(parsedObject: ApplicationRobloxAutomation) {
      if (parsedObject.ranking?.enabled) {
        // `rankTo` holds a rank (0-255), but accept a role id too so a value
        // saved from a role-id-based picker still resolves.
        const rankTo = parseInt((parsedObject.ranking.rankTo ?? 0).toString());
        const foundRole = rankTo
          ? await readminCollections.group_role.findOne({
            groupId,
            $or: [{ rank: rankTo }, { id: rankTo }],
          })
          : null;
        if (foundRole) {
          await rankUser('group', groupId, groupId, userId, foundRole?.id, 'application', { responseId, applicationId })
        } else {
          console.log(`[applications] Ranking automation for group ${groupId} application ${applicationId} is enabled but rankTo (${parsedObject.ranking.rankTo}) does not match a role — skipping.`);
        }
      }
      if (parsedObject.punishment.exile) {
        await exile('group', groupId, groupId, userId, 'application', { responseId, applicationId })
      }

    }
    async function doDiscordAutomations(parsedObject: ApplicationDiscordAutomation) {
      const discordId = (await readminCollections.user.findOne({ robloxId: userId}))?.discordId || null;
      const { guildId } = discordBot;
      if (parsedObject.dm.enabled) {
        await dmUserDiscord(userId, `Update regarding your application ${application?.name} at ${groupInfo?.displayName}`, parsedObject.dm.message, 'blue', undefined, { workspace, category: 'applications', variables: { groupName: groupInfo?.displayName, applicationName: application?.name } })
      }
      if (discordId !== null) {
        if (parsedObject.ranking.enabled) {
          addRoleDiscordUser(guildId, discordId as string, parsedObject.ranking.rank);
        }
        if (parsedObject.punishment.ban) {
          banDiscordUser(guildId, discordId as string)
        }
        if (parsedObject.punishment.kick) {
          kickDiscordUser(guildId, discordId as string)
        }
      }

    }

    if (robloxAutomations && parsed) {
      //@ts-expect-error shh
      const things = robloxAutomations[parsed];
      if (things?.enabled) {
        if (canPerformRobloxActions) {
          await doRobloxAutomations(things);
        } else {
          console.log(`[applications] Roblox automations for group ${groupId} are enabled but the workspace has no Open Cloud link — skipping.`);
        }
      }
    }
    if (discordAutomations && parsed) {
      //@ts-expect-error shh
      const things = discordAutomations[parsed];
      // `parsed` is undefined for statuses with no automation slot (read /
      // review); without that guard `things` is undefined and the handler throws
      // on the first property access, silently aborting the rest of the event.
      if (discordBot && things) {
        await doDiscordAutomations(things);
      }
    }

  } catch (e) {
    console.error(e);
    return {
      success: true,
      response: e?.toString(),

    };
  }
}
