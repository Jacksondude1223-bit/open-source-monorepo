import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { v4 } from 'uuid';
import { FastifyRequest, FastifyReply } from 'fastify';

export const createSessionServer = async (req: FastifyRequest<{
    Params: { sessionId: string }
    Body: {
        message: string
    }
}>, res: FastifyReply) => {
    const { workspace, params } = req;

    try {
        const sessionId = params?.sessionId as string;
        if (!sessionId) {
            return res.status(400).send({ success: false, message: 'Invalid request' })
        }
        const session = await readminCollections.session.findOne({ groupId: workspace.groupId, _id: StringToObjectID(sessionId) });
        if (!session) {
            return res.status(400).send({ success: false, message: 'Session not found' })
        }
        const template = session.template;
        if (!template) {
            return res.status(400).send({ success: false, message: 'Template not found' })
        }

        const serverId = v4();

        const newSession = await readminCollections.session.findOneAndUpdate({ _id: session._id }, {
            $set: {
                [`servers.${serverId}`]: {
                    linkedToServer: false,
                    claims: {},
                    attendees: {}
                }
            }
        });

        return res.send({ success: true, newServerId: serverId, session: newSession })
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false })
    }
};