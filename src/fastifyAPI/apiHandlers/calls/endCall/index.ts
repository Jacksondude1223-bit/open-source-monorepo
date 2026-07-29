import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 } from 'uuid';
import StringToObjectID from '~/utils/StringToObjectID';
import { getProcessedUserObject } from '~/services/roblox.service';
import { handleCallDiscordClose, mirrorCallMessageToDiscord } from '~/services/callDiscord.service';

// Ends (closes) a call (actorId = the agent's Roblox id).
export const endCall = async (req: FastifyRequest<{
    Params: { callId: string };
    Body: { actorId: string; reason?: string };
}>, res: FastifyReply) => {
    const { workspace, body } = req;
    const { callId } = req.params;
    const actorId = body?.actorId;
    const reason = body?.reason || 'Closed';

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
        if (call.status === 'closed') {
            return res.status(400).send({ success: false, reason: 'This call is already closed' });
        }

        const actor = await getProcessedUserObject(actorId).catch(() => null);
        const actorName = actor?.name || `User ${actorId}`;

        await readminCollections.in_game_support_ticket.updateOne({
            _id: call._id,
            groupId: workspace.groupId,
        }, {
            $set: {
                status: 'closed',
                closed: {
                    user: actorName,
                    reason,
                    date: new Date(),
                    serverAcknowledged: false,
                },
            },
            $push: {
                messages: {
                    username: actorName,
                    userId: parseInt(actorId),
                    message: `${actorName} closed this call`,
                    id: v4(),
                    origin: 'systemMessage',
                    sentFrom: 'game',
                    created: new Date(),
                },
            },
        });

        mirrorCallMessageToDiscord(call.discordChannelId, {
            username: '',
            message: `${actorName} closed this call`,
            kind: 'system',
        }).catch(() => { });
        handleCallDiscordClose(call).catch(() => { });

        return res.send({ success: true });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
