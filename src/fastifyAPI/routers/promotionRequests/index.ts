import { FastifyInstance } from 'fastify';
import { getPromotionRequest } from '~/fastifyAPI/apiHandlers/promotionRequests/getPromotionRequest';
import { getPromotionRequests } from '~/fastifyAPI/apiHandlers/promotionRequests/getPromotionRequests';

export const promotionRequestsRouter = async (fastify: FastifyInstance) => {
    fastify.get('/', { config: { workspaceFromLoaderId: true } }, getPromotionRequests);
    fastify.get('/:requestId', { config: { workspaceFromLoaderId: true } }, getPromotionRequest);
};
