import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { AnswerType, canUserApplyToApplication, submitUserApplication } from '~/services/applications';
import { Application, Workspace } from '~/services/NewMongoTypes';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';


export const submitApplication = async (req: FastifyRequest<{
    Body: { applicationId: string; userId: string; applicationBody: AnswerType; startTime: number; endTime: number; };
}>, res: FastifyReply) => {
    const { workspace, body } = req;
    const { applicationId, userId, applicationBody, startTime, endTime } = body;

    if (await isUserGDPRIgnored(userId)) {
        return res.status(200).send({
            success: false,
            message: 'User is GDPR ignored'
        });
    }

    if (!applicationId || !userId || !applicationBody || !startTime || !endTime) {
        return res.status(404).send({
            success: false,
            reason: 'application, or userid not found'
        })
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

        if (canApply.canApply == false) {
            return res.status(401).send({
                success: true,
                sent: false,
                message: `You are not eligible to apply for this application for reason ${canApply.reason}`,
            });
        }

        const resp = await submitUserApplication(
            await readminCollections.workspace.findOne({ groupId: application.groupId }) as Workspace,
            await readminCollections.application.findOne({ _id: application._id }) as Application,
            userId,
            applicationBody,
            startTime,
            endTime,
            'game',
        );

        if (resp.success == true) {
            return res.send(resp);
        } else {
            return res.status(400).send({
                success: true,
                message: resp.reason,
            });
        }


    }
    catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false })
    }
};