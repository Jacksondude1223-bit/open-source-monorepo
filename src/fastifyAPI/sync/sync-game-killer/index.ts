import ClearBadRunningGame from './clearOld';
import EndOldPlayerSessions from './oldPlayers';
import ClearBadRunningGames from './clearRunningGamePlayers';

export const syncGameKiller = async () => {
    console.log('Killing games')
    await Promise.all([ClearBadRunningGame(), EndOldPlayerSessions(), ClearBadRunningGames()]);
    console.log('Finished killing games')
    return true;
};