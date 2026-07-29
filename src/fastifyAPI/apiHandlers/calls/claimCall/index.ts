import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 } from 'uuid';
import StringToObjectID from '~/utils/StringToObjectID';
import { getProcessedUserObject } from '~/services/roblox.service';
import { mirrorCallMessageToDiscord } from '~/services/callDiscord.service';

// Claims an open call on behalf of an agent (actorId = the agent's Roblox id).
export const claimCall = async (req: FastifyRequest<{
    Params: { callId: string };
    Body: { actorId: string };
}>, res: FastifyReply) => {
    const { workspace, body } = req;
    const { callId } = req.params;
    const actorId = body?.actorId;

    if (!callId) {
        return res.status(400).send({ success: false, reason: 'Call ID was not provided' });
    }
    if (!actorId) {
        return res.status(400).send({ success: false, reason: 'actorId was not provided' });
    }

    try {
        const call = await readminCollections.in_game_support_ticket.findOne({
            _id: StringToObjectID(callId),
            groupId: workspace.groupId,
        });

        if (!call) {
            return res.status(404).send({ success: false, reason: 'Call not found' });
        }
        if (call.status !== 'open') {
            return res.status(400).send({ success: false, reason: 'This call is not available to claim' });
        }

        const actor = await getProcessedUserObject(actorId).catch(() => null);
        const actorName = actor?.name || `User ${actorId}`;

        await readminCollections.in_game_support_ticket.updateOne({
            _id: call._id,
            groupId: workspace.groupId,
            status: 'open',
        }, {
            $set: {
                status: 'claimed',
                claimedBy: parseInt(actorId),
            },
            $push: {
                messages: {
                    username: actorName,
                    userId: parseInt(actorId),
                    message: `${actorName} claimed this call`,
                    id: v4(),
                    origin: 'systemMessage',
                    sentFrom: 'game',
                    created: new Date(),
                },
            },
        });

        mirrorCallMessageToDiscord(call.discordChannelId, {
            username: '',
            message: `${actorName} claimed this call`,
            kind: 'system',
        }).catch(() => { });

        return res.send({ success: true });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
