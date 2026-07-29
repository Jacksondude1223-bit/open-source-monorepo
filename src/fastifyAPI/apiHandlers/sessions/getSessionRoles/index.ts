import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getSessionRoles = async (req: FastifyRequest<{
    Body: {
        message: string
    }
}>, res: FastifyReply) => {
    const { workspace } = req;

    try {
        const roles = await readminCollections.session_roles.find({ groupId: workspace.groupId }).toArray();

        return res.send({ success: true, roles })
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false })
    }
};