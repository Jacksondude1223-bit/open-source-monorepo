import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Lists the game servers currently being tracked for the workspace. A server is
// considered running if it has pinged within the last few minutes.
export const getRunningGames = async (req: FastifyRequest, res: FastifyReply) => {
    const { workspace } = req;

    try {
        const runningGames = await readminCollections.running_games.find({
            groupId: workspace.groupId,
        }, { sort: { created: -1 } }).toArray();

        return res.send({ success: true, runningGames });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
