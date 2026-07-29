import { FastifyInstance } from 'fastify';
import { createBan } from '~/fastifyAPI/apiHandlers/games/create-ban';
import { deleteBan } from '~/fastifyAPI/apiHandlers/games/delete-ban';
import { getBans } from '~/fastifyAPI/apiHandlers/games/get-bans';
import { getRunningGame } from '~/fastifyAPI/apiHandlers/games/getRunningGame';
import { getRunningGames } from '~/fastifyAPI/apiHandlers/games/getRunningGames';

export const gamesRouter = async (fastify: FastifyInstance) => {
    fastify.get('/bans', { config: { workspaceFromLoaderId: true } }, getBans);
    fastify.post('/bans', { config: { workspaceFromLoaderId: true } }, createBan);
    fastify.delete('/bans', { config: { workspaceFromLoaderId: true } }, deleteBan);

    fastify.get('/running', { config: { workspaceFromLoaderId: true } }, getRunningGames);
    fastify.get('/running/:internalGameId', { config: { workspaceFromLoaderId: true } }, getRunningGame);

};