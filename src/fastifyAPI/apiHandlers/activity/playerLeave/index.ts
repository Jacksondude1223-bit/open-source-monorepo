import calculateMinutes from '~/services/businessLogic/calculateMinutes';
import { readminCollections } from '~/services/mongo.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { playerSessionIds } from '../playerJoin';
import { SessionEvents } from '~/services/NewMongoTypes/UserGameSession.type';
import playerLeaveHandler from '../../internal/events-handler/messageTypes/playerLeave';
import { DateToSeconds, UTCSecondsToDate } from '~/utils/DateUtils';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';
import { closeOpenCallsForLeavingPlayer } from '~/services/activityTracking.service';

export const playerLeave = async (req: FastifyRequest<{
    Body: { sessionIds: playerSessionIds; playerId: string; events: SessionEvents[]; leftTime: number; datetime?: number; gameId: string; };
}>, res: FastifyReply) => {
    const body = req.body;
    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;



    try {

        const { playerId, events, leftTime, datetime } = body;
        const userId = playerId.toString();

        if (await isUserGDPRIgnored(userId)) {
            return res.status(200).send({
                success: true,
            });
        }

        if (!playerId || !events || !leftTime) {
            return res.status(400).send({ success: false, error: 'Missing required paramater' })
        }


        const [player] = await Promise.all([
            readminCollections.running_game_players.findOne({
                userId: playerId,
                groupId
            }),
            readminCollections.running_games.updateOne(
                {
                    _id: runningGame._id,
                },
                {
                    $pull: {
                        players: userId,
                    },
                }
            ),
            readminCollections.group_member.updateOne(
                {
                    groupId,
                    userId: parseInt(userId),
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
            ),
        ]);


        // An open call left behind by an ungraceful disconnect blocks the player
        // from ever calling again on this server.
        await closeOpenCallsForLeavingPlayer(groupId, runningGame._id, parseInt(userId));

        try {
            await playerLeaveHandler({
                groupId,
                userId,
                internalGameId: runningGame.internalGameId,
            })
        } catch (e) {

        }

        const found = await readminCollections.user_game_session.findOne({
            _id: player?.userSessionId
        });


        await readminCollections.running_game_players.deleteOne({
            _id: player?._id
        });

        if (found) {
            await readminCollections.user_game_session.updateOne({
                _id: found._id,
            }, {
                $set: {
                    ended: datetime ? DateToSeconds(new Date(datetime)) : leftTime,
                    inGame: false,
                    removalMethod: 'normalPlayerLeave',
                    active: false,
                },
            });

            await readminCollections.user_game_session_event.insertOne({
                userGameSession: found._id,
                groupId: parseInt(groupId),
                userId: found.userId,
                type: 'leave',
                date: datetime ? new Date(datetime) : UTCSecondsToDate(leftTime),
                created: new Date()
            })

            const foundEvents = await readminCollections.user_game_session_event.find({
                userGameSession: found._id,
            }).toArray();

            if (events && events.length > 0) {
                for (const event of events) {
                    // Use datetime (milliseconds) for more precise comparison
                    const eventDate = event.datetime ? new Date(event.datetime) : UTCSecondsToDate(event.date as number);

                    // We need to see if the event already exists in the database.
                    // We also need to check if the event is duplicated twice in the events array.
                    const isDuplicate = foundEvents.some(e => e.type === event.type && e.date.getTime() === eventDate.getTime());

                    if (!isDuplicate && event.type !== 'log' && event.type !== 'system') {
                        const insertData: any = {
                            userGameSession: found._id,
                            groupId: parseInt(groupId),
                            userId: found.userId,
                            type: event.type,
                            date: eventDate,
                            created: new Date(),
                        };

                        // Add message-specific fields if it's a message event
                        if (event.type === 'message') {
                            insertData.message = event.encoded ? Buffer.from(event.message, 'base64').toString('utf-8') : event.message;
                        }

                        // Add typing-specific fields if it's a typing event
                        if (event.type === 'typing' && (event as any).state !== undefined) {
                            insertData.state = (event as any).state;
                        }

                        await readminCollections.user_game_session_event.insertOne(insertData);
                    }
                }
            }
        

            await calculateMinutes(workspace, found._id, player?.isStaff == true);
        }

        return res.send({ success: true });
    } catch (e) {
        console.error('Player Leave Error', e);
        console.error(e);
        console.error('Player Leave Error');
        console.log(`Player Leave Errrorr - group ${groupId}`);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Player Leave Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }

};