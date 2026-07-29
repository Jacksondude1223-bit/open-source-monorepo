import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getSession = async (req: FastifyRequest<{
    Params: { sessionId: string }
    Body: {
        message: string
    }
}>, res: FastifyReply) => {
    const { workspace, params } = req;

    try {

        const sessionId = params.sessionId;
        if (!sessionId) {
            return res.status(400).send({ success: false, message: 'Invalid request' })
        }
        const session = await readminCollections.session.findOne({ groupId: workspace.groupId, _id: StringToObjectID(sessionId) });

        return res.send({ success: true, session })
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false })
    }
};