import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';
import { createCallDiscordChannel } from '~/services/callDiscord.service';

export const supportCreate = async (req: FastifyRequest<{
    Body: {
        callType: 'report' | 'support',
        reporting: string, // name the user is reporting
        players: [number, string, string][] // user id, player name, player display name
        callerId: number,
        reason: string;
        gameId: string;
    };
}>, res: FastifyReply) => {
    const body = req.body;

    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;
    const internalGameId = runningGame.internalGameId;

    try {

        const {
            callType,
            callerId,
            players,
            reporting,
            reason
        } = body;

        if (await isUserGDPRIgnored(callerId.toString())) {
            return res.status(200).send({
                success: false,
                reason: 'Caller is GDPR ignored'
            });
        }

        if (!callType || !callerId || !players || !reason) {
            return res.status(400).send({ success: false, reason: 'Missing required parameters' });
        }

        const { groupId } = workspace;

        if (callType !== 'support' && callType !== 'report') {
            return res.status(400).send({ success: false, reason: 'Invalid call type' });
        }

        if (players.length === 0) {
            return res.status(400).send({ success: false, reason: 'Missing players' });
        }

        // Block users who have been banned from creating calls in this workspace.
        // Returned as a soft failure (200 + success:false) so the in-game client
        // can show the reason to the player instead of throwing a generic error.
        const callBan = await readminCollections.in_game_call_ban.findOne({
            groupId,
            userId: callerId,
        });
        if (callBan) {
            return res.status(200).send({ success: false, banned: true, reason: 'You are banned from creating calls in this game.' });
        }

        // Scoped to the server the caller is actually in. This used to match any
        // open ticket in the workspace, so a call left open when its server died
        // (nothing closes those — see ClearBadRunningGame) permanently blocked
        // that player from ever calling again. Returned as a 200 soft-failure,
        // like the ban path, so the client can show the reason instead of
        // treating it as a generic request error.
        const alreadyOpenSupportTicket = await readminCollections.in_game_support_ticket.findOne({
            groupId,
            runningGameId: runningGame._id,
            status: { $in: ['open', 'claimed'] },
            callerId
        })

        if (alreadyOpenSupportTicket) {
            return res.status(200).send({ success: false, reason: 'You already have a call open in this server.' });
        }

        const inserted = await readminCollections.in_game_support_ticket.insertOne({
            groupId,
            gameId: runningGame.gameId,
            placeId: runningGame.placeId,
            runningGameId: runningGame._id,
            type: callType,
            status: 'open',
            callerId,
            reportedUser: reporting,
            reason,
            messages: [],
            closed: false,
            created: new Date(),
        })

        const insertedTicket = await readminCollections.in_game_support_ticket.findOne({
            _id: inserted.insertedId
        })

        // Bridge the call into the linked Discord guild (if configured). Fire-and-forget:
        // a Discord failure must never block call creation.
        createCallDiscordChannel(inserted.insertedId).catch((e) => {
            console.error('Failed to create Discord call channel', e);
        });

        return res.send({ success: true, ticket: insertedTicket });


    } catch (e) {
        console.error('Support Create Error', e);
        console.error(e);
        console.error('Support Create Error');
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};