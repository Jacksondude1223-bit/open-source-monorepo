import { env } from '~/services/env';
import {
  GroupInfoResponseOC,
  GroupRole,
  GroupRolesResponseOC,
  RobloxUserSearch,
  RobloxUsernameSearchResponse,
  SearchUser,
  ThumbnailResponse,
  UniverseInfoOC,
  UserGroupResponseData,
  UserGroupsResponse,
  UserInfo,
  UserMembershipsOC,
  UsernameSearchResponse,
  UsersAuthenticatedMinimalResponse,
} from '~/services/types/roblox.types';
import proxyFetch from '~/utils/proxyFetch';
import { readminCollections } from '~/services/mongo.service';
import { createCacheKey, FullCacheKeys, readFromCache, saveToCache } from './cache.service';
import { getMinutesAgoDate, ONE_HOUR } from '../utils/DateUtils';
import { RobloxUser } from './NewMongoTypes';
import { ObjectId } from 'mongodb';
import {
  indexRobloxUser,
  isOpenSearchEnabled,
  searchRobloxUsers as openSearchSearchRobloxUsers,
} from './opensearch.service';

// In-flight request deduplication to prevent duplicate concurrent API calls
const inFlightRequests = new Map<string, Promise<any>>();
function deduplicatedRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, promise);
  return promise;
}

// Track which users have already been queued for background refresh this process lifetime
const backgroundRefreshScheduled = new Set<number>();

export type getRankInGroupType = { id: number; name: string; rank: number; };
export interface FoundUsersWithThumbnail extends SearchUser {
  thumbnail?: string;
}

export async function robloxApiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<T> {

  // If no cached data, proceed with the API request
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  const requestOptions = {
    method,
    headers: defaultHeaders,
    ...(body ? { body: JSON.stringify(body) as string } : {}),
  };

  try {
    const response = await proxyFetch(endpoint, requestOptions, true, 1);
    if (!response.ok) {
      const errorText = await response.text();
      throw errorText || response.statusText
    }

    const textResponse = await response.text();
    const result = textResponse && response.headers.get('Content-Type')?.includes('application/json')
      ? JSON.parse(textResponse) as T
      : (textResponse as unknown as T);
    return result;
  } catch (error) {
    console.error(`Failed request to ${endpoint}:`, error);
    throw error;
  }

} async function cachedRobloxApiRequest<K extends keyof FullCacheKeys>(
  key: K,
  requestFn: () => Promise<FullCacheKeys[K]>,
  expiration?: number,
  useCache = true
): Promise<FullCacheKeys[K]> {
  if (!useCache) return await requestFn();
  const cached = await readFromCache(key);
  if (cached !== 'DNC') {
    if (cached) return cached;
  }
  // console.log(`Cache miss for key: ${key}`);

  const result = await requestFn();
  if (result && result as any !== false && result !== null) {
    // console.log(`Caching result for key: ${key}`);
    saveToCache(key, result, expiration);
  }
  return result;
}

async function fetchThumbnailDirect(userId: string | number): Promise<string> {
  try {
    const key = createCacheKey('getUserThumbnail', userId.toString());
    // return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<ThumbnailResponse>(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Webp&isCircular=false`);
    return response.data[0]?.imageUrl || 'https://cdn.readmin.app/readmin-public/backon-hair.png';
    // }, ONE_HOUR);
  } catch {
    return 'https://cdn.readmin.app/readmin-public/backon-hair.png';
  }
}

async function updateUserByIdInDB(userId: number): Promise<void> {
  const [data, headshotUrl] = await Promise.all([
    robloxApiRequest<UserInfo>(`https://users.roblox.com/v1/users/${userId}`),
    fetchThumbnailDirect(userId)
  ]);
  await readminCollections.roblox_user.updateOne({
    id: userId
  }, {
    $set: {
      name: data.name,
      nameLower: (data.name || '').toLowerCase(),
      displayName: data.displayName,
      displayNameLower: (data.displayName || '').toLowerCase(),
      hasVerifiedBadge: data.hasVerifiedBadge,
      externalAppDisplayName: data.externalAppDisplayName,
      isBanned: data.isBanned,
      created: data.created,
      description: data.description,
      headshotUrl: headshotUrl,
      'cacheInfo.lastUpdated': new Date(),
    },
    $setOnInsert: {
      id: userId,
      'cacheInfo.created': new Date(),
    }
  }, {
    upsert: true
  });
  // Fire-and-forget OpenSearch index. Safe no-op when not configured.
  indexRobloxUser({
    id: userId,
    name: data.name,
    displayName: data.displayName,
    headshotUrl,
    hasVerifiedBadge: data.hasVerifiedBadge,
    isBanned: data.isBanned,
  }).catch(() => { });
}


export async function getRobloxUserById(userId: number): Promise<RobloxUser> {
  return deduplicatedRequest(`getRobloxUserById:${userId}`, async () => {
    const foundUser = await readminCollections.roblox_user.findOne({ id: userId });
    if (foundUser && foundUser?.headshotUrl) {
      // Validate headshot url is still valid - or try to get a new one or backup to backon hair
      try {
        const response = await proxyFetch(foundUser.headshotUrl, { method: 'HEAD' }, true, 1);
        if (!response.ok) {
          throw new Error('Headshot URL is not valid');
        }
      } catch {
        const newHeadshotUrl = await fetchThumbnailDirect(userId);
        await readminCollections.roblox_user.updateOne({ id: userId }, { $set: { headshotUrl: newHeadshotUrl, 'cacheInfo.lastUpdated': new Date() } });
        foundUser.headshotUrl = newHeadshotUrl;
      }
    }
    if (foundUser && foundUser?.cacheInfo?.lastUpdated > getMinutesAgoDate(60 * 24 * 7)) {
      return foundUser;
    }
    if (foundUser) { // speed up found users — only schedule one background refresh per user per process
      if (!backgroundRefreshScheduled.has(userId)) {
        backgroundRefreshScheduled.add(userId);
        updateUserByIdInDB(userId).catch(() => { }).finally(() => backgroundRefreshScheduled.delete(userId));
      }
      return foundUser;
    }//or fetch non-found users
    try {
      const [data, headshotUrl] = await Promise.all([
        robloxApiRequest<UserInfo>(`https://users.roblox.com/v1/users/${userId}`),
        fetchThumbnailDirect(userId)
      ]);

      const result = await readminCollections.roblox_user.updateOne({
        id: userId
      }, {
        $set: {
          name: data.name,
          nameLower: (data.name || '').toLowerCase(),
          displayName: data.displayName,
          displayNameLower: (data.displayName || '').toLowerCase(),
          hasVerifiedBadge: data.hasVerifiedBadge,
          externalAppDisplayName: data.externalAppDisplayName,
          isBanned: data.isBanned,
          created: data.created,
          description: data.description,
          headshotUrl: headshotUrl,
          'cacheInfo.lastUpdated': new Date(),
        },
        $setOnInsert: {
          id: userId,
          'cacheInfo.created': new Date(),
        }
      }, {
        upsert: true
      });
      indexRobloxUser({
        id: userId,
        name: data.name,
        displayName: data.displayName,
        headshotUrl,
        hasVerifiedBadge: data.hasVerifiedBadge,
        isBanned: data.isBanned,
      }).catch(() => { });
      const item = await readminCollections.roblox_user.findOne({ _id: result?.upsertedId as ObjectId }) as RobloxUser;
      return item;
    } catch {
      return { id: userId, name: 'Unknown', displayName: 'Unknown', description: '', created: new Date(), isBanned: false, externalAppDisplayName: null, hasVerifiedBadge: false } as unknown as RobloxUser;
    }
  });
}

// Roblox APIs
export async function getUserInfoByUsername(username: string): Promise<UsernameSearchResponse> {
  const key = createCacheKey('getUserInfoByUsername', username);
  return cachedRobloxApiRequest(key, async () => {
    const response = await robloxApiRequest<RobloxUsernameSearchResponse>(
      'https://users.roblox.com/v1/usernames/users',
      'POST',
      { usernames: [username], excludeBannedUsers: true }
    );
    if (!response.data[0]) throw new Error('Could not find user');
    getRobloxUserById(response.data[0].id).catch(() => { });
    return response.data[0];
  }, ONE_HOUR);
}


export async function getRankInGroup(groupId: string, userId: string): Promise<getRankInGroupType | null> {
  const key = createCacheKey('getRankInGroup', `${groupId}/${userId}`);
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const [roles, response] = await Promise.all([
      getGroupRoles(groupId),
      robloxApiRequest<UserMembershipsOC>(
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=user=='users/${userId}'`,
        'GET',
        undefined,
        { 'x-api-key': env.ROBLOX_API_KEY }
      )
    ]);
    const foundInRoles = roles?.filter(r => response.groupMemberships[0]?.roles?.includes(`groups/${groupId}/roles/${r.id}`));
    const highest = foundInRoles?.reduce((prev, current) => (prev.rank > current.rank) ? prev : current, { id: 0, name: 'No Role', rank: 0 });
    if (highest) {
      return {
        id: highest.id,
        name: highest.name,
        rank: highest.rank,
      } as getRankInGroupType;
    }
    return null as unknown as getRankInGroupType;
  }, ONE_HOUR);
}

export async function getUserInfo(userId: string | number, cache = true): Promise<RobloxUser | undefined> {
  return await getRobloxUserById(typeof userId === 'string' ? parseInt(userId) : userId);
}


export async function getUserGroups(userId: string): Promise<UserGroupResponseData[]> {
  const key = createCacheKey('getUserGroups', userId);
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<UserGroupsResponse>(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    return response?.data || [];
  }, ONE_HOUR);
}


export async function getUserThumbnail(userId: string | number, cache = true): Promise<string> {
  // try to use new user data object
  const user = await getRobloxUserById(typeof userId === 'string' ? parseInt(userId) : userId);
  if (user && user.headshotUrl) {
    return user.headshotUrl;
  }
  return fetchThumbnailDirect(userId);
}

export async function getGroupThumbnail(groupId: string | number): Promise<string> {
  const key = createCacheKey('getGroupThumbnail', groupId.toString());
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<ThumbnailResponse>(
      `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=150x150&format=Png&isCircular=false`
    );
    if (response.data[0]?.imageUrl) {
      return response.data[0].imageUrl;
    }
    throw new Error('Could not get group thumbnail');
  }, ONE_HOUR);
}

export async function getGroupInfo(groupId: string | number): Promise<GroupInfoResponseOC | null> {
  const key = createCacheKey('getGroupInfoV2', groupId.toString());
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<GroupInfoResponseOC>(
      `https://apis.roblox.com/cloud/v2/groups/${groupId}`, 'GET', undefined, { ['x-api-key']: env.ROBLOX_API_KEY }
    );
    if (response && 'description' in response) {
      return response;
    }
    throw new Error('Could not get group information');
  }, ONE_HOUR);
}

// Fetches the live group info straight from Roblox, bypassing the 1-hour cache
// used by getGroupInfo. Used by the member-count milestone poller which runs on
// a 10-minute cadence and therefore needs an up-to-date member count each tick.
export async function getGroupInfoFresh(groupId: string | number): Promise<GroupInfoResponseOC | null> {
  const response = await robloxApiRequest<GroupInfoResponseOC>(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}`, 'GET', undefined, { ['x-api-key']: env.ROBLOX_API_KEY }
  );
  if (response && 'description' in response) {
    // Refresh the shared cache opportunistically so other consumers benefit.
    try { await saveToCache(createCacheKey('getGroupInfoV2', groupId.toString()), response as any, ONE_HOUR); } catch { /* non-fatal */ }
    return response;
  }
  return null;
}
export async function getGroupRoles(
  groupId: string | number,
  cache = true
): Promise<GroupRole[] | undefined> {
  const key = createCacheKey('getGroupRoles', groupId.toString());

  return cachedRobloxApiRequest<typeof key>(
    key,
    async () => {
      const roles: GroupRole[] = [];
      let nextPageToken: string | undefined;

      do {
        const url = new URL(
          `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles`
        );

        url.searchParams.set('maxPageSize', '20');

        if (nextPageToken) {
          url.searchParams.set('pageToken', nextPageToken);
        }

        const response = await robloxApiRequest<GroupRolesResponseOC>(url.toString(), 'GET', undefined, { 'x-api-key': env.ROBLOX_API_KEY });

        if (!response?.groupRoles?.length) {
          break;
        }

        roles.push(
          ...response.groupRoles.map((r): GroupRole => ({
            id: Number(r.id),
            name: r.displayName,
            rank: r.rank,
            memberCount: r.memberCount,
          }))
        );

        nextPageToken = response.nextPageToken || undefined;
      } while (nextPageToken);

      if (roles.length === 0) {
        throw new Error('Could not get group roles');
      }

      // sort rank asc
      return roles.sort((a, b) => a.rank - b.rank).filter(r => r.rank > 0);
    }, ONE_HOUR, cache);
}
export async function searchRobloxUsersByUsername(username: string, max = 10, cache = true): Promise<SearchUser[]> {
  const key = createCacheKey('searchRobloxUsersByUsername', `${username}_${max}`);
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<RobloxUserSearch>(
      `https://users.roblox.com/v1/users/search?keyword=${username}&limit=${max}`,
      'GET',
      undefined,
      {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        Cookie: env.ROBLOX_COOKIE,
      }
    );
    if (response && 'data' in response) {
      return response.data;
    }
    throw new Error('Something went wrong');
  }, ONE_HOUR, cache);
}

type GroupId = string | number;
type RoleId = string | number;


export async function getRobloxGameInfo(gameId: string): Promise<UniverseInfoOC> {
  const key = createCacheKey('getRobloxGameInfoOC', gameId);
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<UniverseInfoOC>(
      `https://apis.roblox.com/cloud/v2/universes/${gameId}`, 'GET', undefined, { ['x-api-key']: env.ROBLOX_API_KEY }
    );
    if (!response?.displayName) {
      throw new Error('Could not get game info');
    }
    return response;
  }, ONE_HOUR, false);
}
export async function getRobloxGameThumbnail(gameId: string): Promise<string> {
  const key = createCacheKey('getRobloxGameThumbnail', gameId);
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<{ data: { thumbnails: { targetId: string; imageUrl: string }[] }[] }>(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${gameId}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`,
    );

    return response?.data[0]?.thumbnails[0]?.imageUrl || '';
  }, ONE_HOUR, false);
}
export async function getRobloxGameIcon(gameId: string): Promise<string> {
  const key = createCacheKey('getRobloxGameIcon', gameId);
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<{ data: { imageUrl: string }[] }>(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${gameId}&size=512x512&format=Png&isCircular=false`
    );

    return response?.data[0]?.imageUrl || '';
  }, ONE_HOUR, false);
}

// Resolve a moderated/CDN thumbnail URL for a Roblox image/decal asset id. Used
// by the Orders v2 product editor: the live preview both renders the image and
// doubles as moderation validation (private/pending assets return an empty url
// or a non-Completed state, which the UI surfaces as "invalid asset").
export type AssetThumbnailResult = { imageUrl: string; state: string };
export async function getRobloxAssetThumbnail(assetId: string): Promise<AssetThumbnailResult> {
  const key = createCacheKey('getRobloxAssetThumbnail', assetId);
  return cachedRobloxApiRequest<typeof key>(key, async () => {
    const response = await robloxApiRequest<{ data: { targetId: number; state: string; imageUrl: string }[] }>(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png&isCircular=false`,
    );
    const entry = response?.data?.[0];
    return { imageUrl: entry?.imageUrl || '', state: entry?.state || 'Error' };
  }, ONE_HOUR, false);
}


export interface getProcessedUserObjectType extends UserInfo {
  thumbnail: string;
}

export async function getProcessedUserObject(
  userId: string | number,
  cache = true
): Promise<getProcessedUserObjectType> {
  if (userId == '' || !userId) {
    return {
      description: 'Unable to load user information',
      created: new Date(),
      isBanned: false,
      externalAppDisplayName: null,
      hasVerifiedBadge: false,
      id: parseInt(userId?.toString()),
      name: '',
      displayName: '',
      thumbnail: 'unknown',
    }
  }
  // getRobloxUserById already fetches both user info + thumbnail in one go
  const user = await getRobloxUserById(typeof userId === 'string' ? parseInt(userId) : userId);
  if (!user) {
    return {
      description: 'Unable to load user information',
      created: new Date(),
      isBanned: false,
      externalAppDisplayName: null,
      hasVerifiedBadge: false,
      id: parseInt(userId.toString()),
      name: '',
      displayName: '',
      thumbnail: 'https://cdn.readmin.app/readmin-public/backon-hair.png',
    }
  }
  return {
    ...user,
    thumbnail: user.headshotUrl || 'https://cdn.readmin.app/readmin-public/backon-hair.png',
  };
}

export interface processObjectsWithUserIdToUserData {
  userId: string | number;
  user?: getProcessedUserObjectType;
}
export interface processObjectsWithUserIdToUserDataResponse {
  userId: string | number;
  user: getProcessedUserObjectType;
}

export async function processObjectsWithUserIdToUserData<
  T extends processObjectsWithUserIdToUserData,
>(data: T[]): Promise<(T & processObjectsWithUserIdToUserDataResponse)[]> {
  const toProcess: any = await Promise.all(
    data.map(async (u) => {
      if (u.userId) {
        u.user = await getProcessedUserObject(u.userId, true);
        return u;
      } else {
      }
    }),
  );
  return toProcess;
}


// Better Roblox Search

/** Escape special regex characters so user input is treated as a literal prefix. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default async function BetterRobloxSearch(
  username: string,
  groupId?: string,
): Promise<string[]> {
  if (username == '' || username.length < 3) return [];

  const isGroupSearch = groupId !== '0' && groupId !== '' && groupId;

  // 0. Preferred path: OpenSearch (prefix + fuzzy). When unconfigured this is
  //    a no-op returning [] and we fall through to the Mongo path below.
  if (isOpenSearchEnabled()) {
    const osHits = await openSearchSearchRobloxUsers(username, { size: 50 });
    if (osHits.length > 0) {
      if (isGroupSearch) {
        const members = await readminCollections.group_member.find({
          groupId,
          userId: { $in: osHits.map(u => u.id) },
        }, { projection: { userId: 1 } }).toArray();
        if (members.length > 0) {
          const memberIdSet = new Set(members.map(m => m.userId));
          // Preserve OpenSearch relevance order.
          return osHits.filter(u => memberIdSet.has(u.id)).map(u => u.id.toString()).slice(0, 10);
        }
        return [];
      }
      return osHits.map(u => u.id.toString()).slice(0, 10);
    }
    // OS returned no hits — still try the Mongo path during rollout / backfill.
  }

  const escaped = escapeRegex(username.toLowerCase());
  // Case-SENSITIVE anchored regex against the precomputed `nameLower` / `displayNameLower`
  // fields. This is the critical perf bit: case-insensitive (`/i`) regex cannot use a btree
  // index in MongoDB and was forcing a full collection scan across millions of users.
  const nameRegex = new RegExp(`^${escaped}`);

  // 1. Always try local DB first (fast — indexed prefix match on lowercased field)
  const localUsers = await readminCollections.roblox_user.find({
    $or: [{ nameLower: nameRegex }, { displayNameLower: nameRegex }],
  }, { projection: { id: 1 } }).limit(50).toArray()
    .catch(() => [] as { id: number }[]);

  if (isGroupSearch) {
    // For workspace searches: filter local results to group members
    if (localUsers.length > 0) {
      const members = await readminCollections.group_member.find({
        groupId,
        userId: { $in: localUsers.map(u => u.id) },
      }, { projection: { userId: 1 } }).toArray();
      if (members.length > 0) {
        return members.map(m => m.userId.toString()).slice(0, 10);
      }
    }
    // No local results matched group members — still don't hit Roblox for workspace search,
    // just return empty. The user is searching within their group.
    return [];
  }

  // 2. Non-group search: return local results if we have them
  if (localUsers.length > 0) {
    return localUsers.map(u => u.id.toString()).slice(0, 10);
  }

  // 3. Fallback to Roblox API only when we have no local results and no groupId
  const apiUsers = await searchRobloxUsersByUsername(username, 10, false)
    .catch(() => [] as FoundUsersWithThumbnail[]);
  return apiUsers.map(a => a.id.toString()).slice(0, 10);
}

export async function BetterRobloxSearchV2(
  username: string,
  groupId?: string,
  cache = true,
): Promise<{ userId: string, name: string, thumbnail: string }[]> {
  if (username == '' || username.length < 3) return [];

  const DEFAULT_THUMBNAIL = 'https://cdn.readmin.app/readmin-public/backon-hair.png';
  const isGroupSearch = groupId !== '0' && groupId !== '' && groupId;

  // 0. Preferred path: OpenSearch.
  if (isOpenSearchEnabled()) {
    const osHits = await openSearchSearchRobloxUsers(username, { size: 50 });
    if (osHits.length > 0) {
      if (isGroupSearch) {
        const members = await readminCollections.group_member.find({
          groupId,
          userId: { $in: osHits.map(u => u.id) },
        }, { projection: { userId: 1 } }).toArray();
        const memberIdSet = new Set(members.map(m => m.userId));
        const results = osHits
          .filter(u => memberIdSet.has(u.id))
          .map(u => ({ userId: u.id.toString(), name: u.name, thumbnail: u.headshotUrl || DEFAULT_THUMBNAIL }))
          .slice(0, 10);
        if (results.length > 0) return results;
        return [];
      }
      return osHits
        .map(u => ({ userId: u.id.toString(), name: u.name, thumbnail: u.headshotUrl || DEFAULT_THUMBNAIL }))
        .slice(0, 10);
    }
    // OS empty — fall through to Mongo path during rollout / backfill.
  }

  const escaped = escapeRegex(username.toLowerCase());
  // Case-SENSITIVE anchored regex against the precomputed lowercased fields — see
  // comment in BetterRobloxSearch above for why this is critical.
  const nameRegex = new RegExp(`^${escaped}`);

  // 1. Always try local DB first (fast — indexed prefix match on lowercased field)
  const localUsers = await readminCollections.roblox_user.find({
    $or: [{ nameLower: nameRegex }, { displayNameLower: nameRegex }],
  }, { projection: { id: 1, name: 1, headshotUrl: 1 } }).limit(50).toArray()
    .catch(() => [] as { id: number; name: string; headshotUrl?: string }[]);

  if (isGroupSearch) {
    // For workspace searches: filter local results to group members
    if (localUsers.length > 0) {
      const members = await readminCollections.group_member.find({
        groupId,
        userId: { $in: localUsers.map(u => u.id) },
      }, { projection: { userId: 1 } }).toArray();
      const memberIdSet = new Set(members.map(m => m.userId));
      const results = localUsers
        .filter(u => memberIdSet.has(u.id))
        .map(u => ({ userId: u.id.toString(), name: u.name, thumbnail: u.headshotUrl || DEFAULT_THUMBNAIL }))
        .slice(0, 10);
      if (results.length > 0) return results;
    }
    // No local results matched group members — return empty for workspace search
    return [];
  }

  // 2. Non-group search: return local results if we have them
  if (localUsers.length > 0) {
    return localUsers.map(u => ({ userId: u.id.toString(), name: u.name, thumbnail: u.headshotUrl || DEFAULT_THUMBNAIL })).slice(0, 10);
  }

  // 3. Fallback to Roblox API only when we have no local results and no groupId
  const apiUsers = await searchRobloxUsersByUsername(username, 10, cache)
    .catch(() => [] as FoundUsersWithThumbnail[]);
  return apiUsers.map(a => ({ userId: a.id.toString(), name: a.name, thumbnail: DEFAULT_THUMBNAIL })).slice(0, 10);
}


// Authenticated Actions

export async function doXCSRFRequest(url: string, method: string, headers: any, body?: string | undefined): Promise<Response> {
  let request = await proxyFetch(url, {
    method,
    headers,
    ...(body ? { body } : {})
  }, true);
  if (request.status == 403) {
    const XCSRF = request.headers.get('x-csrf-token');
    request = await proxyFetch(url, {
      method,
      headers: { ...headers, 'x-csrf-token': XCSRF },
      ...(body ? { body } : {})
    }, true);
  }
  return request;
}

export async function getAuthenticatedUserInfo(cookie: string): Promise<string | 'loggedOut' | UsersAuthenticatedMinimalResponse> {
  const response = await proxyFetch(`https://users.roblox.com/v1/users/authenticated`, {
    method: 'GET',
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
    }
  });
  if (response.status == 401) {
    return 'loggedOut'
  }
  if (response.status !== 200) {
    return (await response.json() as any).errors[0].message;
  }
  const userInfoResponse = await response.json() as any;
  return userInfoResponse;
}


export type getRobloxJoinRequestResponse = {
  previousPageCursor: string,
  nextPageCursor: string,
  data: [
    {
      requester: {
        buildersClubMembershipType: number;
        hasVerifiedBadge: boolean;
        userId: number;
        username: string;
        displayName: string;
      },
      created: string;
    }[]
  ]
}

/**
 * Batch-resolve Roblox user info (name, displayName, headshotUrl) for a list of user IDs.
 * Returns a Map<number, RobloxUser> for quick lookup. Uses the roblox_user cache collection
 * with on-demand fetch for any missing users.
 */
export async function batchGetRobloxUsers(userIds: number[]): Promise<Map<number, RobloxUser>> {
  if (userIds.length === 0) return new Map();
  const unique = [...new Set(userIds)];
  const cached = await readminCollections.roblox_user.find({ id: { $in: unique } }).toArray();
  const result = new Map<number, RobloxUser>(cached.map(u => [u.id, u]));
  // Fetch any missing users on-demand (fire-and-resolve)
  const missing = unique.filter(id => !result.has(id));
  if (missing.length > 0) {
    const fetched = await Promise.all(missing.map(id => getRobloxUserById(id).catch(() => null)));
    for (const u of fetched) {
      if (u) result.set(u.id, u);
    }
  }
  return result;
}