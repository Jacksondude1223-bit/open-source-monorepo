import calculateMinutes from '~/services/businessLogic/calculateMinutes';
import { readminCollections } from '~/services/mongo.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { playerSessionIds } from '../playerJoin';
import { SessionEvents } from '~/services/NewMongoTypes/UserGameSession.type';
import playerLeaveHandler from '../../internal/events-handler/messageTypes/playerLeave';
import { DateToSeconds, UTCSecondsToDate } from '~/utils/DateUtils';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';
import { ObjectId } from 'mongodb';
import { canonicalUserKey, resolveGlobalUserId } from '~/services/userIdentity.service';
import { shouldRetainSession } from '~/services/trackingConsent.service';
import { closeOpenCallsForLeavingPlayer, deleteSessionData } from '~/services/activityTracking.service';

/**
 * Inserts a chunk of session events, skipping any that already exist (by
 * type + timestamp). Dedup is done with a Set so very long sessions (or many
 * chunks) stay O(n) instead of the O(n*m) nested scan, since the chunked v2
 * upload can carry far more events than a single v1 leave call.
 */
const insertSessionEvents = async (
    sessionId: ObjectId,
    groupId: number,
    userId: number,
    userKey: string,
    events: SessionEvents[],
) => {
    if (!events || events.length === 0) {
        return;
    }

    const existing = await readminCollections.user_game_session_event
        .find({ userGameSession: sessionId })
        .toArray();

    const seen = new Set<string>();
    for (const e of existing) {
        seen.add(`${e.type}|${e.date.getTime()}`);
    }

    for (const event of events) {
        if (event.type === 'log' || event.type === 'system') {
            continue;
        }

        const eventDate = event.datetime
            ? new Date(event.datetime)
            : UTCSecondsToDate(event.date as number);
        const key = `${event.type}|${eventDate.getTime()}`;

        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const insertData: any = {
            userGameSession: sessionId,
            groupId,
            userId,
            userKey,
            type: event.type,
            date: eventDate,
            created: new Date(),
        };

        if (event.type === 'message') {
            insertData.message = event.encoded
                ? Buffer.from(event.message, 'base64').toString('utf-8')
                : event.message;
        }

        if (event.type === 'typing' && (event as any).state !== undefined) {
            insertData.state = (event as any).state;
        }

        await readminCollections.user_game_session_event.insertOne(insertData);
    }
};

/**
 * Chunked player-leave. A player's full session log can exceed Roblox's HTTP
 * body limit (and our own request limits) on long sessions, so the tracker can
 * split the final event payload across several requests. Every request appends
 * its events; only the request flagged `final` ends the session and runs the
 * minute calculation. The endpoint is idempotent — re-sent chunks dedupe and a
 * missing/already-finalized session is accepted rather than erroring.
 */
export const playerLeaveV2 = async (req: FastifyRequest<{
    Body: {
        sessionIds: playerSessionIds;
        playerId: string;
        // Canonical identity key, sent by updated game modules; older deployed
        // loaders send only playerId.
        userKey?: string;
        events: SessionEvents[];
        final: boolean;
        leftTime?: number;
        datetime?: number;
        gameId: string;
    };
}>, res: FastifyReply) => {
    const body = req.body;
    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;

    try {
        const { playerId, events, final, leftTime, datetime } = body;

        if (!playerId || !events) {
            return res.status(400).send({ success: false, error: 'Missing required paramater' });
        }

        const userKey = canonicalUserKey(body.userKey ?? playerId);
        const userId = userKey;

        if (await isUserGDPRIgnored(userId)) {
            return res.status(200).send({ success: true });
        }

        const player = await readminCollections.running_game_players.findOne({
            groupId,
            // Records written before the scoped-ID migration carry no userKey.
            $or: [{ userKey }, { userId: userKey }],
        });

        const session = await readminCollections.user_game_session.findOne({
            _id: player?.userSessionId,
        });

        // The session may already be gone (e.g. finalized by a previous request
        // or removed by sync). Accept the chunk idempotently instead of erroring.
        if (!session) {
            return res.send({ success: true, finalized: false });
        }

        // Every chunk appends its events to the session.
        await insertSessionEvents(session._id!, parseInt(groupId), session.userId, session.userKey ?? userKey, events);

        if (!final) {
            return res.send({ success: true, finalized: false });
        }

        // Final chunk ends the session. leftTime is required to stamp the end.
        if (!leftTime) {
            return res.status(400).send({ success: false, error: 'Missing leftTime on final chunk' });
        }

        // Runs before the retention branch below: an orphaned open call blocks
        // the player from calling again, so it has to be cleared either way.
        await closeOpenCallsForLeavingPlayer(groupId, runningGame._id, parseInt(playerId));

        // Privacy mode: if the player never consented to retention, delete this
        // visit's data on leave instead of finalizing it (they're re-prompted
        // next visit). Consent governs retention, not real-time collection.
        if (!(await shouldRetainSession(workspace, userKey))) {
            await deleteSessionData(workspace, runningGame, session, player);
            return res.send({ success: true, finalized: false, deleted: true });
        }

        // group_member is keyed by global Roblox ID; an unlinked scoped player
        // has no record there.
        const globalUserId = await resolveGlobalUserId(userKey);
        const rosterKeys = player?.userId ? [...new Set([userKey, player.userId])] : [userKey];
        await Promise.all([
            readminCollections.running_games.updateOne(
                { _id: runningGame._id },
                { $pull: { players: { $in: rosterKeys } } },
            ),
            globalUserId !== null
                ? readminCollections.group_member.updateOne(
                    { groupId, userId: globalUserId },
                    {
                        $set: { inGame: false },
                        $unset: { inGameId: '', sessionId: '', playerId: '' },
                    },
                )
                : Promise.resolve(null),
        ]);

        try {
            await playerLeaveHandler({
                groupId,
                userId,
                internalGameId: runningGame.internalGameId,
            });
        } catch (e) {
            // non-fatal
        }

        await readminCollections.running_game_players.deleteOne({ _id: player?._id });

        await readminCollections.user_game_session.updateOne(
            { _id: session._id },
            {
                $set: {
                    ended: datetime ? DateToSeconds(new Date(datetime)) : leftTime,
                    inGame: false,
                    removalMethod: 'normalPlayerLeave',
                    active: false,
                },
            },
        );

        await readminCollections.user_game_session_event.insertOne({
            userGameSession: session._id,
            groupId: parseInt(groupId),
            userId: session.userId,
            userKey: session.userKey ?? userKey,
            type: 'leave',
            date: datetime ? new Date(datetime) : UTCSecondsToDate(leftTime),
            created: new Date(),
        });

        await calculateMinutes(workspace, session._id!, player?.isStaff == true);

        return res.send({ success: true, finalized: true });
    } catch (e) {
        console.error('Player Leave V2 Error', e);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Player Leave V2 Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
