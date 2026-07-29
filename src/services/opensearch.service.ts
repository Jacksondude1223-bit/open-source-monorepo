/**
 * OpenSearch integration for fast Roblox user search.
 *
 * Activation: set OPENSEARCH_URL in the environment. When unset, every helper
 * in this file is a safe no-op and callers should fall back to MongoDB.
 *
 * Index design:
 *   - _id           = Roblox user id (string). Idempotent upserts.
 *   - name          = `search_as_you_type` for autocomplete / prefix / fuzzy.
 *                     Sub-field `.keyword` (lowercase-normalized) for exact match.
 *   - displayName   = same as name.
 *   - headshotUrl   = keyword (for retrieval only, not searchable).
 *   - hasVerifiedBadge / isBanned = boolean, used for scoring boosts and filters.
 *
 * Query strategy (see `searchRobloxUsers`):
 *   - `multi_match` of type `bool_prefix` across name + n-gram subfields → fast
 *     prefix-as-you-type matching.
 *   - Boost exact `.keyword` matches on top of prefix matches.
 *   - Optional fuzziness for typo tolerance.
 */

import { Client } from '@opensearch-project/opensearch';
import { env } from '~/services/env';

export interface OpenSearchRobloxUserDoc {
    id: number;
    name: string;
    displayName: string;
    headshotUrl?: string;
    hasVerifiedBadge?: boolean;
    isBanned?: boolean;
}

export const ROBLOX_USER_INDEX = `roblox_users_${env.NODE_ENV}`;
export const GAME_CHAT_INDEX = `game_chats_${env.NODE_ENV}`;

export interface OpenSearchGameChatDoc {
    /** Mongo _id of the running_game_chats document (string). Idempotent upserts. */
    id: string;
    runningGameId: string;
    internalGameId: string;
    groupId: string;
    placeId: number;
    userId: string;
    /** Roblox username at send time (denormalized for display + search). */
    username?: string;
    message: string;
    /** Recipient userId for whispers, if any. */
    to?: string;
    /** Epoch millis — used for range filtering (e.g. last hour). */
    createdAt: number;
}

let _client: Client | null = null;
let _ensureIndexPromise: Promise<void> | null = null;
let _ensureChatIndexPromise: Promise<void> | null = null;

export function isOpenSearchEnabled(): boolean {
    return Boolean(env.OPENSEARCH_URL);
}

export function getOpenSearchClient(): Client | null {
    if (!isOpenSearchEnabled()) return null;
    if (_client) return _client;
    _client = new Client({
        node: env.OPENSEARCH_URL,
        auth: env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD
            ? { username: env.OPENSEARCH_USERNAME, password: env.OPENSEARCH_PASSWORD }
            : undefined,
        // Long-lived process — keep connections alive but bounded.
        maxRetries: 2,
        requestTimeout: 5_000,
    });
    return _client;
}

/**
 * Create the Roblox user index with the proper analyzer/mapping if it doesn't
 * exist. Safe to call repeatedly — second + calls are deduplicated via the
 * cached promise.
 */
export function ensureRobloxUserIndex(): Promise<void> {
    if (!isOpenSearchEnabled()) return Promise.resolve();
    if (_ensureIndexPromise) return _ensureIndexPromise;
    _ensureIndexPromise = (async () => {
        const client = getOpenSearchClient();
        if (!client) return;
        const exists = await client.indices.exists({ index: ROBLOX_USER_INDEX }).catch(() => ({ body: false }));
        if (exists?.body) return;
        await client.indices.create({
            index: ROBLOX_USER_INDEX,
            body: {
                settings: {
                    'index.number_of_shards': 1,
                    'index.number_of_replicas': 0,
                    analysis: {
                        normalizer: {
                            lowercase_normalizer: { type: 'custom', filter: ['lowercase'] },
                        },
                    },
                },
                mappings: {
                    properties: {
                        id: { type: 'long' },
                        name: {
                            type: 'search_as_you_type',
                            fields: {
                                keyword: { type: 'keyword', normalizer: 'lowercase_normalizer' },
                            },
                        },
                        displayName: {
                            type: 'search_as_you_type',
                            fields: {
                                keyword: { type: 'keyword', normalizer: 'lowercase_normalizer' },
                            },
                        },
                        headshotUrl: { type: 'keyword', index: false },
                        hasVerifiedBadge: { type: 'boolean' },
                        isBanned: { type: 'boolean' },
                    },
                },
            },
        }).catch((err: any) => {
            // Concurrent create races between processes are fine.
            if (err?.meta?.body?.error?.type !== 'resource_already_exists_exception') {
                console.warn('[opensearch] index create failed:', err?.message || err);
            }
        });
    })();
    return _ensureIndexPromise;
}

/**
 * Upsert a single Roblox user document. Fire-and-forget safe — errors are
 * logged but not rethrown so the caller's primary write to Mongo still wins.
 */
export async function indexRobloxUser(doc: OpenSearchRobloxUserDoc): Promise<void> {
    const client = getOpenSearchClient();
    if (!client) return;
    try {
        await ensureRobloxUserIndex();
        await client.index({
            index: ROBLOX_USER_INDEX,
            id: doc.id.toString(),
            body: {
                id: doc.id,
                name: doc.name || '',
                displayName: doc.displayName || '',
                headshotUrl: doc.headshotUrl,
                hasVerifiedBadge: doc.hasVerifiedBadge ?? false,
                isBanned: doc.isBanned ?? false,
            },
            // Don't wait for a refresh — search-as-you-type results being a few
            // hundred ms stale after a write is fine.
        });
    } catch (err: any) {
        console.warn('[opensearch] indexRobloxUser failed:', err?.message || err);
    }
}

/**
 * Bulk-index a batch of Roblox users. Used by the backfill script.
 */
export async function bulkIndexRobloxUsers(docs: OpenSearchRobloxUserDoc[]): Promise<{ indexed: number; failed: number }> {
    const client = getOpenSearchClient();
    if (!client || docs.length === 0) return { indexed: 0, failed: 0 };
    await ensureRobloxUserIndex();
    const body: any[] = [];
    for (const doc of docs) {
        body.push({ index: { _index: ROBLOX_USER_INDEX, _id: doc.id.toString() } });
        body.push({
            id: doc.id,
            name: doc.name || '',
            displayName: doc.displayName || '',
            headshotUrl: doc.headshotUrl,
            hasVerifiedBadge: doc.hasVerifiedBadge ?? false,
            isBanned: doc.isBanned ?? false,
        });
    }
    const res = await client.bulk({ body, refresh: false });
    let failed = 0;
    if (res.body?.errors) {
        for (const item of res.body.items || []) {
            const op = item.index || item.create || item.update;
            if (op?.error) failed++;
        }
    }
    return { indexed: docs.length - failed, failed };
}

/**
 * Delete a user document from the index (e.g. on hard-delete from Mongo).
 */
export async function deleteRobloxUserFromIndex(userId: number): Promise<void> {
    const client = getOpenSearchClient();
    if (!client) return;
    try {
        await client.delete({ index: ROBLOX_USER_INDEX, id: userId.toString() });
    } catch (err: any) {
        if (err?.meta?.statusCode === 404) return;
        console.warn('[opensearch] deleteRobloxUserFromIndex failed:', err?.message || err);
    }
}

export interface SearchRobloxUsersOptions {
    /** Max hits to return. Default 50. */
    size?: number;
    /** Enable typo tolerance. Default true. */
    fuzzy?: boolean;
    /** Restrict to a specific user id list (e.g. group membership filter). */
    onlyUserIds?: number[];
}

/**
 * Search the Roblox user index for a username prefix / fuzzy match.
 * Returns hits in OpenSearch's score order (most relevant first).
 */
export async function searchRobloxUsers(
    query: string,
    opts: SearchRobloxUsersOptions = {},
): Promise<OpenSearchRobloxUserDoc[]> {
    const client = getOpenSearchClient();
    if (!client) return [];
    const trimmed = query.trim();
    if (trimmed === '') return [];
    const size = opts.size ?? 50;
    const fuzzy = opts.fuzzy ?? true;

    const should: any[] = [
        // Primary: prefix-as-you-type across name + ngram subfields.
        {
            multi_match: {
                query: trimmed,
                type: 'bool_prefix',
                fields: [
                    'name^3',
                    'name._2gram',
                    'name._3gram',
                    'displayName^2',
                    'displayName._2gram',
                    'displayName._3gram',
                ],
            },
        },
        // Boost exact case-insensitive keyword matches to the top.
        { term: { 'name.keyword': { value: trimmed.toLowerCase(), boost: 10 } } },
        { term: { 'displayName.keyword': { value: trimmed.toLowerCase(), boost: 6 } } },
    ];
    if (fuzzy && trimmed.length >= 4) {
        should.push({
            multi_match: {
                query: trimmed,
                fields: ['name^2', 'displayName'],
                fuzziness: 'AUTO',
                prefix_length: 1,
            },
        });
    }

    const filter: any[] = [];
    if (opts.onlyUserIds && opts.onlyUserIds.length > 0) {
        filter.push({ terms: { id: opts.onlyUserIds } });
    }

    try {
        const res = await client.search({
            index: ROBLOX_USER_INDEX,
            body: {
                size,
                _source: ['id', 'name', 'displayName', 'headshotUrl', 'hasVerifiedBadge', 'isBanned'],
                query: {
                    bool: {
                        should,
                        minimum_should_match: 1,
                        filter,
                    },
                },
            },
        });
        const hits = res.body?.hits?.hits || [];
        return hits.map((h: any) => h._source as OpenSearchRobloxUserDoc);
    } catch (err: any) {
        console.warn('[opensearch] searchRobloxUsers failed:', err?.message || err);
        return [];
    }
}

/**
 * Exact case-insensitive lookup against `name.keyword` / `displayName.keyword`.
 */
export async function findRobloxUserByExactNameInIndex(name: string): Promise<OpenSearchRobloxUserDoc[]> {
    const client = getOpenSearchClient();
    if (!client) return [];
    const trimmed = name.trim();
    if (trimmed === '') return [];
    try {
        const res = await client.search({
            index: ROBLOX_USER_INDEX,
            body: {
                size: 10,
                _source: ['id', 'name', 'displayName', 'headshotUrl'],
                query: {
                    bool: {
                        should: [
                            { term: { 'name.keyword': trimmed.toLowerCase() } },
                            { term: { 'displayName.keyword': trimmed.toLowerCase() } },
                        ],
                        minimum_should_match: 1,
                    },
                },
            },
        });
        const hits = res.body?.hits?.hits || [];
        return hits.map((h: any) => h._source as OpenSearchRobloxUserDoc);
    } catch (err: any) {
        console.warn('[opensearch] findRobloxUserByExactNameInIndex failed:', err?.message || err);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Game chat search
// ---------------------------------------------------------------------------

/**
 * Create the game-chat index. Messages are stored with a `text` analyzer for
 * full-text search plus a `createdAt` epoch-millis field for time-window range
 * filtering (e.g. "last hour"). Safe to call repeatedly — deduped via the
 * cached promise.
 */
export function ensureGameChatIndex(): Promise<void> {
    if (!isOpenSearchEnabled()) return Promise.resolve();
    if (_ensureChatIndexPromise) return _ensureChatIndexPromise;
    _ensureChatIndexPromise = (async () => {
        const client = getOpenSearchClient();
        if (!client) return;
        const exists = await client.indices.exists({ index: GAME_CHAT_INDEX }).catch(() => ({ body: false }));
        if (exists?.body) return;
        await client.indices.create({
            index: GAME_CHAT_INDEX,
            body: {
                settings: {
                    'index.number_of_shards': 1,
                    'index.number_of_replicas': 0,
                    analysis: {
                        normalizer: {
                            lowercase_normalizer: { type: 'custom', filter: ['lowercase'] },
                        },
                    },
                },
                mappings: {
                    properties: {
                        runningGameId: { type: 'keyword' },
                        internalGameId: { type: 'keyword' },
                        groupId: { type: 'keyword' },
                        placeId: { type: 'long' },
                        userId: { type: 'keyword' },
                        username: {
                            type: 'text',
                            fields: { keyword: { type: 'keyword', normalizer: 'lowercase_normalizer' } },
                        },
                        message: { type: 'text' },
                        to: { type: 'keyword' },
                        createdAt: { type: 'date', format: 'epoch_millis' },
                    },
                },
            },
        }).catch((err: any) => {
            // Concurrent create races between processes are fine.
            if (err?.meta?.body?.error?.type !== 'resource_already_exists_exception') {
                console.warn('[opensearch] ensureGameChatIndex create failed:', err?.message || err);
            }
        });
    })();
    return _ensureChatIndexPromise;
}

/**
 * Index a single chat message. Fire-and-forget safe — errors are logged but not
 * rethrown so the caller's primary Mongo write still wins.
 */
export async function indexChatMessage(doc: OpenSearchGameChatDoc): Promise<void> {
    const client = getOpenSearchClient();
    if (!client) return;
    try {
        await ensureGameChatIndex();
        await client.index({
            index: GAME_CHAT_INDEX,
            id: doc.id,
            body: {
                runningGameId: doc.runningGameId,
                internalGameId: doc.internalGameId,
                groupId: doc.groupId,
                placeId: doc.placeId,
                userId: doc.userId,
                username: doc.username || '',
                message: doc.message || '',
                to: doc.to,
                createdAt: doc.createdAt,
            },
        });
    } catch (err: any) {
        console.warn('[opensearch] indexChatMessage failed:', err?.message || err);
    }
}

export interface SearchChatMessagesOptions {
    /** Restrict to a single running server. */
    runningGameId?: string;
    /** Restrict to all servers of a place. */
    placeId?: number;
    /** Only return messages newer than this epoch-millis timestamp. */
    sinceMs?: number;
    /** Max hits. Default 100. */
    size?: number;
}

/**
 * Full-text search over game chat messages, newest first, optionally bounded to
 * a running server and/or a time window. An empty query with filters acts as a
 * time-window browse (e.g. "everything in the last hour").
 */
export async function searchChatMessages(
    query: string,
    opts: SearchChatMessagesOptions = {},
): Promise<OpenSearchGameChatDoc[]> {
    const client = getOpenSearchClient();
    if (!client) return [];
    const trimmed = query.trim();
    const size = opts.size ?? 100;

    const filter: any[] = [];
    if (opts.runningGameId) filter.push({ term: { runningGameId: opts.runningGameId } });
    if (opts.placeId !== undefined) filter.push({ term: { placeId: opts.placeId } });
    if (opts.sinceMs !== undefined) filter.push({ range: { createdAt: { gte: opts.sinceMs } } });

    const must: any[] = [];
    if (trimmed !== '') {
        must.push({
            multi_match: {
                query: trimmed,
                fields: ['message^2', 'username'],
                fuzziness: 'AUTO',
                prefix_length: 1,
            },
        });
    }

    try {
        const res = await client.search({
            index: GAME_CHAT_INDEX,
            body: {
                size,
                sort: [{ createdAt: { order: 'desc' } }],
                query: {
                    bool: {
                        ...(must.length > 0 ? { must } : {}),
                        filter,
                    },
                },
            },
        });
        const hits = res.body?.hits?.hits || [];
        return hits.map((h: any) => ({ id: h._id, ...h._source }) as OpenSearchGameChatDoc);
    } catch (err: any) {
        console.warn('[opensearch] searchChatMessages failed:', err?.message || err);
        return [];
    }
}
