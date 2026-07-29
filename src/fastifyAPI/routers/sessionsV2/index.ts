import { FastifyInstance } from 'fastify';
import { claimRole } from '~/fastifyAPI/apiHandlers/sessionsV2/claimRole';
import { createServer } from '~/fastifyAPI/apiHandlers/sessionsV2/createServer';
import { getSession } from '~/fastifyAPI/apiHandlers/sessionsV2/getSession';
import { listRoles } from '~/fastifyAPI/apiHandlers/sessionsV2/listRoles';
import { listSessions } from '~/fastifyAPI/apiHandlers/sessionsV2/listSessions';
import { releaseClaim } from '~/fastifyAPI/apiHandlers/sessionsV2/releaseClaim';

// Sessions API v2 — a ground-up replacement for the awkward v1 session
// endpoints: consistent envelopes, fully-normalized resources, filtering and
// cursor pagination.
//
// Routes are registered with ABSOLUTE paths (no Fastify prefix) on purpose: it
// guarantees the exact `/sessions/v2` node owns the list handler, so a request
// to `GET /sessions/v2` can never fall through to the v1 `/sessions/:sessionId`
// parametric route.
export const sessionsV2Router = async (fastify: FastifyInstance) => {
    const cfg = { config: { workspaceFromLoaderId: true } } as const;

    fastify.get('/sessions/v2', cfg, listSessions);
    fastify.get('/sessions/v2/roles', cfg, listRoles);
    fastify.get('/sessions/v2/:sessionId', cfg, getSession);
    fastify.post('/sessions/v2/:sessionId/servers', cfg, createServer);
    fastify.post('/sessions/v2/:sessionId/servers/:serverId/claims', cfg, claimRole);
    fastify.delete('/sessions/v2/:sessionId/servers/:serverId/claims/:userId', cfg, releaseClaim);
};
