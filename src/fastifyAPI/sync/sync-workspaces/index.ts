import { readminCollections } from '~/services/mongo.service';
import SyncInactivity from './inactivity/index';
import SyncMembers from './members/index';
import SyncRoles from './roles/index';
import calculateSessionCounts from "~/services/businessLogic/calculateSessionCounts";
import SyncDepartments from './departments';
import { Workspace } from '~/services/NewMongoTypes';

export async function SyncWorkspace(workspace: Workspace) {
    if (!workspace) return;
    try {
        console.time(`syncing-${workspace.groupId}`);
        await SyncRoles(workspace);
        // Run the per-workspace child syncs sequentially to keep the peak memory
        // footprint of a single workspace bounded. For very large groups (100k+ members)
        // SyncMembers alone can hold tens of MB of working data; running it alongside
        // SyncInactivity / SyncDepartments / calculateSessionCounts concurrently
        // multiplies that and causes V8 heap-limit OOMs.
        await SyncMembers(workspace);
        await SyncInactivity(workspace);
        await SyncDepartments(workspace);
        await calculateSessionCounts(workspace, undefined, false);
        console.timeEnd(`syncing-${workspace.groupId}`);
    } catch (error) {
        console.error(`Sync workspace error ${workspace?.groupName}`, error);
    }
}

// How many workspaces we are willing to sync concurrently per cron tick.
// The cron runs every minute and only picks workspaces whose `lastSynced` has
// aged past the eligibility threshold, so a small concurrency here combined with
// the per-tick batch limit below naturally staggers large fleets across many ticks.
const WORKSPACE_SYNC_CONCURRENCY = Number(process.env.WORKSPACE_SYNC_CONCURRENCY) || 3;
// Maximum number of workspaces claimed for syncing in a single cron tick. Acts as
// a back-pressure valve: with a 1-minute cron and 30-min premium eligibility,
// this caps the queue depth and bounds memory usage.
const WORKSPACE_SYNC_BATCH = Number(process.env.WORKSPACE_SYNC_BATCH) || 15;

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
    if (items.length === 0) return;
    const limit = Math.max(1, Math.min(concurrency, items.length));
    let cursor = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (true) {
            const idx = cursor++;
            if (idx >= items.length) return;
            const item = items[idx];
            if (item === undefined) continue;
            try {
                await fn(item);
            } catch (err) {
                console.error('runWithConcurrency task error', err);
            }
        }
    });
    await Promise.all(workers);
}

export const syncWorkspaces = async () => {
    console.log('Syncing workspaces');
    try {
        const twelveHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 12);
        const thirtyMinutesAgo = new Date(Date.now() - 1000 * 60 * 30);
        const twentyMinutesAgo = new Date(Date.now() - 1000 * 60 * 20);

        // Pick the oldest-synced workspaces first so the fleet is processed fairly
        // when the eligible set is larger than what we can drain in a single tick.
        const workspaces = await readminCollections.workspace.find({
            $or: [
                { lastSynced: { $exists: false } },
                { "premium.is": false, lastSynced: { $lte: twelveHoursAgo } },
                { "premium.is": true, lastSynced: { $lte: thirtyMinutesAgo } },
            ],
        })
            .sort({ lastSynced: 1 })
            .limit(WORKSPACE_SYNC_BATCH)
            .toArray();

        if (workspaces.length === 0) {
            console.log('No workspaces eligible for sync this tick');
            return true;
        }

        console.log(`Syncing ${workspaces.length} workspaces (concurrency=${WORKSPACE_SYNC_CONCURRENCY})`);

        // Mark all claimed workspaces as syncing up-front in a single bulk update so
        // overlapping cron ticks don't re-claim them while we're still working.
        const claimedIds = workspaces.map(w => w._id);
        await readminCollections.workspace.updateMany(
            { _id: { $in: claimedIds } },
            { $set: { syncing: true, lastSynced: new Date() } }
        );

        await runWithConcurrency(workspaces, WORKSPACE_SYNC_CONCURRENCY, SyncWorkspace);

        // Reset syncing flag for any workspace that is still marked as syncing
        await readminCollections.workspace.updateMany(
            {
                lastSynced: { $gt: twentyMinutesAgo },
                syncing: true,
            },
            { $set: { syncing: false, lastSyncProblem: new Date() } }
        );

        console.log('Finished syncing workspaces');
    } catch (error) {
        console.error('Error syncing workspaces', error);
    }

    return true;
};
