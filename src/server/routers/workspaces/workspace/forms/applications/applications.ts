import { router } from '~/server/trpc';
import { workspaceFormsApplicationsApplicationRouter } from './application/application';
import { workspaceProcedure } from '~/server/procedures';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { readminCollections } from '~/services/mongo.service';
import { Application } from '~/services/NewMongoTypes';
import StringToObjectID from '~/utils/StringToObjectID';

export const workspaceFormsApplicationsRouter = router({
  application: workspaceFormsApplicationsApplicationRouter,
  getApplications: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const { user, workspace } = ctx;
      const perms = ctx.department.permissions.applications;
      if (!user) return;
      if (
        !perms.editApplications &&
        !perms.viewApplications &&
        !perms.readApplications
      ) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to view or manage applications.',
        });
      }
      const applications = await readminCollections.application.find({
        groupId: workspace.groupId
      }).toArray() as (Application & { responses?: number })[];
      for (const application of applications) {
        const totalResponses = await readminCollections.response.countDocuments({
          applicationId: (application?._id || '').toString()
        });
        application.responses = totalResponses;
      }
      return applications;
    }),
  getUserResponses: workspaceProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = ctx;
      const perms = ctx.department.permissions.applications;
      if (
        !perms.editApplications &&
        !perms.viewApplications &&
        !perms.readApplications
      ) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to view applications.',
        });
      }

      const responses = await readminCollections.response
        .find({ groupId: workspace.groupId, userId: input.userId.toString() }, { sort: { created: -1 } })
        .toArray();

      const applicationCache = new Map<string, Application | null>();
      const mapped = await Promise.all(
        responses.map(async (response) => {
          let application = applicationCache.get(response.applicationId);
          if (application === undefined) {
            application = await readminCollections.application.findOne({
              _id: StringToObjectID(response.applicationId),
            });
            applicationCache.set(response.applicationId, application);
          }
          return {
            id: response._id?.toString(),
            applicationId: response.applicationId,
            applicationName: application?.name || 'Unknown Application',
            source: response.source,
            status: response.status,
            score: response.score ?? null,
            timeTakenSeconds: response.timeTakenSeconds,
            created: response.created,
          };
        }),
      );

      return mapped;
    }),
  createApplication: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      if (!user) return;
      const { name, description } = input;

      if (!ctx.department.permissions.applications.editApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to view or manage applications.',
        });
      }

      const defaultRoblox = {
        enabled: false,
        ranking: {
          enabled: false,
          rankTo: 0,
        },
        message: {
          enabled: false,
          title: '',
          message: '',
        },
        punishment: {
          exile: false,
        },
      };
      const defaultDiscord = {
        dm: {
          enabled: false,
          message: '',
        },
        ranking: {
          enabled: false,
          guild: '',
          rank: '',
        },
        punishment: {
          ban: false,
          kick: false,
        },
      };

        const newApplication: Application = {
          groupId: workspace.groupId,
          name,
          description,
          buttonType: 'submit',
          permissions: {
            acceptingResponses: false,
            ranking: {
              minRank: 0,
              maxRank: 0,
            },
            applyOnce: false,
            timeUntilApplyAgain: 0,
          },
          responseChannels: {
            web: true,
            game: true,
          },
          responseWindow: {
            enabled: false,
          },
          hideIfIneligible: false,
          statusOptions: ['pending', 'passed', 'reported', 'failed'],
          applicantVisibility: {
            showAnswers: false,
            showQuizCorrectness: false,
            showCorrectAnswers: false,
            showStatus: true,
          },
          links: {
            showRobloxGroup: false,
            showDiscord: false,
          },
          appearance: {
            audios: [],
            showLogo: true,
            showBanner: true,
            theme: {},
          },
          autoGrading: {
            enabled: false,
            mingrade: 0,
            questions: {},
          },
          automations: {
            roblox: {
              sent: defaultRoblox,
              passed: defaultRoblox,
              reported: defaultRoblox,
              failed: defaultRoblox,
            },
            discord: {
              sent: defaultDiscord,
              passed: defaultDiscord,
              reported: defaultDiscord,
              failed: defaultDiscord,
            },
          },
          questions: [],
          created: new Date(),
        };

      await readminCollections.application.insertOne(newApplication);

      return newApplication;
    }),
  deleteApplication: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      if (!user) return;
      if (!ctx.department.permissions.applications.editApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to manage applications.',
        });
      }

      const application = await readminCollections.application.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(input.applicationId),
      });
      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      await readminCollections.response.deleteMany({
        groupId: workspace.groupId,
        applicationId: application._id.toString(),
      });
      await readminCollections.application.deleteOne({ _id: application._id });

      return { success: true };
    }),
});
