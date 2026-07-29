import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { canUserApplyToApplication } from '~/services/applications';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';


export const canApply = async (req: FastifyRequest<{
    Body: { applicationId: string; userId: string; };
}>, res: FastifyReply) => {
    const { workspace, body } = req;
    const { applicationId, userId } = body;

    if (!applicationId || !userId) {
        return res.status(404).send({
            success: false,
            reason: 'application, or userid not found'
        })
    }

    if (await isUserGDPRIgnored(userId)) {
        return res.status(200).send({
            success: false,
            canApply: false,
            reason: 'User is GDPR ignored'
        });
    }

    try {

        const application = await readminCollections.application.findOne(
            {
                groupId: workspace.groupId,
                _id: StringToObjectID(applicationId),
            }
        );

        if (!application) {
            return res.status(404).send({
                success: false,
                reason: 'application not found'
            })
        }
        const canApply = await canUserApplyToApplication(application.groupId, application._id.toString(), userId?.toString() || '0')
        return res.send(canApply)
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};