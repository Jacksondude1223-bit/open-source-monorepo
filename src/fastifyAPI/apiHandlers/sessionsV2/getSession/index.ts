import { FastifyRequest, FastifyReply } from 'fastify';
import StringToObjectID from '~/utils/StringToObjectID';
import { readminCollections } from '~/services/mongo.service';
import {
    buildGameMap,
    buildRoleNameMap,
    normalizeSession,
} from '~/fastifyAPI/apiHandlers/sessionsV2/_normalize';

// GET /sessions/v2/:sessionId
// Returns a single fully-normalized session (resolved game, roles, servers,
// claims and attendees) instead of the raw Mongo document.
export const getSession = async (req: FastifyRequest<{
    Params: { sessionId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(400).send({ success: false, reason: 'Session ID was not provided' });
    }

    let objectId;
    try {
        objectId = StringToObjectID(sessionId);
    } catch {
        return res.status(400).send({ success: false, reason: 'Invalid session ID' });
    }

    try {
        const session = await readminCollections.session.findOne({
            groupId: workspace.groupId,
            _id: objectId,
        });

        if (!session) {
            return res.status(404).send({ success: false, reason: 'Session not found' });
        }

        const roleNameMap = await buildRoleNameMap(workspace.groupId);
        const gameMap = await buildGameMap(
            workspace.groupId,
            session.template?.placeId != null ? [session.template.placeId] : [],
        );

        return res.send({ success: true, data: normalizeSession(session, gameMap, roleNameMap) });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
