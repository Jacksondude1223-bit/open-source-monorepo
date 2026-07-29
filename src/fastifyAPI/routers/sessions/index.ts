import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { claimSessionRole } from '~/fastifyAPI/apiHandlers/sessions/claimSessionRole';
import { createSessionServer } from '~/fastifyAPI/apiHandlers/sessions/createSessionServer';
import { getSession } from '~/fastifyAPI/apiHandlers/sessions/getSession';
import { getSessionRoles } from '~/fastifyAPI/apiHandlers/sessions/getSessionRoles';
import { getSessions } from '~/fastifyAPI/apiHandlers/sessions/getSessions';
import { getUpcomingSessions } from '~/fastifyAPI/apiHandlers/sessions/getUpcomingSessions';

export const sessionsRouter = async (fastify: FastifyInstance) => {
    fastify.get('/', { config: { workspaceFromLoaderId: true } }, getSessions);
    fastify.get('/upcoming', { config: { workspaceFromLoaderId: true } }, getUpcomingSessions);
    fastify.get('/roles', { config: { workspaceFromLoaderId: true } }, getSessionRoles);
    fastify.get('/:sessionId', { config: { workspaceFromLoaderId: true } }, getSession);
    fastify.post('/:sessionId/servers', { config: { workspaceFromLoaderId: true } }, createSessionServer);
    fastify.post('/:sessionId/servers/:serverId/roles', { config: { workspaceFromLoaderId: true } }, claimSessionRole);
};