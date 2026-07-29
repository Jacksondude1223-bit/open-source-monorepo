import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Returns in-game support calls for the workspace. Defaults to the calls that are
// available to be claimed (status `open`). Pass ?status=claimed|closed|all to
// widen the query.
export const getCalls = async (req: FastifyRequest<{
    Querystring: { status?: 'open' | 'claimed' | 'closed' | 'all' };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const status = req.query?.status || 'open';

    try {
        const statusFilter = status === 'all' ? {} : { status };

        const calls = await readminCollections.in_game_support_ticket.find({
            groupId: workspace.groupId,
            ...statusFilter,
        }, { sort: { created: -1 }, limit: 100 }).toArray();

        return res.send({ success: true, calls });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
