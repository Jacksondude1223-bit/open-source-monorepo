import { readminCollections } from '~/services/mongo.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import calculateMinutes from '~/services/businessLogic/calculateMinutes';
import { DateToSeconds } from '~/utils/DateUtils';

export const endServer = async (req: FastifyRequest<{
    Body: { gameId: number, placeId: number, jobId: string, privateServerId: string, privateServerOwnerId: number, placeVersion: number; };
}>, res: FastifyReply) => {
    const headers = req.headers;
    const body = req.body;

    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;
    const internalGameId = runningGame.internalGameId;

    try {
        // Calculate minutes for all staff sessions still in-game before cleaning up
        const staffSessionsStillInGame = await readminCollections.user_game_session.find({
            runningGameId: runningGame._id,
            inGame: true,
            staff: true,
        }).toArray();

        const now = new Date();
        for (const session of staffSessionsStillInGame) {
            try {
                // Insert a leave event so calculateMinutes can account for the full session
                await readminCollections.user_game_session_event.insertOne({
                    userGameSession: session._id,
                    groupId: session.groupId,
                    userId: session.userId,
                    type: 'leave',
                    date: now,
                    created: now,
                });

                await readminCollections.user_game_session.updateOne({
                    _id: session._id,
                }, {
                    $set: {
                        ended: DateToSeconds(now),
                        inGame: false,
                        active: false,
                        removalMethod: 'serverClose' as any,
                    },
                });

                await calculateMinutes(workspace, session._id, true);
            } catch (e) {
                console.error(`endServer: failed to calculate minutes for session ${session._id}`, e);
            }
        }

        await Promise.all([
            readminCollections.group_member.updateMany({
                groupId: workspace?.groupId as string,
                inGameId: internalGameId
            }, {
                $set: {
                    inGame: false,
                },
                $unset: {
                    inGameId: '',
                    sessionId: '',
                    inRunningGameId: '',
                    playerId: '',
                }
            }),
            // readminCollections.running_game_logs.deleteMany({
            //   runningGameId: runningGame._id,
            // }),
            readminCollections.running_game_chats.deleteMany({
                runningGameId: runningGame._id,
            }),
            readminCollections.running_games.deleteOne({
                _id: runningGame._id,
            }),
            readminCollections.running_game_players.deleteMany({
                runningGameId: runningGame._id,
            }),
            readminCollections.user_game_session.deleteMany({
                runningGameId: runningGame._id,
                staff: false,
            }),
        ]);

        return res.send({ success: true })
    } catch (e) {
        console.error('End Server Error', e);
        console.error(e);
        console.error('End Server Error');
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'End Server Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }

};