import { FastifyInstance } from 'fastify';
import { acceptJoinRequest } from '~/fastifyAPI/apiHandlers/ranking/acceptJoinRequest';
import { changeUserRank } from '~/fastifyAPI/apiHandlers/ranking/changeUserRank';
import { declineJoinRequest } from '~/fastifyAPI/apiHandlers/ranking/declineJoinRequest';
import { exile } from '~/fastifyAPI/apiHandlers/ranking/exile';
import { getJoinRequests } from '~/fastifyAPI/apiHandlers/ranking/getJoinRequests';
import { getRankingKey } from '~/fastifyAPI/apiHandlers/ranking/getRankingKey';
import { shout } from '~/fastifyAPI/apiHandlers/ranking/shout';

export const rankingRouter = async (fastify: FastifyInstance) => {
    fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
        if (!body) return done(null, {}); // Treat empty as {}
        try {
            const json = JSON.parse(body as string);
            done(null, json);
        } catch (err: any) {
            done(err);
        }
    });
    fastify.get('/', { config: { parseAs: 'string', rankingKey: true } }, getRankingKey);
    fastify.get('/join-requests', { config: { parseAs: 'string', rankingKey: true } }, getJoinRequests);
    fastify.patch('/join-requests/:userId', { config: { parseAs: 'string', rankingKey: true } }, acceptJoinRequest);
    fastify.delete('/join-requests/:userId', { config: { parseAs: 'string', rankingKey: true } }, declineJoinRequest);
    fastify.patch('/shout', { config: { parseAs: 'string', rankingKey: true } }, shout);
    fastify.delete('/users/:userId', { config: { parseAs: 'string', rankingKey: true } }, exile);
    fastify.put('/users/:userId/role/:rankId', { config: { parseAs: 'string', rankingKey: true } }, changeUserRank);
};