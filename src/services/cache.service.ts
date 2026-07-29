import { GameResponse, GroupInfoResponse, GroupInfoResponseOC, GroupRole, PlaceData, RobloxGroupRoleUser, SearchUser, UniverseInfoOC, UserGroupResponseData, UserInfo, UsernameSearchResponse } from "~/services/types/roblox.types";
import { getProcessedUserObjectType, getRankInGroupType } from "./roblox.service";
import { env } from "./env";
import redisClient from "./redis.client";

export interface CacheResponse<T> {
    errors?: any[];
    messages?: any[];
    success: boolean;
    result: T;
}

// Define base types for specific cache entries
export type CacheKeyTypes = {
    // 'userProfile': { name: string; age: number };
    // 'settings': { theme: string; notifications: boolean };
    // 'groupData': { groupName: string; memberCount: number };
};

// Extend CacheKeyTypes to allow for dynamic keys with IDs
export type CacheKeyPatterns = {
    'getUserInfoByUsername': { id: string; data: UsernameSearchResponse };
    'getRankInGroup': { id: string; data: getRankInGroupType };
    'getUserInfo': { id: string; data: UserInfo };
    'getUserGroups': { id: string; data: UserGroupResponseData[] };
    'getUserThumbnail': { id: string; data: string };
    'getGroupThumbnail': { id: string; data: string };
    'getGroupInfoV2': { id: string; data: GroupInfoResponseOC };
    'getGroupRoles': { id: string; data: GroupRole[] };
    'searchRobloxUsersByUsername': { id: string; data: SearchUser[] };
    'getUsersInGroupRole': { id: string; data: RobloxGroupRoleUser[] };
    'getRobloxGameInfo': { id: string; data: GameResponse };
    'getRobloxGameInfoOC': { id: string; data: UniverseInfoOC };
    'getRobloxPlaceInfo': { id: string; data: PlaceData };
    'getRobloxGameThumbnail': { id: string; data: string };
    'getRobloxGameIcon': { id: string; data: string };
    'getRobloxAssetThumbnail': { id: string; data: { imageUrl: string; state: string } };
    'getProcessedUserObject': { id: string; data: getProcessedUserObjectType };

};

// Create dynamic key types using template literals
export type DynamicCacheKeys = {
    [K in keyof CacheKeyPatterns as `${K}/${string}`]: CacheKeyPatterns[K]['data'];
};

// Combine static and dynamic keys into a unified type
export type FullCacheKeys = CacheKeyTypes & DynamicCacheKeys;

// Utility function to construct keys with IDs, ensuring type safety
export function createCacheKey<K extends keyof CacheKeyPatterns>(key: K, id: string): `${K}/${string}` {
    return `${key}/${id}`;
}

// Helper function to check if a string is JSON
const isJson = (str: string): boolean => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

// Type-safe cache retrieval based on the key type
export async function readFromCache<K extends keyof FullCacheKeys>(key: K): Promise<FullCacheKeys[K] | null | 'DNC'> {
    if (env.APP_NAME == 'lambda') return null; // Do not use cache in AWS
    const data = await redisClient.get(key);
    if (!data) return null;
    if (isJson(data)) {
        return JSON.parse(data) as FullCacheKeys[K];
    }
    return data as FullCacheKeys[K];
}

export async function saveToCache<K extends keyof FullCacheKeys>(key: K, data: FullCacheKeys[K] | string, expirationInSeconds?: number): Promise<CacheResponse<null> | null> {
    if (env.APP_NAME == 'lambda') return null; // Do not use cache in AWS
    let cachedDate: string = data as string;
    if (typeof data !== 'string') {
        cachedDate = JSON.stringify(data);
    }
    await redisClient.set(key, cachedDate);
    await redisClient.expire(key, expirationInSeconds || 60 * 60 * 24);
    return null;
}

export async function deleteFromCache<K extends keyof FullCacheKeys>(key: K): Promise<CacheResponse<null> | null> {
    if (env.APP_NAME == 'lambda') return null; // Do not use cache in AWS
    await await redisClient.del(key);
    return null;
}