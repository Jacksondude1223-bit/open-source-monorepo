import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Returns a single running game server along with the players currently in it.
export const getRunningGame = async (req: FastifyRequest<{
    Params: { internalGameId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { internalGameId } = req.params;

    if (!internalGameId) {
        return res.status(400).send({ success: false, reason: 'Internal game ID was not provided' });
    }

    try {
        const runningGame = await readminCollections.running_games.findOne({
            groupId: workspace.groupId,
            internalGameId,
        });

        if (!runningGame) {
            return res.status(404).send({ success: false, reason: 'Running game not found' });
        }

        const players = await readminCollections.running_game_players.find({
            groupId: workspace.groupId,
            internalGameId,
        }).toArray();

        return res.send({ success: true, runningGame, players });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
