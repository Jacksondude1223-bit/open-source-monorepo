import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Lists promotion requests for the workspace. Filter by ?status=pending|approved|declined.
export const getPromotionRequests = async (req: FastifyRequest<{
    Querystring: { status?: 'pending' | 'approved' | 'declined' };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { status } = req.query || {};

    try {
        const requests = await readminCollections.promotion_request.find({
            groupId: workspace.groupId,
            ...(status ? { status } : {}),
        }, { sort: { created: -1 }, limit: 200 }).toArray();

        return res.send({ success: true, requests });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
