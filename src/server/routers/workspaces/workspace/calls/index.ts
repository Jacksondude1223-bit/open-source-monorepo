import { WithId } from "mongodb";
import { v4 } from "uuid";
import { z } from "zod";
import { workspaceProcedure } from "~/server/procedures";
import { readminCollections } from "~/services/mongo.service";
import { Game, InGameSupportTicket, RunningGames } from "~/services/NewMongoTypes";
import { getProcessedUserObject, getProcessedUserObjectType, getUserInfo, getUserThumbnail } from "~/services/roblox.service";
import { router } from "~/server/trpc";
import { UserInfo } from "~/services/types/roblox.types";
import { ReturnNormalFailure } from "~/utils/NormalResponseTypes";
import StringToObjectID from "~/utils/StringToObjectID";
import { createCallDiscordChannel, handleCallDiscordClose, mirrorCallMessageToDiscord } from "~/services/callDiscord.service";

function requireCallPerm(department: { permissions: any }, perm: 'view' | 'manage' | 'deleteBans') {
  if (department.permissions.admin) return;
  const calls = department.permissions.calls;
  if (perm === 'view' && !calls?.view && !calls?.manage) {
    throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to view calls.');
  }
  if (perm === 'manage' && !calls?.manage) {
    throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to manage calls.');
  }
  if (perm === 'deleteBans' && !calls?.deleteBans) {
    throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to remove call bans.');
  }
}

export const workspaceCallsRouter = router({
  getOngoingSummary: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      const { workspace, department } = ctx;
      requireCallPerm(department, 'view');

      const tickets = await readminCollections.in_game_support_ticket.find({
        groupId: workspace.groupId,
        status: { $in: ['open', 'claimed'] }
      }).sort({ created: -1 }).limit(25).toArray();

      const summary = await Promise.all(tickets.map(async (ticket) => {
        const [callerInfo, thumbnail, gameInfo] = await Promise.all([
          getUserInfo(ticket.callerId).catch(() => null),
          getUserThumbnail(ticket.callerId).catch(() => undefined),
          readminCollections.game.findOne({
            groupId: workspace.groupId,
            placeId: ticket.placeId,
          }).catch(() => null),
        ]);
        return {
          _id: ticket._id.toString(),
          status: ticket.status,
          type: ticket.type,
          reason: ticket.reason,
          reportedUser: ticket.reportedUser,
          gameId: ticket.gameId,
          placeId: ticket.placeId,
          gameName: gameInfo?.name || null,
          runningGameId: ticket.runningGameId ? ticket.runningGameId.toString() : null,
          created: ticket.created,
          callerId: ticket.callerId,
          callerName: callerInfo?.name || `User ${ticket.callerId}`,
          callerThumbnail: thumbnail,
        };
      }));

      return {
        open: summary.filter(t => t.status === 'open').length,
        claimed: summary.filter(t => t.status === 'claimed').length,
        total: summary.length,
        calls: summary,
      };
    }),
  getUserCalls: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      requireCallPerm(department, 'view');

      const callerId = parseInt(input.userId);
      if (isNaN(callerId)) {
        return [];
      }

      const tickets = await readminCollections.in_game_support_ticket.find({
        groupId: workspace.groupId,
        callerId,
      }).sort({ created: -1 }).limit(50).toArray();

      return await Promise.all(tickets.map(async (ticket) => {
        const serverInfo = ticket.runningGameId
          ? await readminCollections.running_games.findOne({ _id: ticket.runningGameId })
          : null;

        const gameInfo = serverInfo
          ? await readminCollections.game.findOne({
              groupId: workspace.groupId,
              gameId: serverInfo.gameId,
              placeId: serverInfo.placeId,
            })
          : await readminCollections.game.findOne({
              groupId: workspace.groupId,
              gameId: ticket.gameId,
            });

        const claimedByInfo = ticket.claimedBy
          ? await getProcessedUserObject(ticket.claimedBy).catch(() => null)
          : null;

        return {
          _id: ticket._id.toString(),
          status: ticket.status,
          type: ticket.type,
          reason: ticket.reason,
          reportedUser: ticket.reportedUser,
          gameId: ticket.gameId,
          placeId: ticket.placeId,
          gameName: gameInfo?.name || null,
          runningGameId: ticket.runningGameId ? ticket.runningGameId.toString() : null,
          messageCount: ticket.messages?.length || 0,
          claimedByName: claimedByInfo?.name || null,
          closed: ticket.closed,
          created: ticket.created,
        };
      }));
    }),
  getAllTickets: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        status: z.enum(['open', 'claimed', 'closed', 'all']).optional().default('all'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      requireCallPerm(department, 'view');

      const statusFilter = input.status === 'all'
        ? {}
        : { status: input.status };

      const tickets = await readminCollections.in_game_support_ticket.find({
        groupId: workspace.groupId,
        ...statusFilter
      }).sort({ created: -1 }).toArray();

      return await Promise.all(tickets.map(async (ticket: WithId<InGameSupportTicket> & { claimedByInfo?: getProcessedUserObjectType; serverInfo?: RunningGames | null; gameInfo?: Game | null; callerInfo?: UserInfo & { thumbnail: string | undefined; } | any; }) => {
        const serverInfo = await readminCollections.running_games.findOne({
          _id: ticket.runningGameId
        });

        const gameInfo = serverInfo ? await readminCollections.game.findOne({
          groupId: workspace.groupId,
          gameId: serverInfo.gameId,
          placeId: serverInfo.placeId,
        }) : null;

        ticket.callerInfo = { ...(await getUserInfo(ticket.callerId)), thumbnail: await getUserThumbnail(ticket.callerId) };
        ticket.serverInfo = serverInfo;
        ticket.gameInfo = gameInfo;

        if (ticket.claimedBy) {
          const claimedBy = await getProcessedUserObject(ticket.claimedBy);
          ticket.claimedByInfo = claimedBy;
        }
        return ticket;
      }))
    }),
  getOngoingTickets: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),

      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      requireCallPerm(department, 'view');
      const ongoingTickets = await readminCollections.in_game_support_ticket.find({
        groupId: workspace.groupId,
        status: {
          $in: ['open', 'claimed']
        }
      }).toArray();

      return await Promise.all(ongoingTickets.map(async (ticket: WithId<InGameSupportTicket> & { claimedByInfo?: getProcessedUserObjectType; serverInfo?: RunningGames | null; gameInfo?: Game | null; callerInfo?: UserInfo & { thumbnail: string | undefined; } | any; }) => {
        const serverInfo = await readminCollections.running_games.findOne({
          _id: ticket.runningGameId
        });
        if (!serverInfo) {
          throw ReturnNormalFailure('BAD_REQUEST', 'This call does not have a server');
        }
        const gameInfo = await readminCollections.game.findOne({
          groupId: workspace.groupId,
          gameId: serverInfo.gameId,
          placeId: serverInfo.placeId,
        });
        if (!gameInfo) {
          throw ReturnNormalFailure('BAD_REQUEST', 'This call does not have a game');
        }

        ticket.callerInfo = { ...(await getUserInfo(ticket.callerId)), thumbnail: await getUserThumbnail(ticket.callerId) };
        ticket.serverInfo = serverInfo;
        ticket.gameInfo = gameInfo;

        if (ticket.status == 'claimed' && ticket.claimedBy) {
          const claimedBy = await getProcessedUserObject(ticket.claimedBy);
          ticket.claimedByInfo = claimedBy;
        }
        return ticket;
      }))
    }),
  // Start a live chat with a player who is currently in-game without them having
  // to open a call first. The ticket is created already claimed by the agent and
  // is picked up by that player's game server on its next sync (see sendData's
  // ongoingChats + init.luau), which opens the chat window on their screen.
  startCall: workspaceProcedure.input(z.object({
    groupId: z.string(),
    userId: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const { workspace, department, user } = ctx;
    requireCallPerm(department, 'manage');

    const callerId = parseInt(input.userId);
    if (isNaN(callerId)) {
      throw ReturnNormalFailure('BAD_REQUEST', 'Invalid user');
    }

    const member = await readminCollections.group_member.findOne({
      groupId: workspace.groupId,
      userId: callerId,
    });
    if (!member?.inGame || !member.inRunningGameId) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This user is not currently in a tracked game.');
    }

    const runningGame = await readminCollections.running_games.findOne({
      _id: member.inRunningGameId,
      groupId: workspace.groupId,
    });
    if (!runningGame) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This user is not currently in a tracked game.');
    }

    const existing = await readminCollections.in_game_support_ticket.findOne({
      groupId: workspace.groupId,
      callerId,
      status: { $in: ['open', 'claimed'] },
    });
    if (existing) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This user already has an active call.');
    }

    const inserted = await readminCollections.in_game_support_ticket.insertOne({
      groupId: workspace.groupId,
      gameId: runningGame.gameId,
      placeId: runningGame.placeId,
      runningGameId: runningGame._id,
      type: 'support',
      status: 'claimed',
      claimedBy: parseInt(user.dbUser.robloxId),
      callerId,
      reportedUser: '',
      reason: `Chat started by ${user.dbUser.name || 'an agent'}`,
      messages: [{
        username: user.dbUser.name || '',
        userId: parseInt(user.dbUser.robloxId),
        message: `${user.dbUser.name || 'An agent'} started this chat`,
        id: v4(),
        origin: 'systemMessage',
        sentFrom: 'website',
        created: new Date(),
      }],
      closed: false,
      created: new Date(),
    });

    // Bridge into Discord if configured. Fire-and-forget so a Discord failure
    // never blocks the chat from reaching the player.
    createCallDiscordChannel(inserted.insertedId).catch(() => { });

    return { callId: inserted.insertedId.toString() };
  }),
  claimCall: workspaceProcedure.input(z.object({
    groupId: z.string(),
    callId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { workspace, department, user } = ctx;
    requireCallPerm(department, 'manage');
    const call = await readminCollections.in_game_support_ticket.findOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId,
      status: 'open'
    });
    if (!call) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This call does not exist');
    }
    if (call.status == 'claimed' && !department.permissions.admin) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This call is already claimed');
    }
    await readminCollections.in_game_support_ticket.updateOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId,
      status: 'open'
    }, {
      $set: {
        status: 'claimed',
        claimedBy: parseInt(user.dbUser.robloxId)
      },
      $push: {
        messages: {
          username: user.dbUser.name || '',
          userId: parseInt(user.dbUser.robloxId),
          message: `${user.dbUser.name} claimed this call`,
          id: v4(),
          origin: 'systemMessage',
          sentFrom: 'website',
          created: new Date()
        }
      }
    });
    mirrorCallMessageToDiscord(call.discordChannelId, {
      username: '',
      message: `${user.dbUser.name} claimed this call`,
      kind: 'system',
    }).catch(() => { });
    return true;
  }),
  releaseCall: workspaceProcedure.input(z.object({
    groupId: z.string(),
    callId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { workspace, department, user } = ctx;
    requireCallPerm(department, 'manage');
    const call = await readminCollections.in_game_support_ticket.findOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId,
      status: 'claimed'
    });
    if (!call) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This call does not exist');
    }
    await readminCollections.in_game_support_ticket.updateOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId,
      status: 'claimed'
    }, {
      $set: {
        status: 'open',
      },
      $unset: {
        claimedBy: ''
      },
      $push: {
        messages: {
          username: user.dbUser.name || '',
          userId: parseInt(user.dbUser.robloxId),
          message: `${user.dbUser.name} released this call`,
          id: v4(),
          origin: 'systemMessage',
          sentFrom: 'website',
          created: new Date()
        }
      }
    });
    return true;
  }),
  closeCall: workspaceProcedure.input(z.object({
    groupId: z.string(),
    callId: z.string(),
    reason: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { workspace, department, user } = ctx;
    requireCallPerm(department, 'manage');
    const call = await readminCollections.in_game_support_ticket.findOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId,
      status: 'claimed'
    });
    if (!call) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This call does not exist');
    }
    await readminCollections.in_game_support_ticket.updateOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId,
      status: 'claimed'
    }, {
      $set: {
        status: 'closed',
        closed: {
          user: user.dbUser.name || '',
          reason: input.reason,
          date: new Date(),
          serverAcknowledged: false
        }
      },
      $push: {
        messages: {
          username: user.dbUser.name || '',
          userId: parseInt(user.dbUser.robloxId),
          message: `${user.dbUser.name} closed this call`,
          id: v4(),
          origin: 'systemMessage',
          sentFrom: 'website',
          created: new Date()
        }
      }
    });
    // Tear down / archive the Discord call channel per workspace settings.
    handleCallDiscordClose(call).catch(() => { });
    return true;
  }),
  sendMessage: workspaceProcedure.input(z.object({
    groupId: z.string(),
    callId: z.string(),
    message: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { workspace, department, user } = ctx;
    requireCallPerm(department, 'manage');
    const call = await readminCollections.in_game_support_ticket.findOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId
    });
    if (!call) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This call does not exist');
    }
    await readminCollections.in_game_support_ticket.updateOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId
    }, {
      $push: {
        messages: {
          username: user.dbUser.name || '',
          userId: parseInt(user.dbUser.robloxId),
          message: input.message,
          id: v4(),
          origin: 'agent',
          sentFrom: 'website',
          created: new Date()
        }
      }
    });
    // Mirror the website agent's reply into the Discord call channel.
    mirrorCallMessageToDiscord(call.discordChannelId, {
      username: user.dbUser.name || 'Agent',
      message: input.message,
      kind: 'agent',
    }).catch(() => { });
    return true;
  }),
  getCallById: workspaceProcedure.input(z.object({
    groupId: z.string(),
    callId: z.string()
  })).query(async ({ ctx, input }) => {
    const { workspace, department } = ctx;
    requireCallPerm(department, 'view');
    const call = await readminCollections.in_game_support_ticket.findOne({
      _id: StringToObjectID(input.callId),
      groupId: workspace.groupId
    });
    if (!call) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This call does not exist');
    }
    const [callerInfo, serverInfo, gameInfo] = await Promise.all([
      getProcessedUserObject(call.callerId),
      readminCollections.running_games.findOne({
        _id: call.runningGameId
      }),
      readminCollections.game.findOne({
        groupId: workspace.groupId,
        gameId: call.gameId,
        placeId: call.placeId,
      })
    ]);

    const cachedUserInfo: { [id: number]: getProcessedUserObjectType } = {};

    call.messages = await Promise.all(call.messages.map(async (message) => {
      const userInfo = cachedUserInfo[message.userId] || await getProcessedUserObject(message.userId);
      cachedUserInfo[message.userId] = userInfo;
      return { ...message, userInfo }
    }))

    return { call, gameInfo, serverInfo, callerInfo };
  }),
  // Ban a user from creating in-game support calls / reports. A reason is
  // required, and the ban can be linked to a previous call so moderators can
  // review what was said before the ban was issued.
  banUser: workspaceProcedure.input(z.object({
    groupId: z.string(),
    userId: z.string(),
    reason: z.string().trim().min(1, 'A reason is required'),
    linkedCallId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { workspace, department, user } = ctx;
    requireCallPerm(department, 'manage');

    const userId = parseInt(input.userId);
    if (isNaN(userId)) {
      throw ReturnNormalFailure('BAD_REQUEST', 'Invalid user');
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw ReturnNormalFailure('BAD_REQUEST', 'A reason is required to ban a user from calls.');
    }

    const existing = await readminCollections.in_game_call_ban.findOne({
      groupId: workspace.groupId,
      userId,
    });
    if (existing) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This user is already banned from calls.');
    }

    // Validate the linked call belongs to this workspace (and ideally this user)
    // so the stored reference is always meaningful.
    let linkedCallId: ReturnType<typeof StringToObjectID> | undefined;
    if (input.linkedCallId) {
      const linkedCall = await readminCollections.in_game_support_ticket.findOne({
        _id: StringToObjectID(input.linkedCallId),
        groupId: workspace.groupId,
      });
      if (!linkedCall) {
        throw ReturnNormalFailure('BAD_REQUEST', 'The linked call does not exist.');
      }
      linkedCallId = linkedCall._id;
    }

    const inserted = await readminCollections.in_game_call_ban.insertOne({
      groupId: workspace.groupId,
      userId,
      reason,
      linkedCallId,
      bannedBy: parseInt(user.dbUser.robloxId),
      bannedByName: user.dbUser.name || '',
      created: new Date(),
    });

    return { banId: inserted.insertedId.toString() };
  }),
  getBans: workspaceProcedure.input(z.object({
    groupId: z.string(),
  })).query(async ({ ctx }) => {
    const { workspace, department } = ctx;
    requireCallPerm(department, 'view');

    const bans = await readminCollections.in_game_call_ban.find({
      groupId: workspace.groupId,
    }).sort({ created: -1 }).toArray();

    return await Promise.all(bans.map(async (ban) => {
      const [userInfo, thumbnail] = await Promise.all([
        getUserInfo(ban.userId).catch(() => null),
        getUserThumbnail(ban.userId).catch(() => undefined),
      ]);
      return {
        _id: ban._id.toString(),
        userId: ban.userId,
        userName: userInfo?.name || `User ${ban.userId}`,
        userThumbnail: thumbnail,
        reason: ban.reason,
        linkedCallId: ban.linkedCallId ? ban.linkedCallId.toString() : null,
        bannedBy: ban.bannedBy,
        bannedByName: ban.bannedByName,
        created: ban.created,
      };
    }));
  }),
  isUserBanned: workspaceProcedure.input(z.object({
    groupId: z.string(),
    userId: z.string(),
  })).query(async ({ ctx, input }) => {
    const { workspace, department } = ctx;
    requireCallPerm(department, 'view');

    const userId = parseInt(input.userId);
    if (isNaN(userId)) {
      return null;
    }

    const ban = await readminCollections.in_game_call_ban.findOne({
      groupId: workspace.groupId,
      userId,
    });
    if (!ban) {
      return null;
    }
    return {
      _id: ban._id.toString(),
      reason: ban.reason,
      linkedCallId: ban.linkedCallId ? ban.linkedCallId.toString() : null,
      bannedByName: ban.bannedByName,
      created: ban.created,
    };
  }),
  deleteBan: workspaceProcedure.input(z.object({
    groupId: z.string(),
    banId: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const { workspace, department } = ctx;
    requireCallPerm(department, 'deleteBans');

    const result = await readminCollections.in_game_call_ban.deleteOne({
      _id: StringToObjectID(input.banId),
      groupId: workspace.groupId,
    });
    if (result.deletedCount === 0) {
      throw ReturnNormalFailure('BAD_REQUEST', 'This ban does not exist.');
    }
    return true;
  }),
})