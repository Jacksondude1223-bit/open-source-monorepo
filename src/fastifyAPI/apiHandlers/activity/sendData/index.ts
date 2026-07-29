import calculateMinutes from '~/services/businessLogic/calculateMinutes';
import { readminCollections } from '~/services/mongo.service';
import { DateToSeconds, UTCSecondsToDate } from '~/utils/DateUtils';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { playerSessionIds } from '../playerJoin';
import { SessionEvents } from '~/services/NewMongoTypes/UserGameSession.type';
import { InGameEvents } from '~/services/NewMongoTypes/InGameSupportTicket.type';
import { ObjectId } from 'mongodb';
import StringToObjectID from '~/utils/StringToObjectID';
import playerLeaveHandler from '../../internal/events-handler/messageTypes/playerLeave';
import { FastifyRequest, FastifyReply } from 'fastify';
import { getAllGDPRIgnoredUsers } from '~/utils/isUserGDPRIgnored';
import { indexChatMessage } from '~/services/opensearch.service';
import { mirrorCallMessageToDiscord } from '~/services/callDiscord.service';
import { processSyncOrders } from '~/services/orders/orders.service';
import { syncOrdersBlockSchema, SyncOrdersBlock } from '~/services/orders/schemas';
import { canonicalUserKey, legacyNumericUserId, resolveGlobalUserId } from '~/services/userIdentity.service';
import { shouldRetainSession } from '~/services/trackingConsent.service';
import { deleteSessionData } from '~/services/activityTracking.service';

export type username = string;
export const sendData = async (req: FastifyRequest<{
    Headers: { ['loader-id']: string;['roblox-id']: string; };
    Body: {
        events: SessionEvents[];
        chatEvents?: InGameEvents[];
        // Roster of players currently on the server, keyed by canonical
        // userKey (updated modules) or stringified UserId (older modules) —
        // identical values until domain-scoped IDs roll out.
        players?: { [userKey: string]: username };
        gameId: string;
        // Orders v2 rides the sync tick. Only present when a server has a
        // mounted/staffed POS device, so idle servers add nothing to the payload.
        orders?: SyncOrdersBlock;
    };
}>, res: FastifyReply) => {
    const body = req.body;
    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;
    const { events, chatEvents, players } = body;
    const internalGameId = runningGame.internalGameId;
    const allIgnoredUsers = await getAllGDPRIgnoredUsers();

    try {

        if (!events) {
            return res.status(400).send({ success: false, error: 'Missing required paramater' })
        }

        if (chatEvents) {
            for (const message of chatEvents) {
                if (message.userId && allIgnoredUsers.includes(message.userId.toString())) {
                    continue; // Skip processing for GDPR ignored users
                }
                const updatedTicket = await readminCollections.in_game_support_ticket.findOneAndUpdate({
                    _id: new ObjectId(message.ticketId),
                    groupId
                }, {
                    $push: {
                        messages: {
                            userId: message.userId,
                            username: message.username,
                            message: message.message,
                            id: message.id,
                            origin: 'user',
                            sentFrom: 'game',
                            created: UTCSecondsToDate(message.created)
                        }
                    }
                })

                // Mirror the in-game user's message into the Discord call channel
                // so agents watching Discord see the conversation live.
                if (updatedTicket?.discordChannelId) {
                    mirrorCallMessageToDiscord(updatedTicket.discordChannelId, {
                        username: message.username,
                        message: message.message,
                        kind: 'user',
                    }).catch(() => { });
                }
            }
        }

        let promises = [];

        for (const data of events) {
            if ('user' in data) {
                if (data.user && allIgnoredUsers.includes(data.user.toString())) {
                    continue; // Skip processing for GDPR ignored users
                }
                if (data.userKey && allIgnoredUsers.includes(data.userKey)) {
                    continue; // Skip processing for GDPR ignored users
                }
            }
            try {
                const modifiedData = data as SessionEvents & { sessionIds: playerSessionIds };
                const eventDate = data.date;
                if (data.type == 'message') {
                    data.message = data.encoded == true ? Buffer.from(data.message, 'base64').toString('utf-8') : data.message
                }
                if ("user" in data && data.user) {
                    const eventUserKey = canonicalUserKey(data.userKey ?? data.user);
                    const events = await readminCollections.user_game_session_event.find({
                        userGameSession: StringToObjectID(modifiedData.sessionIds.userGameSession),
                    }).toArray();
                    promises.push(readminCollections.user_game_session.updateOne({
                        _id: StringToObjectID(modifiedData.sessionIds.userGameSession),
                        runningGameId: runningGame._id
                    }, {
                        $set: {
                            active: ["idle"].includes(data.type) ? false : true,
                        },
                    }));

                    // check if message is a duplicate event by timestamp in events array, and ensure that its not already in the database (e.g the player leaves before sync send events)
                    const isDuplicate = events.some(
                        e => e.type === data.type
                            && e.date.getTime() === (data.datetime ? new Date(data.datetime).getTime() : UTCSecondsToDate(eventDate as number).getTime())
                    );
                    if (isDuplicate) {
                        continue; // Skip this event if it's a duplicate
                    }

                    // Only allow one join event per session — skip if one already exists
                    if (data.type === 'join' && events.some(e => e.type === 'join')) {
                        continue;
                    }

                    if (data.type == "message") {
                        const chatCreatedAt = data.datetime ? new Date(data.datetime) : UTCSecondsToDate(eventDate as number);
                        const chatUserId = data.user.toString();
                        const chatMessage = data.message;
                        const chatTo = data.to;
                        promises.push(
                            readminCollections.running_game_chats.insertOne({
                                internalGameId,
                                runningGameId: runningGame._id,
                                message: data.message,
                                to: data.to,
                                userId: data.user.toString(),
                                userKey: eventUserKey,
                                created: chatCreatedAt,
                            }).then((inserted) => {
                                // Mirror into OpenSearch for fast full-text + time-window chat search.
                                // Fire-and-forget — a search index miss must never fail ingestion.
                                indexChatMessage({
                                    id: inserted.insertedId.toString(),
                                    runningGameId: runningGame._id.toString(),
                                    internalGameId,
                                    groupId,
                                    placeId: runningGame.placeId,
                                    userId: chatUserId,
                                    username: players?.[eventUserKey] ?? players?.[chatUserId],
                                    message: chatMessage,
                                    to: chatTo,
                                    createdAt: chatCreatedAt.getTime(),
                                }).catch(() => { });
                            })
                        )
                        promises.push(readminCollections.user_game_session_event.insertOne({
                            userGameSession: StringToObjectID(modifiedData.sessionIds.userGameSession),
                            groupId: parseInt(groupId),
                            userId: legacyNumericUserId(eventUserKey),
                            userKey: eventUserKey,
                            type: 'message',
                            message: data.message,
                            to: data.to,
                            date: data.datetime ? new Date(data.datetime) : UTCSecondsToDate(eventDate as number),
                            created: new Date()
                        }))
                    } else {
                        promises.push(readminCollections.user_game_session_event.insertOne({
                            userGameSession: StringToObjectID(modifiedData.sessionIds.userGameSession),
                            groupId: parseInt(groupId),
                            userId: legacyNumericUserId(eventUserKey),
                            userKey: eventUserKey,
                            type: data.type,
                            date: data.datetime ? new Date(data.datetime) : UTCSecondsToDate(eventDate as number),
                            created: new Date()
                        }))
                    }
                } else {
                    if (data.type == "log") {
                        const { short, message } = data;
                        await readminCollections.running_game_logs.insertOne({
                            internalGameId,
                            message,
                            runningGameId: runningGame._id,
                            logType: short,
                            created: UTCSecondsToDate(eventDate as number),
                        })
                    }
                }
            } catch (e) {
                console.error('Error processing event', e)
                sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Event Processing Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
            }
        }
        await Promise.all(promises);

        try {
            if (players) {
                const playerIds = Object.keys(players).map(userId => userId.toString());
                // A tracked player is still in game if the roster carries either
                // their userKey or their legacy userId (older records have no
                // userKey; older modules send a UserId-keyed roster).
                const playersNotInGameAnymore = await readminCollections.running_game_players.find({
                    runningGameId: runningGame._id,
                    userId: { $nin: playerIds },
                    $or: [
                        { userKey: { $exists: false } },
                        { userKey: { $nin: playerIds } },
                    ],
                }).toArray();

                await Promise.all(playersNotInGameAnymore.map(async runningGamePlayerOfUserWhoIsntInGameAnymore => {
                    const userId = runningGamePlayerOfUserWhoIsntInGameAnymore.userId;
                    const userKey = runningGamePlayerOfUserWhoIsntInGameAnymore.userKey ?? userId;
                    if (allIgnoredUsers.includes(userId.toString()) || allIgnoredUsers.includes(userKey)) {
                        return; // Skip processing for GDPR ignored users
                    }
                    const globalUserId = await resolveGlobalUserId(userKey);

                    await Promise.all([ // Remove the player data
                        readminCollections.running_games.updateOne(
                            {
                                _id: runningGame._id,
                            },
                            {
                                $pull: {
                                    players: { $in: [...new Set([userId, userKey])] },
                                },
                            }
                        ),
                        globalUserId !== null
                            ? readminCollections.group_member.updateOne(
                                {
                                    groupId,
                                    userId: globalUserId,
                                },
                                {
                                    $set: {
                                        inGame: false,
                                    },
                                    $unset: {
                                        inGameId: '',
                                        sessionId: '',
                                        playerId: '',
                                    }
                                }
                            )
                            : Promise.resolve(null),
                    ]);


                    await readminCollections.running_game_players.deleteMany({
                        _id: runningGamePlayerOfUserWhoIsntInGameAnymore._id,
                    });

                    if (!runningGamePlayerOfUserWhoIsntInGameAnymore?.isStaff) {
                        await readminCollections.user_game_session.deleteOne({
                            _id: runningGamePlayerOfUserWhoIsntInGameAnymore.userSessionId
                        });
                    } else {

                        const userGameSession = await readminCollections.user_game_session.findOne({
                            _id: runningGamePlayerOfUserWhoIsntInGameAnymore.userSessionId
                        });
                        if (userGameSession) {
                            if (!(await shouldRetainSession(workspace, userKey))) {
                                // Privacy mode: never consented → delete this visit
                                // rather than finalizing it (re-prompted next visit).
                                await deleteSessionData(workspace, runningGame, userGameSession, null);
                            } else {
                                const now = new Date();

                                // Insert a leave event so calculateMinutes can attribute
                                // the time from the last tracked event to the end of session
                                await readminCollections.user_game_session_event.insertOne({
                                    userGameSession: userGameSession._id,
                                    groupId: userGameSession.groupId,
                                    userId: userGameSession.userId,
                                    userKey: userGameSession.userKey ?? userKey,
                                    type: 'leave',
                                    date: now,
                                    created: now,
                                });

                                await readminCollections.user_game_session.updateOne({
                                    _id: userGameSession._id,
                                }, {
                                    $set: {
                                        ended: DateToSeconds(now),
                                        inGame: false,
                                        active: false,
                                        removalMethod: 'syncRemoval',
                                    }
                                }
                                );
                                try {
                                    await calculateMinutes(workspace, userGameSession._id);
                                } catch (e) {
                                    console.error('syncRemoval: calculateMinutes failed for session', userGameSession._id, e);
                                }
                            }
                        }

                        try {
                            await playerLeaveHandler({
                                groupId,
                                userId,
                                internalGameId: runningGame.internalGameId,
                            })
                        } catch (e) {

                        }
                    }
                }))
            }
        } catch (e) {
            console.error('Error removing players', e)
            sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Remove Player SyncData Data Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        }

        const queuedActions = await readminCollections.queued_game_action.find({
            internalGameId: runningGame.internalGameId
        }).toArray();

        await readminCollections.queued_game_action.deleteMany({
            _id: { $in: queuedActions.map(action => action._id) }
        });

        const ongoingChats = await readminCollections.in_game_support_ticket.find({
            runningGameId: runningGame._id,
            $or: [
                {
                    status: 'open'
                },
                {
                    status: 'claimed'
                },
                {
                    status: 'closed',
                    'closed.serverAcknowledged': false,
                }
            ]
        }).toArray();

        for (const chat of ongoingChats) {
            if (chat.status === 'closed') {
                await readminCollections.in_game_support_ticket.updateOne({
                    _id: chat._id
                }, {
                    $set: {
                        'closed.serverAcknowledged': true
                    }
                })
            }
        }

        // ── Orders v2 block ─────────────────────────────────────────────────
        // Order traffic piggybacks the sync tick rather than running its own
        // poller. The block is processed through the same handler layer the REST
        // /v2 routes use, so the two transports can't drift. Only runs when the
        // server actually sent an orders block AND the module is enabled.
        let ordersResponse;
        if (body.orders && workspace.enabledModules?.orders) {
            const parsedOrders = syncOrdersBlockSchema.safeParse(body.orders);
            if (parsedOrders.success) {
                try {
                    ordersResponse = await processSyncOrders(
                        {
                            groupId,
                            gameId: body.gameId,
                            placeId: runningGame.placeId.toString(),
                            distribution: workspace.currentDistribution,
                        },
                        parsedOrders.data,
                    );
                } catch (e) {
                    console.error('Sync orders processing error', e);
                    sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Sync Orders Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
                }
            }
        }

        return res.send({ success: true, queuedActions, ongoingChats, ...(ordersResponse ? { orders: ordersResponse } : {}) })
    } catch (e) {
        console.error('Send Data Error', e);
        console.error(e);
        console.error('Send Data Error');
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Send Data Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }

};