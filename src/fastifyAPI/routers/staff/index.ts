import { FastifyInstance } from 'fastify';
import { createHistoryAPI } from '~/fastifyAPI/apiHandlers/staff/createHistory';
import { getHistory } from '~/fastifyAPI/apiHandlers/staff/getHistory';

export const staffRouter = async (fastify: FastifyInstance) => {
    fastify.get('/history', { config: { workspaceFromLoaderId: true } }, getHistory);
    fastify.post('/history', { config: { workspaceFromLoaderId: true } }, createHistoryAPI);
};