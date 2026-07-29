import { FastifyInstance } from 'fastify';
import { claimCall } from '~/fastifyAPI/apiHandlers/calls/claimCall';
import { endCall } from '~/fastifyAPI/apiHandlers/calls/endCall';
import { getCall } from '~/fastifyAPI/apiHandlers/calls/getCall';
import { getCallMessages } from '~/fastifyAPI/apiHandlers/calls/getCallMessages';
import { getCalls } from '~/fastifyAPI/apiHandlers/calls/getCalls';
import { sendCallMessage } from '~/fastifyAPI/apiHandlers/calls/sendCallMessage';

export const callsRouter = async (fastify: FastifyInstance) => {
    fastify.get('/', { config: { workspaceFromLoaderId: true } }, getCalls);
    fastify.get('/:callId', { config: { workspaceFromLoaderId: true } }, getCall);
    fastify.get('/:callId/messages', { config: { workspaceFromLoaderId: true } }, getCallMessages);
    fastify.post('/:callId/messages', { config: { workspaceFromLoaderId: true } }, sendCallMessage);
    fastify.put('/:callId/claim', { config: { workspaceFromLoaderId: true } }, claimCall);
    fastify.put('/:callId/end', { config: { workspaceFromLoaderId: true } }, endCall);
};
