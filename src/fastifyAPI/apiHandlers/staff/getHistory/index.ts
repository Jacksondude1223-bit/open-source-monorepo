import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getHistory = async (req: FastifyRequest<{
    Body: {

    }
}>, res: FastifyReply) => {
    const { workspace } = req;

    try {
        const history = await readminCollections.write_ups.find({
            groupId: workspace.groupId
        }, { sort: { createdAt: -1 } }).toArray();

        return res.send({ success: true, history })


    } catch (e) {
        return res.status(500).send({ success: false })
    }
};