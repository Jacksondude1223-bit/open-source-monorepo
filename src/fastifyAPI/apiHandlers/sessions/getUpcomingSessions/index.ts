import { readminCollections } from '~/services/mongo.service';
import { DaysInWeek, DaysInWeek_TYPE, getEndOfDay, getStartOfDay } from '~/utils/DateUtils';
import moment from 'moment';
import { Game, Session } from '~/services/NewMongoTypes';
import { FastifyReply, FastifyRequest } from 'fastify';

interface SpecialServerReturn extends Session {
    game: Game;
}

export const getUpcomingSessions = async (req: FastifyRequest<{
    Body: {
        message: string
    }
}>, res: FastifyReply) => {
    const { workspace } = req;
    try {

        const TwelveHoursFromNowDate = new Date();
        TwelveHoursFromNowDate.setHours(TwelveHoursFromNowDate.getHours() + 12);

        const date = new Date();
        const templates = await readminCollections.sessions_template.find({ groupId: workspace.groupId }).toArray();
        let sessions: SpecialServerReturn[] = [];
        const dayOfWeek = date;

        let addedThisDay = [];


        const sessionsThisDay = await readminCollections.session.find({
            groupId: workspace.groupId,
            date: {
                $gte: getStartOfDay(dayOfWeek),
                $lte: getEndOfDay(dayOfWeek)
            }
        }).toArray();

        for (const template of templates) {
            if (template.schedule.type == 'daily') {

                const momentTz = moment.utc().year(dayOfWeek.getUTCFullYear()).month(dayOfWeek.getUTCMonth()).date(dayOfWeek.getUTCDate()).hour(template.schedule.hour).minute(template.schedule.minute).second(0).millisecond(0);
                const starts = momentTz.month(dayOfWeek.getMonth()).date(dayOfWeek.getDate()).toDate();

                const endsAt = new Date(new Date(starts).getTime() + template.sessionDuration * 60 * 1000);
                const notifyTime = new Date(new Date(starts).getTime() - template.appearsMinutesBefore * 60 * 1000);


                const foundMatch = sessionsThisDay.find(session => new Date(session.date).getTime() === starts.getTime());
                if (!foundMatch) {
                    addedThisDay.push({ ...template, _id: 'notCreated', date: starts, endsAt, notifyTime, template });
                }
            }
            const day = DaysInWeek[dayOfWeek.getDay()] as DaysInWeek_TYPE;
            if (
                template.schedule.type == 'weekly' &&
                template.schedule.day == day.toLowerCase()
            ) {
                const momentTz = moment.utc().year(dayOfWeek.getUTCFullYear()).month(dayOfWeek.getUTCMonth()).date(dayOfWeek.getUTCDate()).hour(template.schedule.hour).minute(template.schedule.minute).second(0).millisecond(0);
                const starts = momentTz.month(dayOfWeek.getMonth()).date(dayOfWeek.getDate()).toDate();

                const endsAt = new Date(new Date(starts).getTime() + template.sessionDuration * 60 * 1000);
                const notifyTime = new Date(new Date(starts).getTime() - template.appearsMinutesBefore * 60 * 1000);


                const foundMatch = sessionsThisDay.find(session => new Date(session.date).getTime() === starts.getTime());
                if (!foundMatch) {
                    addedThisDay.push({ ...template, _id: 'notCreated', date: starts, endsAt, notifyTime, template });
                }
            }
        }


        for (const existingSession of sessionsThisDay) {
            // Check if this session is already created by a template, or if it is unique.
            const foundMatch = addedThisDay.find(session => (session?.date as Date) == existingSession.date);
            if (!foundMatch) {
                addedThisDay.push(existingSession);
            }
        }

        addedThisDay = await Promise.all(addedThisDay.map(async session => {
            const game = await readminCollections.game.findOne({ groupId: session.groupId, placeId: session.template.placeId });
            return {
                ...session,
                game
            }
        }))

        //@ts-expect-error good enough for gov work
        sessions = addedThisDay.sort((a, b) => a.date.getTime() - b.date.getTime());
        sessions = sessions.filter(session => session.date <= TwelveHoursFromNowDate || session.endsAt <= TwelveHoursFromNowDate)


        return res.send({ success: true, sessions: sessions /* upcomingSessions */ })
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false })
    }
};