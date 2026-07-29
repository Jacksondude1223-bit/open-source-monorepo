import 'module-alias/register';
import 'dotenv/config';

import cron from 'node-cron';
import { syncSessionMessaging } from './sync/sync-session-messaging';
import { syncBans } from './sync/sync-bans';
import { syncGameKiller } from './sync/sync-game-killer';
import { syncRanking } from './sync/sync-ranking';
import { syncWorkspaces } from './sync/sync-workspaces';
import { syncTaskReminders } from './sync/sync-task-reminders';
import { syncDistributions } from './sync/sync-distributions';
import { syncUserInfo } from './sync/sync-user-info';
import { syncMemberMilestones } from './sync/sync-member-milestones';
import setupDiscordCommands from './sync/setup-discord-commands';
import { runScheduleFlows } from '~/services/flows/flowEngine.service';

async function main() {
    console.log('Starting sync service...');
    try {
        /*
        1 minute jobs
        internal-session-messaging-prod-schedule
        internal-sync-bans-prod-schedule
        internal-sync-game-killer-prod-schedule
        internal-sync-ranking-prod-schedule
        internal-sync-workspaces-prod-schedule
        */


        console.log('Setting up Discord commands...');
        setupDiscordCommands().then(() => {
            console.log('Discord commands setup completed.');
        }).catch((err: any) => {
            console.error('Error setting up Discord commands:', err);
        })

        cron.schedule('*/1 * * * *', async () => {
            console.log('Running sync tasks...');
            await Promise.all([
                syncSessionMessaging(),
                syncBans(),
                syncGameKiller(),
                syncRanking(),
                syncWorkspaces(),
                syncTaskReminders(),
                runScheduleFlows()
            ]).catch(err => console.error('Error in sync tasks:', err));
            console.log('Sync tasks completed.');
        });

        // Hourly — distributions run at local midnight on each workspace's
        // configured day/timezone, so this must run every hour to catch them.
        cron.schedule('0 * * * *', async () => {
            console.log('Running hourly distribution sync...');
            await syncDistributions();
            console.log('Hourly distribution sync completed.');
        });

        // Daily at midnight UTC — refresh user names, displayNames, and thumbnails
        cron.schedule('0 0 * * *', async () => {
            console.log('Running daily user info sync...');
            await syncUserInfo();
            console.log('Daily user info sync completed.');
        });

        // Every 10 minutes — poll Roblox for group member counts and post Discord
        // milestone messages for workspaces that have the feature enabled.
        cron.schedule('*/10 * * * *', async () => {
            console.log('Running member milestone poll...');
            await syncMemberMilestones().catch(err => console.error('Error in member milestone poll:', err));
            console.log('Member milestone poll completed.');
        });

        console.log('Sync service started successfully.');


    } catch (err) {
        console.error(err);
    }
}

main()