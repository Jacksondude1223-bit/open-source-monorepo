import { TRPCError } from '@trpc/server';
import { on } from 'events';
import { Filter } from 'mongodb';
import { z } from 'zod';
import calculateSummaries from '~/services/businessLogic/calculateSummaries';
import { workspacePremiumProcedure } from '~/server/procedures';
import { ManualMinutes, UserGameSession, UserGameSessionDistributionSummary, UserGameSessionEvent } from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';
import {
  getUserInfo,
  getUserThumbnail,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';
import calculateMinutes from '~/services/businessLogic/calculateMinutes';

export const workspaceActivityUsersActivityRouter = router({
  getDistributionSessions: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        distributionNumber: z.number().optional().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace } = ctx;
      const { groupId, userId, distributionNumber } = input;
      const search: Filter<UserGameSession> = {
        groupId: parseInt(groupId),
        userId: parseInt(userId),
      };
      const currentDistribution = await readminCollections.distribution.findOne({
        groupId: workspace.groupId,
        isCurrent: true,
      }, { sort: { created: -1 } });
      if (distributionNumber) {
        search.distribution = distributionNumber;
      } else {
        search.distribution = currentDistribution?.num;
      }
      const sessions = await readminCollections.user_game_session.find(search, {
        sort: { created: -1 }
      }).toArray();
      return sessions || [];
    }),
  getDistributionSummaries: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string().optional(),
        distributionNumber: z.number().optional().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      const { groupId, userId, distributionNumber } = input;
      const search: Filter<UserGameSessionDistributionSummary> = {
        groupId,
        userId: userId || user.dbUser.robloxId.toString(),
      };
      const currentDistribution = await readminCollections.distribution.findOne({
        groupId: workspace.groupId, isCurrent: true
      });
      if (distributionNumber) {
        search.distribution = distributionNumber.toString();
      } else {
        search.distribution = currentDistribution?.num.toString();
      }
      const sessions = await readminCollections.user_game_session_distribution_summary.findOne(search);
      return sessions;
    }),
  getUserGameSessionEvents: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      const { groupId, sessionId } = input;
      const sessionOId = StringToObjectID(sessionId);
      const session = await readminCollections.user_game_session.findOne({ _id: sessionOId });
      if (!session || session.groupId !== parseInt(groupId)) {
        return [];
      }
      return await readminCollections.user_game_session_event.find({ userGameSession: sessionOId }, { sort: { date: 1 } }).toArray();
    }),
  // streamedUserGameSessionEvents: workspacePremiumProcedure
  //   .input(
  //     z.object({
  //       groupId: z.string(),
  //       sessionId: z.string(),
  //     }),
  //   )
  //   .subscription(async function* ({ ctx, input, signal }) {
  //     const { workspace, user } = ctx;
  //     const { groupId, sessionId } = input;
  //     const sessionOId = StringToObjectID(sessionId);
  //     const session = await readminCollections.user_game_session.findOne({ _id: sessionOId });
  //     if (!session || session.groupId !== parseInt(groupId)) {
  //       throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You are not able to perform this action' });
  //     }
  //     const stream = readminCollections.user_game_session_event.watch([{ $match: { operationType: 'insert', 'fullDocument.userGameSession': sessionOId } }], { fullDocument: 'whenAvailable', showExpandedEvents: true });
  //     for await (const [data] of on(stream, 'change', {
  //       signal: signal,
  //     })) {
  //       console.log(stream)
  //       if (!data.fullDocument) {
  //         continue;
  //       }

  //       yield data.fullDocument as UserGameSessionEvent;
  //     }


  //     signal?.addEventListener('abort', (e) => {
  //       console.log('abort', e)
  //       stream.close()
  //     })
  //   }),
  recalculateSessionEvent: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      const { groupId, sessionId } = input;
      const sessionOId = StringToObjectID(sessionId);
      const session = await readminCollections.user_game_session.findOne({ _id: sessionOId });
      if (!session || session.groupId !== parseInt(groupId)) {
        return true;
      }
      calculateMinutes(workspace, session._id, false)
      return true
    }),
  getYearlySummary: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        year: z.string().optional().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace } = ctx;
      const { groupId, userId, year } = input;
      const dbYear = year || new Date().getFullYear();
      const sessions = await readminCollections.user_game_session_yearly_summary.findOne({
        groupId,
        userId,
        year: dbYear.toString(),
      });
      return sessions || {};
    }),
  getAvailableYears: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { groupId, userId } = input;
      // Small per-user collection (one doc per year), safe to query directly.
      const years = await readminCollections.user_game_session_yearly_summary
        .find({ groupId, userId }, { projection: { year: 1 } })
        .toArray();
      const yearSet = new Set<string>(years.map((y) => y.year));
      yearSet.add(new Date().getFullYear().toString());
      return Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
    }),
  backfillSummaries: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Premium-only: workspacePremiumProcedure already enforces this.
      // Recomputes the user's summaries so historical years gain the daily
      // heatmap buckets. Operates only on this single user's sessions.
      const { workspace } = ctx;
      const { userId } = input;
      await calculateSummaries(workspace, userId, false);
      return { success: true };
    }),
  getManualMinutes: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        distributionNumber: z.number().optional().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace } = ctx;
      const { groupId, userId, distributionNumber } = input;
      const search: Filter<ManualMinutes> = {
        groupId,
        userId,
      };
      const currentDistribution = await readminCollections.distribution.findOne({
        groupId: workspace.groupId, isCurrent: true,
      });
      if (distributionNumber) {
        search.distribution = parseInt(distributionNumber.toString());
      } else {
        search.distribution = parseInt(
          //@ts-expect-error this is right
          currentDistribution?.num.toString(),
        );
      }
      const manualMinutes = await readminCollections.manual_minutes.find(search).toArray();
      const mappedManualMinutes = await Promise.all(
        manualMinutes.map(async (a) => {
          return {
            ...a,
            authorInfo: {
              ...(await getUserInfo(a.createdBy)),
              thumbnail: await getUserThumbnail(a.createdBy),
            },
          };
        }),
      );
      return mappedManualMinutes;
    }),
  createManualMinutes: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        minuteType: z.enum(['active', 'idle', 'typing']),
        distribution: z.number(),
        timeAmount: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, userId, minuteType, distribution, timeAmount } = input;

      if (!department.permissions.activity.admin) {
        return new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not able to perform this action',
        });
      }

      const newManual = {
        groupId,
        userId,
        createdBy: user.roblox?.id.toString() || '',
        type: minuteType,
        minutes: timeAmount,
        distribution,
        created: new Date(),
      };

      await readminCollections.manual_minutes.insertOne(newManual);
      await calculateSummaries(workspace, userId);

      return newManual;
    }),
  deleteManualMinutes: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        manualMinutesId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, userId, manualMinutesId } = input;

      if (!department.permissions.activity.admin) {
        return new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not able to perform this action',
        });
      }

      const found = await readminCollections.manual_minutes.findOne({
        groupId,
        userId,
        _id: StringToObjectID(manualMinutesId),
      });

      if (!found) {
        return {};
      }

      await readminCollections.manual_minutes.deleteOne({
        _id: found._id
      });
      await calculateSummaries(workspace, userId);

      return {};
    }),
});
