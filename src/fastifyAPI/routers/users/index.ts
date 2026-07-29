import { FastifyInstance } from 'fastify';
import { syncUser } from '~/fastifyAPI/apiHandlers/users/syncUser';

export const usersRouter = async (fastify: FastifyInstance) => {
    fastify.post('/:userId/sync', { config: { workspaceFromLoaderId: true } }, syncUser);
};
