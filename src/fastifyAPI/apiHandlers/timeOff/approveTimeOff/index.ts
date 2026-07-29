import { FastifyRequest, FastifyReply } from 'fastify';
import { reviewTimeOffRequest } from '~/fastifyAPI/apiHandlers/timeOff/reviewTimeOffRequest';

export const approveTimeOff = (req: FastifyRequest<{
    Params: { requestId: string };
    Body: { actorId: string; note?: string };
}>, res: FastifyReply) => reviewTimeOffRequest(req, res, 'approved');
