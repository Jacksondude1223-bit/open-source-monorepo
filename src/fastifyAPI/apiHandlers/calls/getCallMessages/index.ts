import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import StringToObjectID from '~/utils/StringToObjectID';

// Returns just the message transcript for a call. Useful for polling an
// in-progress chat without re-fetching the whole call object.
export const getCallMessages = async (req: FastifyRequest<{
    Params: { callId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { callId } = req.params;

    if (!callId) {
        return res.status(400).send({ success: false, reason: 'Call ID was not provided' });
    }

    try {
        const call = await readminCollections.in_game_support_ticket.findOne({
            _id: StringToObjectID(callId),
            groupId: workspace.groupId,
        }, { projection: { messages: 1, status: 1 } });

        if (!call) {
            return res.status(404).send({ success: false, reason: 'Call not found' });
        }

        return res.send({ success: true, status: call.status, messages: call.messages || [] });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
