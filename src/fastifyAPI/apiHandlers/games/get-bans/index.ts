import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';


export const getBans = async (req: FastifyRequest<{
    Params: { banId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;

    try {
        const bans = await readminCollections.workspace_bans.find({ groupId: workspace.groupId }).toArray();

        return res.send({ success: true, bans });

    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};