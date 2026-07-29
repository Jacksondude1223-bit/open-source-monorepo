import { FastifyInstance } from 'fastify';
import { billingHandler } from '~/fastifyAPI/apiHandlers/internal/api_routes/billing';
import { discordHandler } from '~/fastifyAPI/apiHandlers/internal/api_routes/discord';

export const internalRouter = async (fastify: FastifyInstance) => {
    await fastify.register(import('fastify-raw-body'), {
        field: 'rawBody',   // the property that will appear on `request`
        global: false,      // only routes that ask for it get it
        encoding: 'utf8',
        runFirst: true      // grab the bytes before any other parser touches them
    });

    fastify.post('/billing', { config: { rawBody: true } }, billingHandler);
    fastify.post('/discord', discordHandler)
};
