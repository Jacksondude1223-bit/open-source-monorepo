import { FastifyInstance } from 'fastify';
import { createServer } from '~/fastifyAPI/apiHandlers/activity/createServer';
import { endServer } from '~/fastifyAPI/apiHandlers/activity/endServer';
import { getCommands } from '~/fastifyAPI/apiHandlers/activity/getCommands';
import { getCommandsForPlayers } from '~/fastifyAPI/apiHandlers/activity/getCommandsForPlayers';
import { getServer } from '~/fastifyAPI/apiHandlers/activity/getServer';
import { playerJoin } from '~/fastifyAPI/apiHandlers/activity/playerJoin';
import { playerLeave } from '~/fastifyAPI/apiHandlers/activity/playerLeave';
import { playerLeaveV2 } from '~/fastifyAPI/apiHandlers/activity/playerLeaveV2';
import { reportError } from '~/fastifyAPI/apiHandlers/activity/reportError';
import { sendCommands } from '~/fastifyAPI/apiHandlers/activity/sendCommands';
import { sendData } from '~/fastifyAPI/apiHandlers/activity/sendData';
import { verifyLink } from '~/fastifyAPI/apiHandlers/activity/verifyLink';
import { consent } from '~/fastifyAPI/apiHandlers/activity/consent';
import { supportCreate } from '~/fastifyAPI/apiHandlers/activity/support/create';
import { supportEnd } from '~/fastifyAPI/apiHandlers/activity/support/end';
import { getWorkspace } from '~/fastifyAPI/apiHandlers/activity/workspace';
import { getLeaderboard } from '~/fastifyAPI/apiHandlers/activity/workspace/leaderboard';
import { getUserMinutes } from '~/fastifyAPI/apiHandlers/activity/workspace/userMinutes';
import { getUserActivity } from '~/fastifyAPI/apiHandlers/activity/workspace/userActivity';

export const activityRouter = async (activity: FastifyInstance) => {
    activity.post('/createServer', { config: { workspaceFromLoaderId: true } }, createServer);
    activity.delete('/endServer', { config: { getRunningServer: true } }, endServer);
    activity.post('/getServer', { config: { getRunningServer: true } }, getServer);
    activity.post('/playerJoin', { config: { getRunningServer: true } }, playerJoin);
    activity.delete('/playerLeave', { config: { getRunningServer: true } }, playerLeave);
    activity.post('/playerLeave/v2', { config: { getRunningServer: true } }, playerLeaveV2);
    activity.post('/reportError', { config: { workspaceFromLoaderId: true } }, reportError);
    activity.post('/sendData', { config: { getRunningServer: true } }, sendData);
    activity.post('/verifyLink', { config: { getRunningServer: true } }, verifyLink);
    activity.post('/consent', { config: { getRunningServer: true } }, consent);

    activity.get('/workspace/', { config: { workspaceFromLoaderId: true } }, getWorkspace)
    activity.get('/workspace/leaderboard', { config: { workspaceFromLoaderId: true } }, getLeaderboard)
    activity.get('/workspace/users/:userId/minutes', { config: { workspaceFromLoaderId: true } }, getUserMinutes)
    activity.get('/workspace/users/:userId/activity', { config: { workspaceFromLoaderId: true } }, getUserActivity)

    activity.get('/commands', { config: { workspaceFromLoaderId: true } }, getCommands)
    activity.post('/commands', { config: { getRunningServer: true } }, sendCommands)
    activity.get('/commands/players/permissions', { config: { getRunningServer: true } }, getCommandsForPlayers)


    activity.post('/support/create', { config: { getRunningServer: true } }, supportCreate)
    activity.post('/support/end', { config: { getRunningServer: true } }, supportEnd)

}