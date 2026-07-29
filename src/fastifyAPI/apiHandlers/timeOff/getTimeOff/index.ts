import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Lists time off requests for the workspace. Filter by ?status=pending|approved|denied
// and optionally ?userId= to scope to a single staff member.
export const getTimeOff = async (req: FastifyRequest<{
    Querystring: { status?: 'pending' | 'approved' | 'denied'; userId?: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { status, userId } = req.query || {};

    try {
        const requests = await readminCollections.time_off_request.find({
            groupId: workspace.groupId,
            ...(status ? { status } : {}),
            ...(userId ? { userId } : {}),
        }, { sort: { created: -1 }, limit: 200 }).toArray();

        return res.send({ success: true, requests });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
