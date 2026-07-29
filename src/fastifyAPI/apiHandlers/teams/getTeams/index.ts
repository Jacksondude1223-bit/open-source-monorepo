import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Lists all teams in the workspace.
export const getTeams = async (req: FastifyRequest, res: FastifyReply) => {
    const { workspace } = req;

    try {
        const teams = await readminCollections.team.find({
            groupId: workspace.groupId,
        }, { sort: { name: 1 } }).toArray();

        return res.send({ success: true, teams });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
