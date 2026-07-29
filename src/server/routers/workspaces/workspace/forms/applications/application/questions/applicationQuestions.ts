import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';

export const workspaceFormsApplicationsApplicationQuestionsRouter = router({
  saveQuestions: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        questions: z.any(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, questions } = input;
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

      await readminCollections.application.updateOne({
        _id: application._id,
      }, {
        $set: {
          questions,
        }
      });

      return application;
    }),
});
