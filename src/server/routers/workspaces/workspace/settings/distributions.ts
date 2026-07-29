import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import moment from 'moment-timezone';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';

export const workspaceSettingsDistributionsRouter = router({
  get: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      const { department, workspace } = ctx;

      const distributions = await readminCollections.distribution.find({
        groupId: workspace.groupId,
      }).toArray();

      return distributions;
    }),
  update: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        period: z.enum(['manual', 'weekly', 'biweekly', 'monthly']),
        discord: z.boolean(),
        day: z.number().int().min(0).max(6),
        timezone: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { period, discord, day, timezone } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      if (!moment.tz.zone(timezone)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid timezone provided',
        });
      }

      await readminCollections.workspace.updateOne({
        _id: workspace._id,
      }, {
        $set: {
          distributionPeriod: period,
          distributionDMs: discord,
          distributionDay: day,
          distributionTimezone: timezone,
        },
      })

      return true;
    }),
  manualDistribution: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId } = input;

      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const lastDistribution = await readminCollections.distribution.findOne({
        groupId,
        isCurrent: true,

      });

      if (!lastDistribution) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'This workspace is missing a distribution, please contact support',
        });
      }

      if (workspace.distributionPeriod !== 'manual') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Must be a manual distribution period to use manual distributions',
        });
      }
      if (
        lastDistribution.from >=
        new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must wait at-least 24 hours to distribute again.',
        });
      }

      const newDistribution = {
        groupId,
        num: lastDistribution.num + 1,
        from: new Date(),
        isCurrent: true,
        created: new Date(),
      };
      await readminCollections.distribution.insertOne(newDistribution);
      await readminCollections.distribution.updateOne({
        _id: lastDistribution._id,
      }, {
        $set: {
          to: new Date(),
          isCurrent: false,
        },
      });

      return true;
    }),
});
