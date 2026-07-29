import { Filter, WithId } from 'mongodb';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Session } from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';
import {
    buildGameMap,
    buildRoleNameMap,
    decodeCursor,
    encodeCursor,
    getSessionStatus,
    normalizeSession,
    SessionStatus,
} from '~/fastifyAPI/apiHandlers/sessionsV2/_normalize';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

// GET /sessions/v2
// World-class list endpoint: filter by status / template / date range, choose
// ordering, and page with opaque cursors. Returns fully-normalized sessions.
export const listSessions = async (req: FastifyRequest<{
    Querystring: {
        status?: SessionStatus | 'all';
        templateId?: string;
        from?: string;
        to?: string;
        order?: 'asc' | 'desc';
        limit?: string;
        cursor?: string;
    };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const query = req.query || {};

    const limit = Math.min(Math.max(parseInt(query.limit || `${DEFAULT_LIMIT}`) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = decodeCursor(query.cursor);
    const order: 1 | -1 = query.order === 'desc' ? -1 : 1;
    const now = new Date();

    const filter: Filter<Session> = { groupId: workspace.groupId };

    // Date-range filtering on the session start time.
    const dateFilter: Record<string, Date> = {};
    if (query.from) {
        const from = new Date(query.from);
        if (!isNaN(from.getTime())) dateFilter.$gte = from;
    }
    if (query.to) {
        const to = new Date(query.to);
        if (!isNaN(to.getTime())) dateFilter.$lte = to;
    }

    // Status maps onto the start/end window. `scheduled` = future, `live` =
    // in-progress, `ended` = past.
    if (query.status && query.status !== 'all') {
        if (query.status === 'scheduled') {
            dateFilter.$gt = dateFilter.$gt && dateFilter.$gt > now ? dateFilter.$gt : now;
        } else if (query.status === 'ended') {
            filter.endsAt = { $lt: now };
        } else if (query.status === 'live') {
            filter.date = { ...(dateFilter.$gte ? { $gte: dateFilter.$gte } : {}), $lte: now };
            filter.endsAt = { $gte: now };
        }
    }
    if (Object.keys(dateFilter).length > 0 && !filter.date) {
        filter.date = dateFilter;
    }

    if (query.templateId) {
        filter['template.id'] = query.templateId;
    }

    try {
        const total = await readminCollections.session.countDocuments(filter);

        const sessions = await readminCollections.session
            .find(filter, { sort: { date: order, _id: order }, skip: offset, limit })
            .toArray();

        const roleNameMap = await buildRoleNameMap(workspace.groupId);
        const gameMap = await buildGameMap(
            workspace.groupId,
            sessions.map((s: WithId<Session>) => s.template?.placeId).filter((id): id is number => typeof id === 'number'),
        );

        const data = sessions.map((session: WithId<Session>) =>
            normalizeSession(session, gameMap, roleNameMap, now),
        );

        const hasMore = offset + sessions.length < total;

        return res.send({
            success: true,
            data,
            pagination: {
                total,
                limit,
                count: data.length,
                hasMore,
                nextCursor: hasMore ? encodeCursor(offset + sessions.length) : null,
            },
        });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
