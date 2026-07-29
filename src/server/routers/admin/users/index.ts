import { z } from 'zod';
import { founderProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';
import { createSessionFromDBUser } from '~/services/auth.service';
import stripeService from '~/services/stripe.service';
import { env } from '~/services/env';
import { syncUserInfoOnDemand } from '~/fastifyAPI/sync/sync-user-info';

export const adminUsersRouter = router({
  getUsers: founderProcedure
    .input(z.object({
      page: z.number().min(0).default(0),
      pageSize: z.number().min(1).max(100).default(25),
      searchTerm: z.string().optional(),
      sortField: z.enum(['created', 'name', 'robloxId']).default('created'),
      sortDirection: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { page, pageSize, searchTerm, sortField, sortDirection } = input;

      // Build filter based on search term
      const filter: any = {};
      if (searchTerm && searchTerm.trim()) {
        const trimmedSearch = searchTerm.trim();
        const searchRegex = { $regex: trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }

        filter.$or = [
          { name: searchRegex },
          { nickname: searchRegex },
          { stripeId: searchRegex },
          // Search robloxId as both string and number for flexibility
          { robloxId: { $regex: trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        ];

        // If the search term is numeric, also search for exact numeric match
        if (/^\d+$/.test(trimmedSearch)) {
          filter.$or.push({ robloxId: trimmedSearch });
        }
      }

      // Calculate skip value for pagination
      const skip = page * pageSize;

      // Build sort object
      const sort: any = {};
      sort[sortField] = sortDirection === 'asc' ? 1 : -1;

      // Execute queries in parallel
      const [users, totalCount] = await Promise.all([
        readminCollections.user.find(filter, {
          projection: {
            _id: 1,
            robloxId: 1,
            name: 1,
            stripeId: 1,
            created: 1,
            isModerated: 1
          },
          sort,
          skip,
          limit: pageSize
        }).toArray(),
        readminCollections.user.countDocuments(filter)
      ]);

      return {
        users,
        pagination: {
          page,
          pageSize,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      };
    }),
  getUserDetails: founderProcedure
    .input(z.object({
      userId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = input;
      const user = await readminCollections.user.findOne(
        { _id: StringToObjectID(userId) },
        {
          projection: {
            password: 0 // Exclude sensitive data
          }
        }
      );
      if (!user) throw new Error('User not found');
      return user;
    }),
  // Admin-triggered refresh of a user's cached Roblox info (name / displayName /
  // thumbnail) in the canonical roblox_user collection + search index. Forces the
  // sync so founders are never blocked by the per-user cooldown.
  refreshRobloxInfo: founderProcedure
    .input(z.object({
      robloxId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const robloxId = parseInt(input.robloxId);
      if (Number.isNaN(robloxId) || robloxId <= 0) {
        throw new Error('A valid Roblox ID is required');
      }
      return await syncUserInfoOnDemand(robloxId, { force: true });
    }),
  banUser: founderProcedure.input(z.object({
    userId: z.string(),
    type: z.enum(['ban', 'warning']),
    reason: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { userId, type, reason } = input;

    const foundUser = await readminCollections.user.findOne({ _id: StringToObjectID(userId) });
    if (!foundUser) throw new Error('User not found');
    await readminCollections.user.updateOne({ _id: foundUser._id }, {
      $set: {
        isModerated: {
          is: true,
          type: type,
          reason,
          bannedBy: user.dbUser.robloxId
        }
      }
    });
    return true;
  }),
  unbanUser: founderProcedure.input(z.object({
    userId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { userId } = input;
    const foundUser = await readminCollections.user.findOne({ _id: StringToObjectID(userId) });
    if (!foundUser) throw new Error('User not found');
    await readminCollections.user.updateOne({ _id: foundUser._id }, { $set: { isModerated: false } });
    return true;
  }),
  impersonateUser: founderProcedure.input(z.object({
    userId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { userId } = input;

    // Find the user to impersonate
    const foundUser = await readminCollections.user.findOne({ _id: StringToObjectID(userId) });
    if (!foundUser) {
      throw new Error('User not found');
    }

    // Security check: Don't allow impersonating other founders
    if (foundUser.role !== 'Founder' && foundUser.robloxId !== user.dbUser.robloxId) {
      throw new Error('Cannot impersonate founders');
    }

    // Additional security check: Don't allow impersonating yourself
    if (foundUser.robloxId === user.dbUser.robloxId) {
      throw new Error('Cannot impersonate yourself');
    }    // Security check: Don't allow impersonating banned users
    if (foundUser.isModerated && typeof foundUser.isModerated === 'object' && foundUser.isModerated.is) {
      throw new Error('Cannot impersonate banned users');
    }

    // Create a new session for the target user
    const [token, impersonatedUser] = await createSessionFromDBUser(foundUser);

    return {
      success: true,
      token,
      user: {
        id: foundUser._id?.toString(),
        robloxId: foundUser.robloxId?.toString(),
        name: foundUser.name,
        role: foundUser.role
      }
    };
  }),
  deleteUser: founderProcedure.input(z.object({
    userId: z.string(),
    gdprDelete: z.boolean().default(false)
  })).mutation(async ({ ctx, input }) => {
    const user = await readminCollections.user.findOne({ _id: StringToObjectID(input.userId) });
    if (!user) {
      throw new Error('User not found');
    }

    // If GDPR delete is requested, add user to GDPR removed collection
    if (input.gdprDelete) {
      // Check if user is already in GDPR collection to avoid duplicates
      const existingGdprRecord = await readminCollections.gdpr_removed_user.findOne({
        robloxId: parseInt(user.robloxId)
      });

      if (!existingGdprRecord) {
        await readminCollections.gdpr_removed_user.insertOne({
          robloxId: parseInt(user.robloxId),
          created: new Date()
        } as any);
      }
    }

    await Promise.all([
      readminCollections.user.deleteOne({ _id: user._id }),
      readminCollections.department_users.deleteMany({ userId: user.robloxId }),
      readminCollections.group_audit_log.deleteMany({ userId: user.robloxId }),
      readminCollections.group_member.deleteMany({ userId: parseInt(user.robloxId) }),
      readminCollections.inactivity.deleteMany({ userId: user.robloxId }),
      readminCollections.manual_minutes.deleteMany({ userId: user.robloxId }),
      readminCollections.response.deleteMany({ userId: user.robloxId }),
      readminCollections.roblox_group_action_queue.deleteMany({ userId: user.robloxId }),
      readminCollections.running_game_players.deleteMany({ userId: user.robloxId }),
      readminCollections.running_game_chats.deleteMany({ userId: user.robloxId }),
      readminCollections.feed.deleteMany({ userId: user.robloxId }),
      readminCollections.user_game_session.deleteMany({ userId: parseInt(user.robloxId) }),
      readminCollections.user_game_session_distribution_summary.deleteMany({ userId: user.robloxId }),
      readminCollections.user_game_session_yearly_summary.deleteMany({ userId: user.robloxId }),
      readminCollections.user_note.deleteMany({ userId: user.robloxId }),
      readminCollections.workspace_bans.deleteMany({ userId: user.robloxId }),
      readminCollections.workspace_tag_member.deleteMany({ userId: user.robloxId }),
      readminCollections.write_ups.deleteMany({ userId: parseInt(user.robloxId) }),
      readminCollections.orders.deleteMany({ userId: user.robloxId }),
    ])
    try {
      await stripeService.customers.del(env.STRIPE_SECRET.startsWith('sk_test') ? user.testStripeId || '' : user.stripeId || '');
    } catch (e) {

    }
    return true;
  })
})