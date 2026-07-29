import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getSessions = async (req: FastifyRequest<{
    Params: { sessionId: string }
    Body: {
        message: string
    }
}>, res: FastifyReply) => {
    const { workspace } = req;

    try {

        // const TwelveHoursFromNowDate = new Date();
        // TwelveHoursFromNowDate.setHours(TwelveHoursFromNowDate.getHours() + 12);

        const upcomingSessions = await readminCollections.session.find({ groupId: workspace.groupId, date: { $gte: new Date() } }, { sort: { date: 1 } }).toArray();

        return res.send({ success: true, sessions: upcomingSessions })
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false })
    }
};