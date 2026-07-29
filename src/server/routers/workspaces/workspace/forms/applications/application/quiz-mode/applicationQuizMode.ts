import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';

export const workspaceFormsApplicationsApplicationQuizModeRouter = router({
  saveSettings: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        settings: z.object({
          enabled: z.boolean(),
          mingrade: z.number(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, settings } = input;
      if (!department.permissions.applications.editApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to edit applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      const toSet: any = {};

      if (!application.autoGrading) {
        toSet.autoGrading = {
          enabled: false,
          mingrade: 0,
          questions: {},
        };
      } else {
        toSet.autoGrading = application.autoGrading;
      }
      toSet.autoGrading.enabled = settings.enabled;
      toSet.autoGrading.mingrade = settings.mingrade;


      await readminCollections.application.updateOne({
        _id: application._id,
      }, {
        $set: toSet,
      });

      return application;
    }),
  saveQuestions: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        settings: z.any(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, settings } = input;
      if (!department.permissions.applications.editApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to edit applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      const toSet: any = {};

      if (!application.autoGrading) {
        toSet.autoGrading = {
          enabled: false,
          mingrade: 0,
          questions: {},
        };
      } else {
        toSet.autoGrading = application.autoGrading;
      }
      toSet.autoGrading.questions = settings;

      await readminCollections.application.updateOne({
        _id: application._id,
      }, {
        $set: toSet,
      });

      return application;
    }),
});
