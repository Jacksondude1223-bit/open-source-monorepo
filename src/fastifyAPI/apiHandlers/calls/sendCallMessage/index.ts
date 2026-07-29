import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 } from 'uuid';
import StringToObjectID from '~/utils/StringToObjectID';
import { getProcessedUserObject } from '~/services/roblox.service';
import { mirrorCallMessageToDiscord } from '~/services/callDiscord.service';

// Sends an agent chat message into a call (actorId = the agent's Roblox id). The
// message is delivered to the in-game caller on the game server's next sync.
export const sendCallMessage = async (req: FastifyRequest<{
    Params: { callId: string };
    Body: { actorId: string; message: string };
}>, res: FastifyReply) => {
    const { workspace, body } = req;
    const { callId } = req.params;
    const actorId = body?.actorId;
    const message = body?.message;

    if (!callId) {
        return res.status(400).send({ success: false, reason: 'Call ID was not provided' });
    }
    if (!actorId) {
        return res.status(400).send({ success: false, reason: 'actorId was not provided' });
    }
    if (!message || !message.trim()) {
        return res.status(400).send({ success: false, reason: 'message was not provided' });
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
            return res.status(400).send({ success: false, reason: 'This call is closed' });
        }

        const actor = await getProcessedUserObject(actorId).catch(() => null);
        const actorName = actor?.name || `User ${actorId}`;

        const newMessage = {
            username: actorName,
            userId: parseInt(actorId),
            message,
            id: v4(),
            origin: 'agent' as const,
            sentFrom: 'game' as const,
            created: new Date(),
        };

        await readminCollections.in_game_support_ticket.updateOne({
            _id: call._id,
            groupId: workspace.groupId,
        }, {
            $push: { messages: newMessage },
        });

        mirrorCallMessageToDiscord(call.discordChannelId, {
            username: actorName,
            message,
            kind: 'agent',
        }).catch(() => { });

        return res.send({ success: true, message: newMessage });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
