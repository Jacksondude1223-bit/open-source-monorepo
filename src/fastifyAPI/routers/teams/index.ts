import { FastifyInstance } from 'fastify';
import { getTeam } from '~/fastifyAPI/apiHandlers/teams/getTeam';
import { getTeams } from '~/fastifyAPI/apiHandlers/teams/getTeams';
import { getUserTeams } from '~/fastifyAPI/apiHandlers/teams/getUserTeams';

export const teamsRouter = async (fastify: FastifyInstance) => {
    fastify.get('/', { config: { workspaceFromLoaderId: true } }, getTeams);
    fastify.get('/users/:userId', { config: { workspaceFromLoaderId: true } }, getUserTeams);
    fastify.get('/:teamId', { config: { workspaceFromLoaderId: true } }, getTeam);
};
