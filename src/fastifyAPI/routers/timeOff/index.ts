import { FastifyInstance } from 'fastify';
import { approveTimeOff } from '~/fastifyAPI/apiHandlers/timeOff/approveTimeOff';
import { declineTimeOff } from '~/fastifyAPI/apiHandlers/timeOff/declineTimeOff';
import { getTimeOff } from '~/fastifyAPI/apiHandlers/timeOff/getTimeOff';
import { getTimeOffRequest } from '~/fastifyAPI/apiHandlers/timeOff/getTimeOffRequest';

export const timeOffRouter = async (fastify: FastifyInstance) => {
    fastify.get('/', { config: { workspaceFromLoaderId: true } }, getTimeOff);
    fastify.get('/:requestId', { config: { workspaceFromLoaderId: true } }, getTimeOffRequest);
    fastify.put('/:requestId/approve', { config: { workspaceFromLoaderId: true } }, approveTimeOff);
    fastify.put('/:requestId/decline', { config: { workspaceFromLoaderId: true } }, declineTimeOff);
};
