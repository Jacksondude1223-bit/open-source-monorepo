import proxyFetch from "../utils/proxyFetch";
import { env } from "~/services/env";
import { RobloxOAuthAuthorizationExchangeResponse, RobloxOAuthAuthorizationRefreshResponse, RobloxOpenCloudGroupMemberResponse, RobloxOpenCloudGroupRoleResponse, RobloxOpenCloudPlaceType, RobloxOpenCloudThumbnailResponse, RobloxOpenCloudUniverseType, RobloxOpenCloudUserInformation, RobloxOpenCloudUserType } from "./types/roblox.opencloud.types";
import { decrypt, encrypt } from "./Crypto-service.service";
import { readminCollections } from '~/services/mongo.service';
import { GroupOAuthAuthorization, User } from "./NewMongoTypes";
import { dmUserDiscord, sendReAdminInternalWebhookMessage } from "./discord.service";
import redisClient, { redisNamespace } from "./redis.client";
import { robloxApiRequest } from "./roblox.service";

// Utility functions for OpenCloud OAuth2

export type PerformingAs = 'user' | 'group';

// Mutex map to prevent concurrent refresh token usage (single-use tokens!)
// This only covers concurrency *within one process*. ReAdmin runs the Next
// server, the Fastify API and the sync worker as separate processes against the
// same database, so it is not on its own enough — see withRefreshLock below.
const refreshLocks = new Map<string, Promise<string | false>>();

// ── Cross-process refresh lock ────────────────────────────────────────────────
// Roblox refresh tokens are single-use: a successful refresh rotates the token
// and invalidates the old one. If two processes refresh the same link at once,
// one of them rotates first and the other's request either 429s or comes back
// invalid_grant — and whichever writes last can store a token Roblox has
// already retired, permanently breaking the link until someone re-authorizes.
// That is the failure mode behind "ranking stopped working, relinking OAuth
// fixed it". The rate limiter next door is already Redis-backed for the same
// reason; the refresh path needs to be too.
const REFRESH_LOCK_TTL_MS = 30_000;
const REFRESH_LOCK_WAIT_MS = 15_000;
const REFRESH_LOCK_POLL_MS = 250;

// Release only if we still hold the lock, so a lock that expired mid-refresh and
// was picked up by someone else isn't deleted out from under them.
const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
`;

let _refreshLockSeq = 0;

/**
 * Serialises token refreshes for one OAuth link across every ReAdmin process.
 *
 * @param lockName   identifies the link (`group:123` / `user:456`).
 * @param readStored re-reads the stored token, returning it only if it's still
 *                   valid. Called before refreshing so a caller that queued
 *                   behind another process picks up the token that process just
 *                   wrote instead of burning the (now-rotated) refresh token.
 * @param doRefresh  performs the actual refresh + persist.
 */
async function withRefreshLock(
    lockName: string,
    readStored: () => Promise<string | null>,
    doRefresh: () => Promise<string | false>,
): Promise<string | false> {
    const key = `${redisNamespace}:roblox-oauth-refresh-lock:${lockName}`;
    const holder = `${process.pid}:${Date.now()}:${++_refreshLockSeq}`;

    const tryAcquire = async (): Promise<boolean> =>
        (await redisClient.set(key, holder, { NX: true, PX: REFRESH_LOCK_TTL_MS })) === 'OK';

    let acquired: boolean;
    try {
        acquired = await tryAcquire();
    } catch (e) {
        // Redis is down. Refreshing unsynchronised is still better than failing
        // every group action outright — the in-process mutex remains in force.
        console.log('Could not reach Redis for OAuth refresh lock, proceeding unsynchronised', e);
        return doRefresh();
    }

    if (!acquired) {
        // Someone else is refreshing this link. Wait for the token they write.
        const deadline = Date.now() + REFRESH_LOCK_WAIT_MS;
        while (Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, REFRESH_LOCK_POLL_MS));
            const stored = await readStored();
            if (stored) return stored;
            try {
                if (await redisClient.get(key) === null) break; // holder finished or died
            } catch {
                break;
            }
        }
        const stored = await readStored();
        if (stored) return stored;
        // The holder finished without producing a usable token (or died). Take
        // over rather than refreshing in parallel with whoever still holds it.
        try {
            acquired = await tryAcquire();
        } catch {
            acquired = false;
        }
        if (!acquired) return false;
    }

    try {
        // Double-check under the lock: another process may have refreshed
        // between our expiry check and acquiring it.
        const stored = await readStored();
        if (stored) return stored;
        return await doRefresh();
    } finally {
        try {
            await redisClient.eval(RELEASE_LOCK_LUA, { keys: [key], arguments: [holder] });
        } catch {
            // Lock expires on its own.
        }
    }
}

// Tracks which users have already been notified about expired tokens to avoid DM spam.
// Key: robloxId, Value: timestamp when notification was sent. Cleared after 24 hours.
const expiryNotificationsSent = new Map<string, number>();
const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function shouldNotifyUser(robloxId: string): boolean {
    const lastNotified = expiryNotificationsSent.get(robloxId);
    if (lastNotified && Date.now() - lastNotified < NOTIFICATION_COOLDOWN_MS) {
        return false;
    }
    expiryNotificationsSent.set(robloxId, Date.now());
    return true;
}

// Buffer in ms — refresh 60s before actual expiry to avoid edge-case failures
const EXPIRY_BUFFER_MS = 60_000;
// Roblox access tokens last 15 minutes (900s)
const DEFAULT_ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

// ── Roblox Open Cloud OAuth rate limiting ──────────────────────────────────────
// 90 requests per minute per OAuth app user (sliding window, enforced globally via Redis)
const ROBLOX_OAUTH_RATE_LIMIT = 90;
const ROBLOX_OAUTH_RATE_WINDOW_MS = 60_000; // 1 minute

// Thumbnail endpoint has a much stricter limit: 10 requests per minute per app user
const ROBLOX_THUMBNAIL_RATE_LIMIT = 10;
const ROBLOX_THUMBNAIL_RATE_WINDOW_MS = 60_000;

/**
 * Atomic Lua script for sliding-window rate limiting using sorted sets.
 * Cleans expired entries, checks capacity, and — if available — atomically
 * inserts a new entry. Returns:
 *   0          → slot acquired (proceed with request)
 *   timestamp  → oldest entry's score so caller can compute wait time
 *  -1          → fallback (should not normally happen)
 */
const RATE_LIMIT_LUA = `
local key        = KEYS[1]
local now        = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local maxReqs    = tonumber(ARGV[3])
local uid        = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
local count = redis.call('ZCARD', key)
if count < maxReqs then
    redis.call('ZADD', key, now, uid)
    redis.call('EXPIRE', key, 120)
    return 0
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
if #oldest >= 2 then
    return tonumber(oldest[2])
end
return -1
`;

let _rateLimitSeq = 0;

/**
 * Generic Redis-backed sliding window rate limiter.
 * Waits (yields) until a slot is available — never drops requests.
 */
async function waitForRateLimitGeneric(
    redisKey: string,
    maxRequests: number,
    windowMs: number,
    label: string,
): Promise<void> {
    while (true) {
        const now = Date.now();
        const windowStart = now - windowMs;
        const uniqueId = `${now}:${process.pid}:${++_rateLimitSeq}`;

        const result = await redisClient.eval(RATE_LIMIT_LUA, {
            keys: [redisKey],
            arguments: [
                now.toString(),
                windowStart.toString(),
                maxRequests.toString(),
                uniqueId,
            ],
        }) as number;

        if (result === 0) {
            return; // slot acquired
        }

        // Compute how long to wait based on when the oldest request leaves the window
        let waitMs: number;
        if (result > 0) {
            waitMs = (result + windowMs) - Date.now() + 100;
        } else {
            waitMs = 1_000; // fallback
        }
        waitMs = Math.max(waitMs, 500); // floor at 500 ms

        console.log(
            `[OpenCloud Rate Limit] ${label} hit ${maxRequests} req/min limit, waiting ${waitMs}ms`,
        );
        await new Promise(resolve => setTimeout(resolve, waitMs));
    }
}

/**
 * Waits until a rate-limit slot is available for the given OAuth user.
 * Uses a Redis sorted-set sliding window so the limit is enforced globally
 * across all running instances.  Yields (sleeps) instead of dropping requests.
 */
async function waitForRateLimit(performingAs: PerformingAs, performingId: string): Promise<void> {
    const key = `${redisNamespace}:roblox-oauth-ratelimit:${performingAs}:${performingId}`;
    return waitForRateLimitGeneric(key, ROBLOX_OAUTH_RATE_LIMIT, ROBLOX_OAUTH_RATE_WINDOW_MS, `${performingAs}:${performingId}`);
}

/**
 * Waits for a thumbnail-specific rate limit slot (10 req/min per OAuth app user).
 */
async function waitForThumbnailRateLimit(performingAs: PerformingAs, performingId: string): Promise<void> {
    const key = `${redisNamespace}:roblox-oauth-thumbnail-ratelimit:${performingAs}:${performingId}`;
    return waitForRateLimitGeneric(key, ROBLOX_THUMBNAIL_RATE_LIMIT, ROBLOX_THUMBNAIL_RATE_WINDOW_MS, `thumbnail:${performingAs}:${performingId}`);
}

/**
 * Roblox HTTP statuses that represent *expected / benign* failures we don't
 * want to alert on (e.g. user not in group → 404, validation → 400,
 * permission/scope issues → 401/403, rate limits → 429 which we handle by
 * waiting, and auth-expiry which is surfaced to the user via DM).
 * Everything else (mainly 5xx and unexpected codes) is worth a webhook log.
 */
const SILENCED_OPENCLOUD_STATUSES = new Set([400, 401, 403, 429]);

/**
 * Sends a log to the internal Open Cloud errors webhook for *unexpected*
 * Roblox errors only. Benign/expected statuses are silently ignored to avoid
 * spamming the channel. Never throws.
 */
async function reportOpenCloudError(
    context: string,
    status: number,
    body: string,
    performingAs?: PerformingAs,
    performingId?: string,
): Promise<void> {
    if (SILENCED_OPENCLOUD_STATUSES.has(status)) return;
    await sendReAdminInternalWebhookMessage(
        'openCloudErrors',
        'red',
        `Open Cloud Error: ${context}`,
        `**Status:** ${status}\n${performingAs ? `**Performing as:** ${performingAs}:${performingId}\n` : ''}**Response:** ${(body || '(empty)').slice(0, 1500)}`,
    ).catch(() => {});
}

/**
 * Result of a refresh attempt.
 *  - success: the new tokens.
 *  - invalid_grant: the refresh token is genuinely expired/revoked — the user
 *    must re-link. This is the ONLY case where we should DM the user.
 *  - transient: a temporary failure (rate limit, network/proxy error, 5xx).
 *    The link is almost certainly still valid; do NOT notify the user.
 */
type RefreshResult =
    | { kind: 'success'; tokens: RobloxOAuthAuthorizationRefreshResponse }
    | { kind: 'invalid_grant' }
    | { kind: 'transient' };

async function refreshOpenCloudAuthorization(refresh_token: string, retry = false): Promise<RefreshResult> {
    let OAuthTokenRequest;
    try {
        OAuthTokenRequest = await proxyFetch(
            'https://apis.roblox.com/oauth/v1/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: env.ROBLOX_CLIENT_ID,
                    client_secret: env.ROBLOX_CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    refresh_token,
                }),
            },
        );
    } catch (err) {
        // Network/proxy failure — transient, never treat as expired
        console.log('refresh token request threw, treating as transient', err);
        return { kind: 'transient' };
    }

    if (OAuthTokenRequest.status == 429){
        if (retry) {
            console.log('Received 429 again after retrying refresh. Refreshes are serialised per link across processes (withRefreshLock), so this points at a refresh happening outside that lock — investigate before it rotates the token out from under the stored one.', await OAuthTokenRequest.text());
            return { kind: 'transient' };
        }
        console.log('Received 429 from token refresh. Waiting and retrying...', await OAuthTokenRequest.text());
        await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5 seconds before retrying
        return refreshOpenCloudAuthorization(refresh_token, true); // retry
    }

    if (OAuthTokenRequest.status !== 200) {
        const body = await OAuthTokenRequest.text();
        console.log('refresh token failed', body, OAuthTokenRequest.status, OAuthTokenRequest.statusText);

        // Roblox only permanently invalidates a refresh token with a 400 +
        // `invalid_grant`/`invalid_request` (expired or revoked). Anything else
        // (5xx, 401/403 app-config issues, proxy errors) is transient and must
        // NOT trigger an "expired" DM to the user.
        if (OAuthTokenRequest.status === 400 && /invalid_grant|invalid_request/i.test(body)) {
            return { kind: 'invalid_grant' };
        }
        await reportOpenCloudError('Token refresh failed', OAuthTokenRequest.status, body);
        return { kind: 'transient' };
    }

    const response = await OAuthTokenRequest.json() as RobloxOAuthAuthorizationRefreshResponse;
    return { kind: 'success', tokens: response };
}

function isTokenExpired(tokenUpdatedAt?: Date): boolean {
    if (!tokenUpdatedAt) return true;
    const expiresAt = tokenUpdatedAt.getTime() + DEFAULT_ACCESS_TOKEN_LIFETIME_MS - EXPIRY_BUFFER_MS;
    return Date.now() >= expiresAt;
}

async function getOpenCloudAuthorizationToken(performingAs: PerformingAs, identifer: string): Promise<string | false> {
    const lockKey = `${performingAs}:${identifer}`;

    // If there's already a refresh in-flight for this identifier, wait for it
    const existingLock = refreshLocks.get(lockKey);
    if (existingLock) {
        return existingLock;
    }

    const refreshPromise = _getOpenCloudAuthorizationTokenInner(performingAs, identifer);
    refreshLocks.set(lockKey, refreshPromise);

    try {
        return await refreshPromise;
    } finally {
        refreshLocks.delete(lockKey);
    }
}

async function _getOpenCloudAuthorizationTokenInner(performingAs: PerformingAs, identifer: string): Promise<string | false> {
    if (performingAs == 'user') {
        const user = await readminCollections.user.findOne({ robloxId: identifer.toString() }) as User;
        if (!user) {
            return false;
        }
        if (user.accessToken && user.refreshToken) {
            const accessToken = decrypt(user.accessToken);

            // Only use the cached access token if it hasn't expired yet
            if (!isTokenExpired(user.accessTokenUpdatedAt)) {
                return accessToken;
            }

            // Access token expired — refresh it, serialised across processes.
            return withRefreshLock(
                `user:${identifer}`,
                async () => {
                    const latest = await readminCollections.user.findOne({ robloxId: identifer.toString() }) as User | null;
                    if (!latest?.accessToken || isTokenExpired(latest.accessTokenUpdatedAt)) return null;
                    return decrypt(latest.accessToken);
                },
                async () => {
                    // Re-read the refresh token: the copy we loaded above may
                    // have been rotated while we waited for the lock.
                    const latest = await readminCollections.user.findOne({ robloxId: identifer.toString() }) as User | null;
                    if (!latest?.refreshToken) return false;
                    const refreshToken = decrypt(latest.refreshToken);
                    const newAccessToken = await refreshOpenCloudAuthorization(refreshToken);
                    if (newAccessToken.kind !== 'success') {
                        // Only DM the user if the refresh token is genuinely invalid.
                        // Transient failures (rate limits, network/proxy errors, 5xx)
                        // must not spam users whose links are still valid.
                        if (newAccessToken.kind === 'invalid_grant' && shouldNotifyUser(identifer)) {
                            dmUserDiscord(
                                identifer,
                                '⚠️ Your ReAdmin Roblox Open Cloud Link Has Expired',
                                `Your Roblox Community Open Cloud authorization has expired and ReAdmin can no longer perform actions on your behalf. Please sign in again at [your workspace](https://panel.readmin.app) to re-link your account.`,
                                'red'
                            ).catch(() => {});
                        }
                        return false;
                    }

                    await readminCollections.user.updateOne({ robloxId: identifer }, {
                        $set: {
                            accessToken: encrypt(newAccessToken.tokens.access_token),
                            refreshToken: encrypt(newAccessToken.tokens.refresh_token),
                            accessTokenUpdatedAt: new Date(),
                        }
                    });

                    return newAccessToken.tokens.access_token;
                },
            );
        }
        return false;
    }

    // Group path
    const openCloudLink = await readminCollections.group_oauth_authorization.findOne({ groupId: identifer });
    if (!openCloudLink) {
        return false;
    }

    // Only use the cached access token if it hasn't expired yet
    if (openCloudLink.currentAccessToken && !isTokenExpired(openCloudLink.accessTokenUpdatedAt)) {
        return decrypt(openCloudLink.currentAccessToken);
    }

    // Access token expired — refresh it, serialised across processes.
    return withRefreshLock(
        `group:${identifer}`,
        async () => {
            const latest = await readminCollections.group_oauth_authorization.findOne({ groupId: identifer });
            if (!latest?.currentAccessToken || isTokenExpired(latest.accessTokenUpdatedAt)) return null;
            return decrypt(latest.currentAccessToken);
        },
        async () => {
            // Re-read the refresh token: the copy we loaded above may have been
            // rotated by another process while we waited for the lock, and
            // reusing a rotated token is what invalidates the link.
            const latest = await readminCollections.group_oauth_authorization.findOne({ groupId: identifer });
            if (!latest?.refreshToken) return false;
            const refreshToken = decrypt(latest.refreshToken);
            const newAccessToken = await refreshOpenCloudAuthorization(refreshToken);
            if (newAccessToken.kind !== 'success') {
                // Only DM the linking user if the refresh token is genuinely invalid.
                // Transient failures (rate limits, network/proxy errors, 5xx) must not
                // spam users whose workspace links are still valid.
                if (newAccessToken.kind === 'invalid_grant' && shouldNotifyUser(latest.sub)) {
                    dmUserDiscord(
                        latest.sub,
                        '⚠️ Open Cloud Link Expired for Your Workspace',
                        `Your Roblox OpenCloud authorization for the workspace linked by **${latest.preferred_username || latest.name}** has expired. ReAdmin can no longer perform group actions until you re-authorize. Please visit [panel.readmin.app](https://panel.readmin.app/workspaces/${latest.groupId}/settings/integrations) and re-link Open Cloud in your workspace settings.`,
                        'red',
                        'ReAdmin'
                    ).catch(() => {});
                }
                return false;
            }

            await readminCollections.group_oauth_authorization.updateOne({ groupId: identifer }, {
                $set: {
                    currentAccessToken: encrypt(newAccessToken.tokens.access_token),
                    lastUsed: new Date(),
                    refreshToken: encrypt(newAccessToken.tokens.refresh_token),
                    accessTokenUpdatedAt: new Date(),
                }
            });

            return newAccessToken.tokens.access_token;
        },
    );
}

// Main functions

export async function RobloxOAuthAuthorizationExchange(code: string): Promise<RobloxOAuthAuthorizationExchangeResponse | false> {
    console.log(code)
    const OAuthTokenRequest = await proxyFetch(
        'https://apis.roblox.com/oauth/v1/token',
        {
            method: 'POST',
            body: new URLSearchParams({
                client_id: env.ROBLOX_CLIENT_ID,
                client_secret: env.ROBLOX_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
            }),
        },
    );

    if (OAuthTokenRequest.status !== 200) {
        console.log('token exchange failed', await OAuthTokenRequest.text(), OAuthTokenRequest.status, OAuthTokenRequest.statusText)
        return false;
    }

    const response = await OAuthTokenRequest.json() as RobloxOAuthAuthorizationExchangeResponse;
    return response;
}


export async function getOAuthInfoUser(access_token: string): Promise<RobloxOpenCloudUserInformation | false> {
    const OAuthUserRequest = await proxyFetch(
        'https://apis.roblox.com/oauth/v1/userinfo',
        {
            method: 'GET',
            headers: {
                authorization: `Bearer ${access_token}`,
            },
        },
    );

    if (OAuthUserRequest.status !== 200) {
        return false;
    }

    const userInfo: RobloxOpenCloudUserInformation = await OAuthUserRequest.json() as RobloxOpenCloudUserInformation;
    return userInfo;
}

export type getRobloxJoinRequestOAuthResponse = {
    nextPageToken: string,
    groupJoinRequests: {
        path: string;
        createTime: string;
        user: string;
    }[]
}
export async function openCloudGetJoinRequests(performingAs: PerformingAs, performingId: string, groupId: string, cursor?: string): Promise<getRobloxJoinRequestOAuthResponse | false> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const joinRequests = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests?maxPageSize=100&pageToken=${cursor || ''}`,
        {
            method: 'GET',
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
        },
    );

    if (joinRequests.status !== 200) {
        await reportOpenCloudError('Get join requests', joinRequests.status, await joinRequests.text(), performingAs, performingId);
        return false;
    }

    const joinRequestsJson = await joinRequests.json() as getRobloxJoinRequestOAuthResponse;
    return joinRequestsJson;
}


export async function openCloudHandleJoinRequest(performingAs: PerformingAs, performingId: string, groupId: string, userId: string, accept: boolean): Promise<boolean> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const joinRequests = await proxyFetch(
        ///                      cloud/v2/groups/${groupId}/join-requests/${userId}:${accept ? 'accept' : 'decline'}
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests/${userId}:${accept ? 'accept' : 'decline'}`,
        {
            method: 'POST',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        },
    );

    if (joinRequests.status !== 200) {
        const body = await joinRequests.text();
        console.log(body, joinRequests.status, joinRequests.statusText)
        await reportOpenCloudError('Handle join request', joinRequests.status, body, performingAs, performingId);
        return false;
    }

    return true;
}

export async function openCloudGetGroupRoles(performingAs: PerformingAs, performingId: string, groupId: string, nextPageToken?: string) {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        console.log('could not get access token for getting group roles')
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const rolesRequest = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=200${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`,
        {
            method: 'GET',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    if (rolesRequest.status !== 200) {
        await reportOpenCloudError('Get group roles', rolesRequest.status, await rolesRequest.text(), performingAs, performingId);
        return false;
    }

    const rolesJson = await rolesRequest.json() as RobloxOpenCloudGroupRoleResponse;
    return rolesJson;
}

export async function openCloudGetAllGroupRoles(performingAs: PerformingAs, performingId: string, groupId: string) {
    let allRoles: RobloxOpenCloudGroupRoleResponse['groupRoles'] = [];
    let nextPageToken: string | undefined = undefined;

    do {
        const response = await openCloudGetGroupRoles(performingAs, performingId, groupId, nextPageToken);
        if (response === false) {
            return false;
        }
        allRoles = allRoles.concat(response.groupRoles);
        nextPageToken = response.nextPageToken;
    } while (nextPageToken);

    return allRoles;
}

export async function openCloudGetGroupMembersInRole(performingAs: PerformingAs, performingId: string, groupId: string, roleId: number, pageToken?: string) {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const membersRequest = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=100&filter=role == 'groups/${groupId}/roles/${roleId}'${pageToken ? `&pageToken=${pageToken}` : ''}`,
        {
            method: 'GET',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    if (membersRequest.status !== 200) {
        await reportOpenCloudError('Get group members in role', membersRequest.status, await membersRequest.text(), performingAs, performingId);
        return false;
    }

    const membersJson = await membersRequest.json() as RobloxOpenCloudGroupMemberResponse;
    return membersJson;
}

export async function openCloudGetAllGroupMembersInRole(performingAs: PerformingAs, performingId: string, groupId: string, roleId: number) {
    let allMembers: RobloxOpenCloudGroupMemberResponse['groupMemberships'] = [];
    let nextPageToken: string | undefined = undefined;

    do {
        const response = await openCloudGetGroupMembersInRole(performingAs, performingId, groupId, roleId, nextPageToken);
        if (response === false) {
            return false;
        }
        allMembers = allMembers.concat(response.groupMemberships);
        nextPageToken = response.nextPageToken;
    } while (nextPageToken);
    
    return allMembers;
}

export async function openCloudGetUserInfo(performingAs: PerformingAs, performingId: string, userId: string): Promise<RobloxOpenCloudUserType | false> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const userInfoRequest = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/users/${userId}`,
        {
            method: 'GET',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    if (userInfoRequest.status !== 200) {
        await reportOpenCloudError('Get user info', userInfoRequest.status, await userInfoRequest.text(), performingAs, performingId);
        return false;
    }

    const userInfoJson = await userInfoRequest.json() as RobloxOpenCloudUserType;
    return userInfoJson;
}

/**
 * Generates a user avatar thumbnail via Open Cloud OAuth.
 * Rate limit: 10 requests per minute per app user (separate from general API limit).
 * Returns the thumbnail image URL, or false on failure.
 *
 * @param size - Thumbnail dimension. Supported: 48, 50, 60, 75, 100, 110, 150, 180, 352, 420, 720. Default 420.
 * @param format - 'PNG' | 'JPEG'. Default 'PNG'.
 * @param shape - 'ROUND' (circular) | 'SQUARE'. Default 'ROUND'.
 */
export async function openCloudGenerateUserThumbnail(
    performingAs: PerformingAs,
    performingId: string,
    userId: string,
    size: number = 150,
    format: 'PNG' | 'JPEG' = 'PNG',
    shape: 'ROUND' | 'SQUARE' = 'ROUND',
): Promise<string | false> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForThumbnailRateLimit(performingAs, performingId);

    const thumbRequest = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/users/${userId}:generateThumbnail?size=${size}&format=${format}&shape=${shape}`,
        {
            method: 'GET',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    if (thumbRequest.status !== 200) {
        await reportOpenCloudError('Generate user thumbnail', thumbRequest.status, await thumbRequest.text(), performingAs, performingId);
        return false;
    }

    const thumbJson = await thumbRequest.json() as RobloxOpenCloudThumbnailResponse;

    // The response may be an async operation — poll if not done
    if (thumbJson.done && thumbJson.response?.imageUri) {
        return thumbJson.response.imageUri;
    }

    // If not done yet, poll the operation
    if (thumbJson.path && !thumbJson.done) {
        // Wait a moment, then poll
        await new Promise(resolve => setTimeout(resolve, 2000));

        await waitForThumbnailRateLimit(performingAs, performingId);

        const pollRequest = await proxyFetch(
            `https://apis.roblox.com/cloud/v2/${thumbJson.path}`,
            {
                method: 'GET',
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        if (pollRequest.status !== 200) {
            return false;
        }

        const pollJson = await pollRequest.json() as RobloxOpenCloudThumbnailResponse;
        if (pollJson.done && pollJson.response?.imageUri) {
            return pollJson.response.imageUri;
        }
    }

    return false;
}


export async function openCloudUpdateGroupStatus(performingAs: PerformingAs, performingId: string, groupId: string, message: string): Promise<true | false> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const shoutStatus = await proxyFetch(
        `https://apis.roblox.com/legacy-groups/v1/groups/${groupId}/status`,
        {
            method: 'PATCH',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        },
    );

    if (shoutStatus.status !== 200) {
        await reportOpenCloudError('Update group status', shoutStatus.status, await shoutStatus.text(), performingAs, performingId);
        return false;
    }

    return true;
}
export async function openCloudGetUserMembership(performingAs: PerformingAs, performingId: string, groupId: string, userId: string): Promise<{ path: string; createTime: string; updateTime: string; user: string; role: string; } | false> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const updateRoleRequest = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=user == 'users/${userId}'`,
        {
            method: 'GET',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        },
    );

    if (updateRoleRequest.status !== 200) {
        await reportOpenCloudError('Get user membership', updateRoleRequest.status, await updateRoleRequest.text(), performingAs, performingId);
        return false;
    }
    const body = await updateRoleRequest.json() as RobloxOpenCloudGroupMemberResponse;
    return body.groupMemberships[0] as RobloxOpenCloudGroupMemberResponse['groupMemberships'][0];
}
export async function openCloudUpdateUserRole(performingAs: PerformingAs, performingId: string, groupId: string, userId: string, roleId: number): Promise<true | false | 'rate_limited'> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        console.log('could not get access token')
        return false;
    }


    const membershipPath = await openCloudGetUserMembership(performingAs, performingId, groupId, userId);
    if (membershipPath == false) {
        console.log('could not get membership')
        return false;
    }
    if (membershipPath.role == `groups/${groupId}/roles/${roleId}`) {
        console.log('user is already that rank')
        return true;
    }

    await waitForRateLimit(performingAs, performingId);

    const updateRoleRequest = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/${membershipPath.path}`,
        {
            method: 'PATCH',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user: `users/${userId}`,
                role: `groups/${groupId}/roles/${roleId}`
            })
        },
    );
    if (updateRoleRequest.status === 429) {
        console.log('Rate limited by Roblox while ranking user', userId, 'in group', groupId)
        return 'rate_limited';
    }
    if (updateRoleRequest.status !== 200) {
        const errBody = await updateRoleRequest.text();
        console.log(updateRoleRequest.status, errBody)
        await reportOpenCloudError(`Update user role (user ${userId} in group ${groupId})`, updateRoleRequest.status, errBody, performingAs, performingId);
        return false;
    }

    return true;
}
export async function openCloudExileUser(performingAs: PerformingAs, performingId: string, groupId: string, userId: string): Promise<true | false> {
    const accessToken = await getOpenCloudAuthorizationToken(performingAs, performingId);
    if (accessToken == false) {
        return false;
    }

    await waitForRateLimit(performingAs, performingId);

    const removeUserRequest = await proxyFetch(
        `https://apis.roblox.com/legacy-groups/v1/groups/${groupId}/users/${userId}`,
        {
            method: 'DELETE',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        },
    );

    if (removeUserRequest.status !== 200) {
        await reportOpenCloudError('Exile user', removeUserRequest.status, await removeUserRequest.text(), performingAs, performingId);
        return false;
    }

    return true;
}


// API KEY STUFF


export async function getPlaceInfo(universeId: string, placeId: string): Promise<RobloxOpenCloudPlaceType | false> {
    const response = await robloxApiRequest<RobloxOpenCloudPlaceType>(
      `https://apis.roblox.com/cloud/v2/universes/${universeId}/places/${placeId}`, 'GET', undefined, { ['x-api-key']: env.ROBLOX_API_KEY }
    );

    if (!response) {
        return false;
    }

    return response;
}
export async function getUniverseInfo(universeId: string): Promise<RobloxOpenCloudUniverseType | false> {
    const response = await robloxApiRequest<RobloxOpenCloudUniverseType>(
        `https://apis.roblox.com/cloud/v2/universes/${universeId}`, 'GET', undefined, { ['x-api-key']: env.ROBLOX_API_KEY }
    );
    
    if (!response) {
        return false;
    }

    return response;
}
export async function getUserInfo(userId: string): Promise<RobloxOpenCloudUserType | false> {
    const universeInfoRequest = await proxyFetch(
        `https://apis.roblox.com/cloud/v2/users/${userId}`,
        {
            method: 'GET',
            headers: {
                'x-api-key': env.ROBLOX_API_KEY as string,
                'User-Agent': 'readmin.app'
            },
        },
    );

    if (universeInfoRequest.status !== 200) {
        return false;
    }

    const joinRequestsJson = await universeInfoRequest.json() as RobloxOpenCloudUserType;
    return joinRequestsJson;
}