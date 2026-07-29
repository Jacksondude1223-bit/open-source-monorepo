import { FastifyRequest, FastifyReply } from 'fastify';
import { reviewTimeOffRequest } from '~/fastifyAPI/apiHandlers/timeOff/reviewTimeOffRequest';

export const declineTimeOff = (req: FastifyRequest<{
    Params: { requestId: string };
    Body: { actorId: string; note?: string };
}>, res: FastifyReply) => reviewTimeOffRequest(req, res, 'denied');
