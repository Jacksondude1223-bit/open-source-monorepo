import { z } from 'zod';
import {
  connectedProcedure,
} from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import {
  findRobloxUserByExactNameInIndex,
  isOpenSearchEnabled,
} from '~/services/opensearch.service';
import BetterRobloxSearch, {
  BetterRobloxSearchV2,
  getGroupRoles,
  getProcessedUserObject,
  getProcessedUserObjectType,
  getUserInfo,
  getUserThumbnail,
  searchRobloxUsersByUsername,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
export const robloxRouter = router({
  getGroupRoles: connectedProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { groupId } = input;
      return await getGroupRoles(groupId);
    }),
  searchRobloxUsersByUsername: connectedProcedure
    .input(
      z.object({
        username: z.string(),
        groupId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { username, groupId } = input;
      if (username == '') return [];
      const foundUsers = await BetterRobloxSearch(username, groupId);
      return foundUsers;
    }),
  searchRobloxUsersByUsernameWithIdNameCombo: connectedProcedure
    .input(
      z.object({
        username: z.string(),
        groupId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { username, groupId } = input;
      if (username == '') return [];
      const foundUsers = await BetterRobloxSearchV2(username, groupId, true);
      return foundUsers;
    }),
  // Exact case-insensitive lookup against the local roblox_user collection.
  // Used as an "Enter to confirm" fallback when prefix search returns nothing
  // (e.g. the user typed a full name we haven't indexed via prefix yet).
  findRobloxUserByExactName: connectedProcedure
    .input(
      z.object({
        username: z.string(),
        groupId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { username, groupId } = input;
      const trimmed = username.trim();
      if (trimmed === '') return [];
      const DEFAULT_THUMBNAIL = 'https://cdn.readmin.app/readmin-public/backon-hair.png';
      const needle = trimmed.toLowerCase();
      const isGroupSearch = groupId !== '0' && groupId !== '' && groupId;

      // Prefer OpenSearch when configured — exact term lookup on the lowercase
      // keyword subfield is O(log n) and avoids touching Mongo at all.
      let localUsers: { id: number; name: string; headshotUrl?: string }[] = [];
      if (isOpenSearchEnabled()) {
        const osHits = await findRobloxUserByExactNameInIndex(trimmed);
        if (osHits.length > 0) {
          localUsers = osHits.map(h => ({ id: h.id, name: h.name, headshotUrl: h.headshotUrl }));
        }
      }
      // Fall back to Mongo (or use it exclusively if OpenSearch is disabled / empty).
      if (localUsers.length === 0) {
        // Exact case-insensitive match against the precomputed lowercased fields.
        // Equality on `nameLower` uses the btree index — no scan.
        localUsers = await readminCollections.roblox_user.find({
          $or: [{ nameLower: needle }, { displayNameLower: needle }],
        }, { projection: { id: 1, name: 1, headshotUrl: 1 } }).limit(10).toArray()
          .catch(() => [] as { id: number; name: string; headshotUrl?: string }[]);
      }
      // check roblox membership search [max of 10]
      if (localUsers.length === 0) {
        const foundUsers = await searchRobloxUsersByUsername(username, 10);
        localUsers = foundUsers.map(u => ({ id: u.id, name: u.name }));
      }

      if (isGroupSearch) {
        const members = await readminCollections.group_member.find({
          groupId,
          userId: { $in: localUsers.map(u => u.id) },
        }, { projection: { userId: 1 } }).toArray();
        const memberIdSet = new Set(members.map(m => m.userId));
        const finalUsers = localUsers
          .filter(u => memberIdSet.has(u.id))
          .map(u => ({ userId: u.id.toString(), name: u.name, thumbnail: u.headshotUrl || DEFAULT_THUMBNAIL }))
        return finalUsers.length > 0 ? finalUsers : localUsers.map(u => ({ userId: u.id.toString(), name: u.name, thumbnail: u.headshotUrl || DEFAULT_THUMBNAIL }));
      }
      return localUsers.map(u => ({ userId: u.id.toString(), name: u.name, thumbnail: u.headshotUrl || DEFAULT_THUMBNAIL }));
    }),
  searchRobloxUsersByUsernameMutation: connectedProcedure
    .input(
      z.object({
        username: z.string(),
        groupId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { username, groupId } = input;
      if (username == '') return [];
      const foundUsers = await BetterRobloxSearch(username, groupId);
      return foundUsers;
    }),
  getUserInfo: connectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { userId } = input;
      return await getUserInfo(userId);
    }),
  getRobloxUserThumbnail: connectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { userId } = input;
      if (userId == '') return '';
      return await getUserThumbnail(userId);
    }),
  getRobloxUser: connectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { userId } = input;
      return await getUserInfo(userId);
    }),
  getRobloxUserProcesed: connectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { userId } = input;
      return await getProcessedUserObject(userId, true);
    }),
  getRobloxUserProcesedQuery: connectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { userId } = input;
      if (userId == '0') {
        return {} as getProcessedUserObjectType;
      }
      return await getProcessedUserObject(userId, true);
    }),
  getRobloxGroupRoles: connectedProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { groupId } = input;
      const roles = await readminCollections.group_role.find({ groupId, rank: { $ne: 1 } }, { sort: { rank: 1 } }).toArray();
      return roles;
    }),
  getRobloxUserGroupRank: connectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string()
      }),
    )
    .query(async ({ input }) => {
      const { groupId, userId } = input;
      return await readminCollections.group_member.findOne({ groupId: groupId, userId: parseInt(userId) });
    }),
});
