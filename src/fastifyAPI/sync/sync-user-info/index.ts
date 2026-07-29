import { readminCollections } from '~/services/mongo.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { openCloudGetUserInfo, openCloudGenerateUserThumbnail, PerformingAs } from '~/services/opencloud.roblox.service';
import { indexRobloxUser } from '~/services/opensearch.service';
import proxyFetch from '~/utils/proxyFetch';

const DEFAULT_THUMBNAIL = 'https://cdn.readmin.app/readmin-public/backon-hair.png';
const BATCH_SIZE = 5; // Process 5 users at a time to stay well within rate limits

// How long a user must wait between on-demand (manual / API-triggered) refreshes.
// Prevents abuse of the public "refresh this user" button / endpoint while still
// letting the daily batch job run freely.
export const MANUAL_SYNC_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Roblox thumbnail CDN URLs are time-limited signed links, and a freshly
 * generated thumbnail can briefly 404 / serve a placeholder while Roblox
 * re-renders the avatar after a user changes their outfit. A quick HEAD
 * request tells us whether the URL actually resolves to an image so we never
 * persist a broken/expired link (which shows up as a blank icon in the UI).
 */
async function isThumbnailReachable(url: string): Promise<boolean> {
    if (!url || url === DEFAULT_THUMBNAIL) return false;
    try {
        const response = await proxyFetch(url, { method: 'HEAD' }, true, 1);
        if (!response.ok) return false;
        // A real avatar image is served as an image/* content type. Roblox returns
        // an HTML error / redirect page for expired or not-yet-rendered thumbnails.
        const contentType = response.headers.get('Content-Type') || '';
        return contentType.startsWith('image/');
    } catch {
        return false;
    }
}

/**
 * Refreshes a single user's info (name, displayName, description, thumbnail) in the
 * canonical `roblox_user` collection and keeps the OpenSearch index in sync.
 *
 * Shared by the daily batch job and the on-demand (manual / API) refresh path so the
 * exact same persistence/self-healing logic is used in both. Calls are made via
 * OpenCloud using the supplied OAuth-linked group.
 *
 * Returns `true` when the user was updated, `false` when OpenCloud could not resolve
 * the user (or an error occurred).
 */
export async function syncSingleUserInfo(
    performingAs: PerformingAs,
    groupId: string,
    userId: number | string,
): Promise<boolean> {
    const userIdStr = userId.toString();

    try {
        // Fetch user info (name, displayName) via OpenCloud
        const userInfo = await openCloudGetUserInfo(performingAs, groupId, userIdStr);

        // Fetch thumbnail via OpenCloud (separate rate limit)
        const thumbnailUrl = await openCloudGenerateUserThumbnail(
            performingAs, groupId, userIdStr,
            150, 'PNG', 'ROUND'
        );

        if (userInfo === false) {
            return false;
        }

        const numericUserId = typeof userId === 'number' ? userId : parseInt(userIdStr);

        // Pull the currently-stored thumbnail so we can decide whether to keep it.
        const existing = await readminCollections.roblox_user.findOne(
            { id: numericUserId },
            { projection: { headshotUrl: 1 } },
        );
        const existingThumbnail = existing?.headshotUrl;

        // Decide which thumbnail to persist. Priority:
        //   1. A freshly generated thumbnail that actually resolves to an image.
        //   2. The existing stored thumbnail, if it still resolves (avoid blanking a
        //      good icon just because OpenCloud was rate-limited / returned a pending
        //      placeholder this run).
        //   3. The default placeholder as a last resort.
        // This also self-heals expired CDN URLs: when the stored link no longer resolves
        // and we couldn't render a new one, we fall back to the default instead of leaving
        // a broken/blank icon.
        let headshotUrl: string;
        if (thumbnailUrl && await isThumbnailReachable(thumbnailUrl)) {
            headshotUrl = thumbnailUrl;
        } else if (existingThumbnail && await isThumbnailReachable(existingThumbnail)) {
            headshotUrl = existingThumbnail;
        } else {
            headshotUrl = DEFAULT_THUMBNAIL;
        }

        // Update roblox_user (canonical source of user data)
        // name/displayName are only stored here — group_member no longer duplicates them.
        // The lowercased fields MUST be kept in sync with name/displayName — they back the
        // index-eligible prefix/exact search used by @-tagging and member search. Because this
        // job also bumps cacheInfo.lastUpdated daily, getRobloxUserById always treats the record
        // as fresh and never runs its own refresh, so if we skip these here a username change
        // never propagates to search/tagging.
        const updated = await readminCollections.roblox_user.findOneAndUpdate(
            { id: numericUserId },
            {
                $set: {
                    name: userInfo.name,
                    nameLower: (userInfo.name || '').toLowerCase(),
                    displayName: userInfo.displayName,
                    displayNameLower: (userInfo.displayName || '').toLowerCase(),
                    description: userInfo.about || '',
                    headshotUrl,
                    'cacheInfo.lastUpdated': new Date(),
                },
                $setOnInsert: {
                    id: numericUserId,
                    'cacheInfo.created': new Date(),
                },
            },
            { upsert: true, returnDocument: 'after' },
        );

        // Keep the OpenSearch index in sync so search-as-you-type / tagging resolve the
        // new username. Fire-and-forget — a search index miss must never fail the sync.
        indexRobloxUser({
            id: numericUserId,
            name: userInfo.name,
            displayName: userInfo.displayName,
            headshotUrl,
            hasVerifiedBadge: updated?.hasVerifiedBadge,
            isBanned: updated?.isBanned,
        }).catch(() => { });

        return true;
    } catch (err) {
        console.error(`[syncUserInfo] Error updating user ${userIdStr}:`, err);
        sendReAdminInternalWebhookMessage('openCloudErrors', 'red', `Error syncing user ${userIdStr}`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
        return false;
    }
}

export type OnDemandSyncResult =
    | { success: true; status: 'synced'; lastUpdated: Date }
    | { success: false; status: 'cooldown'; retryAfterSeconds: number; lastUpdated: Date }
    | { success: false; status: 'no_oauth' }
    | { success: false; status: 'error' };

/**
 * On-demand refresh of a single user, intended for the public "refresh user" button
 * and the external API. Enforces a per-user cooldown ({@link MANUAL_SYNC_COOLDOWN_MS})
 * based on the canonical record's `cacheInfo.lastUpdated` so it can't be spammed.
 *
 * Pass `force` to bypass the cooldown (e.g. an internal/admin caller).
 */
export async function syncUserInfoOnDemand(
    userId: number | string,
    opts: { force?: boolean } = {},
): Promise<OnDemandSyncResult> {
    const numericUserId = typeof userId === 'number' ? userId : parseInt(userId.toString());

    // Enforce the cooldown against the last time this record was refreshed (by any path).
    if (!opts.force) {
        const existing = await readminCollections.roblox_user.findOne(
            { id: numericUserId },
            { projection: { 'cacheInfo.lastUpdated': 1 } },
        );
        const lastUpdated = existing?.cacheInfo?.lastUpdated;
        if (lastUpdated) {
            const elapsed = Date.now() - new Date(lastUpdated).getTime();
            if (elapsed < MANUAL_SYNC_COOLDOWN_MS) {
                return {
                    success: false,
                    status: 'cooldown',
                    retryAfterSeconds: Math.ceil((MANUAL_SYNC_COOLDOWN_MS - elapsed) / 1000),
                    lastUpdated: new Date(lastUpdated),
                };
            }
        }
    }

    // We need an OAuth-linked group to call OpenCloud as. Prefer a group the user is
    // actually a member of, otherwise fall back to any linked workspace.
    const oauthLinks = await readminCollections.group_oauth_authorization.find({}).toArray();
    if (oauthLinks.length === 0) {
        return { success: false, status: 'no_oauth' };
    }

    const linkedGroupIds = new Set(oauthLinks.map(link => link.groupId));
    const membership = await readminCollections.group_member.findOne({
        userId: numericUserId,
        groupId: { $in: Array.from(linkedGroupIds) },
    }, { projection: { groupId: 1 } });

    const groupId = membership?.groupId ?? oauthLinks[0]!.groupId;

    const ok = await syncSingleUserInfo('group', groupId, numericUserId);
    if (!ok) {
        return { success: false, status: 'error' };
    }

    return { success: true, status: 'synced', lastUpdated: new Date() };
}

/**
 * Daily batch job that refreshes user info (name, displayName, thumbnail) for all
 * tracked group members, updating both the canonical `roblox_user` collection and
 * the denormalized `group_member.name` / `group_member.displayName` fields.
 *
 * Uses OpenCloud OAuth APIs so thumbnails come from the authenticated endpoint.
 * Designed to run once per day around midnight via cron.
 */
export async function syncUserInfo(): Promise<void> {
    console.log('[syncUserInfo] Starting daily user info sync...');
    const startTime = Date.now();

    try {
        // Find all workspaces that have an active OAuth link (we need a token to call OpenCloud)
        const oauthLinks = await readminCollections.group_oauth_authorization.find({}).toArray();
        const linkedGroupIds = new Set(oauthLinks.map(link => link.groupId));

        if (linkedGroupIds.size === 0) {
            console.log('[syncUserInfo] No OAuth-linked workspaces found, skipping.');
            return;
        }

        // Collect all unique user IDs across all linked groups
        const allMembers = await readminCollections.group_member.find({
            groupId: { $in: Array.from(linkedGroupIds) },
        }).toArray();

        // Deduplicate by userId — many users appear in multiple groups
        const uniqueUserIds = [...new Set(allMembers.map(m => m.userId))];
        console.log(`[syncUserInfo] Found ${uniqueUserIds.length} unique users across ${linkedGroupIds.size} workspaces`);

        // Pick the first available OAuth-linked group to perform API calls as
        const primaryGroupId = oauthLinks[0]!.groupId;
        const performingAs: PerformingAs = 'group';

        let updatedCount = 0;
        let failedCount = 0;

        // Process in batches
        for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
            const batch = uniqueUserIds.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (userId) => {
                const ok = await syncSingleUserInfo(performingAs, primaryGroupId, userId);
                if (ok) {
                    updatedCount++;
                } else {
                    failedCount++;
                }
            }));

            // Log progress every 100 users
            if ((i + BATCH_SIZE) % 100 < BATCH_SIZE) {
                console.log(`[syncUserInfo] Progress: ${Math.min(i + BATCH_SIZE, uniqueUserIds.length)}/${uniqueUserIds.length} users processed`);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[syncUserInfo] Completed: ${updatedCount} updated, ${failedCount} failed, ${elapsed}s elapsed`);
    } catch (error) {
        console.error('[syncUserInfo] Fatal error:', error);
    }
}
