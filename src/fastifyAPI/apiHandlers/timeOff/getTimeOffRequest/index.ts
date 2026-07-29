import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import StringToObjectID from '~/utils/StringToObjectID';

// Returns a single time off request by id.
export const getTimeOffRequest = async (req: FastifyRequest<{
    Params: { requestId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { requestId } = req.params;

    if (!requestId) {
        return res.status(400).send({ success: false, reason: 'Request ID was not provided' });
    }

    try {
        const request = await readminCollections.time_off_request.findOne({
            _id: StringToObjectID(requestId),
            groupId: workspace.groupId,
        });

        if (!request) {
            return res.status(404).send({ success: false, reason: 'Time off request not found' });
        }

        return res.send({ success: true, request });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
