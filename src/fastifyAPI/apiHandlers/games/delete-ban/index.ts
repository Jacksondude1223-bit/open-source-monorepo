import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { FastifyRequest, FastifyReply } from 'fastify';


export const deleteBan = async (req: FastifyRequest<{
    Params: { banId: string };
}>, res: FastifyReply) => {
    const { workspace, params } = req;

    try {

        const { banId } = params;

        const users = await readminCollections.workspace_bans.findOne({ groupId: workspace.groupId, userId: banId?.toString() });
        if (users) {

        }

        const ban = await readminCollections.workspace_bans.findOne({
            groupId: workspace.groupId,
            ...(users ? { userId: banId?.toString() } : { _id: StringToObjectID(banId as string) }),
        });
        if (!ban) {
            return res.status(400).send({ success: false, reason: 'Invalid banId or userId' })
        }

        await readminCollections.workspace_bans.updateOne({ _id: ban._id }, { $set: { active: false } });

        return res.send({ success: true, ban })


    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};