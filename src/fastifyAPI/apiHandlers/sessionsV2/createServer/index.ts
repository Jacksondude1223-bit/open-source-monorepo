import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 } from 'uuid';
import StringToObjectID from '~/utils/StringToObjectID';
import { readminCollections } from '~/services/mongo.service';
import {
    buildRoleNameMap,
    normalizeServer,
} from '~/fastifyAPI/apiHandlers/sessionsV2/_normalize';
import { SessionServerType } from '~/services/NewMongoTypes';

// POST /sessions/v2/:sessionId/servers
// Adds a server to a session. Accepts an optional nickname. Returns the newly
// created server in normalized form (no need to re-fetch the whole session).
export const createServer = async (req: FastifyRequest<{
    Params: { sessionId: string };
    Body: { nickname?: string };
}>, res: FastifyReply) => {
    const { workspace, body } = req;
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

        const serverId = v4();
        const newServer: SessionServerType = {
            linkedToServer: false,
            claims: {},
            attendees: {},
            ...(body?.nickname ? { nickname: body.nickname } : {}),
        };

        await readminCollections.session.updateOne(
            { _id: session._id },
            { $set: { [`servers.${serverId}`]: newServer } },
        );

        const roleNameMap = await buildRoleNameMap(workspace.groupId);

        return res.status(201).send({
            success: true,
            data: normalizeServer(serverId, newServer, roleNameMap),
        });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
