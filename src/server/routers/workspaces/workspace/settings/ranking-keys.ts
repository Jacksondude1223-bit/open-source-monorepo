import { router } from '~/server/trpc';
import { z } from "zod";
import { workspacePremiumProcedure } from "~/server/procedures";
import { v4 } from 'uuid';
import { generateSecureString } from '~/services/Crypto-service.service';
import { TRPCError } from '@trpc/server';
import { readminCollections } from '~/services/mongo.service';
import { searchRobloxUsersByUsername } from '~/services/roblox.service';


export const workspaceSettingsRankingKeysRouter = router({
  get: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must be an admin to do this.',
        });
      }
      const keys = await readminCollections.ranking_key.find({ groupId }).toArray();
      return keys;
    }),
  create: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { groupId } = input;
      if (!department.permissions.admin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must be an admin to do this.',
        });
      }

      const newKey = {
        groupId: groupId,
        id: v4(),
        key: `DO_NOT_SHARE_ReAdmin_Ranking_Key_Id_DO_NOT_SHARE=${await generateSecureString(150)}`,
        name: 'New Key',
        rankingEnabled: false,
        allowedRanks: [],
        enableShouting: false,
        enableJoinRequestManagement: false,
        enableExile: false,
        created: new Date(),
      };
      await readminCollections.ranking_key.insertOne(newKey);

      return newKey;
    }),
  edit: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        keyId: z.string(),
        name: z.string(),
        rankingEnabled: z.boolean(),
        selectedRanks: z.array(z.string()),
        enableShouting: z.boolean(),
        enableJoinRequestManagement: z.boolean(),
        enableExile: z.boolean()
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { groupId, keyId, name, rankingEnabled, selectedRanks, enableShouting, enableJoinRequestManagement, enableExile } = input;
      if (!department.permissions.admin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must be an admin to do this.',
        });
      }
      const key = await readminCollections.ranking_key.findOne({ groupId, id: keyId });
      if (!key) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid key',
        });
      }

      await readminCollections.ranking_key.updateOne({ _id: key._id }, {
        $set: {
          name,
          rankingEnabled,
          allowedRanks: selectedRanks.map(a => parseInt(a)),
          enableShouting,
          enableJoinRequestManagement,
          enableExile,
        }
      });

      return key;
    }),
  reloadQueue: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        keyId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { groupId, keyId } = input;
      if (!department.permissions.admin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must be an admin to do this.',
        });
      }
      const key = await readminCollections.ranking_key.findOne({ groupId, id: keyId });
      if (!key) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid key',
        });
      }

      await readminCollections.ranking_key.updateOne({ _id: key._id }, {
        $set: {
          key: `DO_NOT_SHARE_ReAdmin_Ranking_Key_Id_DO_NOT_SHARE=${await generateSecureString(150)}`,
        }
      })

      return key;
    }),
  getEvents: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        keyId: z.string(),
        skip: z.number().optional().default(0),
        limit: z.number().optional().default(10),
        search: z.string().optional(),
        sortField: z.enum(['created', 'status', 'actionType', 'userId']).optional().default('created'),
        sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId, keyId, skip, limit, search, sortField, sortOrder } = input;
      if (!department.permissions.admin) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You must be an admin to do this.' });
      }

      // Build base filter
      const filter: any = { groupId, 'rankingApiMetadata.rankingKeyId': keyId };

      // Add search filters
      if (search && search.trim()) {
        const trimmedSearch = search.trim();
        const searchFilters: any[] = [];

        // Search by action type (case insensitive)
        searchFilters.push({ actionType: { $regex: trimmedSearch, $options: 'i' } });

        // Search by username (get matching user IDs)
        try {
          const matchingUsers = await searchRobloxUsersByUsername(trimmedSearch, 20);
          if (matchingUsers.length > 0) {
            searchFilters.push({ userId: { $in: matchingUsers.map(u => u.id.toString()) } });
          }
        } catch (error) {
          // If Roblox search fails, continue with action type search only
          console.warn('Roblox username search failed:', error);
        }

        if (searchFilters.length > 0) {
          filter.$or = searchFilters;
        }
      }

      // Build sort object
      const sortObj: any = {};
      sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;

      const total = await readminCollections.roblox_group_action_queue.countDocuments(filter);
      const events = await readminCollections.roblox_group_action_queue
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .toArray();
      return { events, total };
    }),
  delete: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        keyId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { groupId, keyId } = input;
      if (!department.permissions.admin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must be an admin to do this.',
        });
      }
      const key = await readminCollections.ranking_key.findOne({ groupId, id: keyId });
      if (!key) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid key',
        });
      }
      await readminCollections.ranking_key.deleteOne({ _id: key._id });
      await readminCollections.roblox_group_action_queue.deleteMany({ groupId, 'rankingApiMetadata.rankingKeyId': key.id });

      return true;
    }),
})