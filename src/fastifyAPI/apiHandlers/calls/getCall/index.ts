import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import StringToObjectID from '~/utils/StringToObjectID';

// Returns a single call along with its running game / game metadata. Includes the
// full message transcript (use this to read the chat).
export const getCall = async (req: FastifyRequest<{
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
        });

        if (!call) {
            return res.status(404).send({ success: false, reason: 'Call not found' });
        }

        const server = call.runningGameId
            ? await readminCollections.running_games.findOne({ _id: call.runningGameId })
            : null;

        return res.send({ success: true, call, server });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
