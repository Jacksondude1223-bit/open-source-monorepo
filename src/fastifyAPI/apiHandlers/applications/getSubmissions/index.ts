import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getSubmissions = async (req: FastifyRequest<{
    Querystring: { userId?: string };
}>, res: FastifyReply) => {
    const { workspace, query } = req;
    const userId = query.userId;

    if (!userId) {
        return res.status(404).send({
            success: false,
            reason: 'userId not found',
        });
    }

    try {
        const responsesCursor = await readminCollections.response.find({
            groupId: workspace.groupId,
            userId: userId.toString(),
        });
        const responses = await responsesCursor.toArray();

        // Index the forms referenced by these responses so we can attach a title
        // and honour each form's "show status to applicant" visibility setting.
        const applicationsCursor = await readminCollections.application.find({
            groupId: workspace.groupId,
        });
        const applications = await applicationsCursor.toArray();
        const applicationById = new Map(applications.map((a) => [a._id.toString(), a]));

        const submissions = responses
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
            .map((r) => {
                const application = applicationById.get(r.applicationId?.toString());
                // When the form hides status from applicants, collapse everything to
                // "pending" and strip the score so the game never reveals the result.
                const showStatus = application?.applicantVisibility?.showStatus !== false;

                return {
                    applicationId: r.applicationId?.toString(),
                    title: application?.name ?? 'Form',
                    status: showStatus ? r.status : 'pending',
                    score: showStatus ? r.score ?? null : null,
                    created: new Date(r.created).getTime(),
                };
            });

        return res.send({
            success: true,
            submissions,
        });
    } catch (e) {
        console.error('Get Submissions Error', e);
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
