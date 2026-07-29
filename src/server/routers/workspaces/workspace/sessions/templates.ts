import { v4 } from 'uuid';
import { z } from 'zod';
import { workspacePremiumProcedure } from '~/server/procedures';
import { SessionRoles } from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
export const workspaceSessionsTemplateRouter = router({
  getTemplates: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace } = ctx;
      const { } = input;
      const templates = await readminCollections.sessions_template.find({ groupId: workspace.groupId }).toArray();
      return templates;
    }),
  getTemplateById: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        templateId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace } = ctx;
      const { templateId } = input;
      const template = await readminCollections.sessions_template.findOne({ groupId: workspace.groupId, id: templateId });

      if (!template) {
        throw ReturnNormalFailure('NOT_FOUND', 'Template not found');
      }

      return template;
    }),
  createTemplate: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        description: z.string(),
        repeatType: z.enum(['daily', 'weekly']),
        time: z.object({
          hours: z.number(),
          minutes: z.number(),
        }),
        day: z
          .enum([
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
          ])
          .optional()
          .nullable(),
        game: z.string(),
        appearsMinutesBefore: z.string(),
        sessionDuration: z.string(),
        rolesEnabled: z.string().array(),
        createDiscordEvent: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const {
        name,
        description,
        repeatType,
        time,
        day,
        game,
        appearsMinutesBefore,
        sessionDuration,
        rolesEnabled,
        createDiscordEvent
      } = input;
      if (!department.permissions.sessions.manage) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to manage sessions',
        );
      }
      if (
        !name ||
        !repeatType ||
        !time ||
        !game ||
        !appearsMinutesBefore ||
        !rolesEnabled
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Missing required fields');
      }
      if (repeatType == 'weekly' && !day) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'Must include a day for weekly templates',
        );
      }
      if (repeatType == 'weekly' && day) {
        if (
          ![
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
          ].includes(day)
        ) {
          throw ReturnNormalFailure('BAD_REQUEST', 'Invalid day');
        }
      }
      if (
        time.hours == undefined ||
        typeof time.hours !== 'number' ||
        time.minutes == undefined ||
        typeof time.minutes !== 'number'
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Invalid time');
      }
      const foundGames = await readminCollections.game.findOne({
        gameId: parseInt(game),
        groupId: workspace.groupId,
      })
      if (!foundGames) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'Invalid game ID, or game is not tracked by ReAdmin',
        );
      }
      const roles: SessionRoles[] = [];
      for (const role of rolesEnabled) {
        const foundRole = await readminCollections.session_roles.findOne({
          groupId: workspace.groupId,
          id: role,
        });
        if (!foundRole) {
          throw ReturnNormalFailure(
            'BAD_REQUEST',
            'Invalid role ID, or role was deleted.',
          );
        }
        roles.push(foundRole);
      }
      const id = v4();

      // Okay create the template
      await readminCollections.sessions_template.insertOne({
        id,
        name,
        description,
        groupId: workspace.groupId,
        roles: rolesEnabled,
        schedule: repeatType == 'daily' ? {
          type: 'daily',
          hour: time.hours,
          minute: time.minutes
        } : {
          type: 'weekly',
          day: day!,
          hour: time.hours,
          minute: time.minutes
        },
        appearsMinutesBefore: parseInt(appearsMinutesBefore),
        sessionDuration: parseInt(sessionDuration),
        placeId: foundGames.placeId,
        gameId: foundGames.gameId,
        createDiscordEvent,
        created: new Date(),
      })
      await Promise.all(
        roles.map((a) => {
          return readminCollections.session_roles.updateOne({ id: a.id }, { $addToSet: { usedBy: id } })
        }),
      );

      return true;
    }),
  updateTemplate: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        description: z.string(),
        templateId: z.string(),
        name: z.string(),
        repeatType: z.enum(['daily', 'weekly']),
        time: z.object({
          hours: z.number(),
          minutes: z.number(),
        }),
        day: z
          .enum([
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
          ])
          .nullable()
          .optional(),
        game: z.string(),
        appearsMinutesBefore: z.string(),
        sessionDuration: z.string(),
        rolesEnabled: z.string().array(),
        createDiscordEvent: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const {
        templateId,
        name,
        description,
        repeatType,
        time,
        day,
        game,
        appearsMinutesBefore,
        rolesEnabled,
        sessionDuration,
        createDiscordEvent,
      } = input;
      const template = await readminCollections.sessions_template.findOne({
        groupId: workspace.groupId,
        id: templateId,
      })

      if (!template) {
        throw ReturnNormalFailure('NOT_FOUND', 'Could not find template');
      }
      if (!department.permissions.sessions.manage) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to manage sessions',
        );
      }
      if (
        !name ||
        !repeatType ||
        !time ||
        !game ||
        !appearsMinutesBefore ||
        !rolesEnabled
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Missing required fields');
      }
      if (repeatType == 'weekly' && !day) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'Must include a day for weekly templates',
        );
      }
      if (repeatType == 'weekly' && day) {
        if (
          ![
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
          ].includes(day)
        ) {
          throw ReturnNormalFailure('BAD_REQUEST', 'Invalid day');
        }
      }
      if (
        time.hours == undefined ||
        typeof time.hours !== 'number' ||
        time.minutes == undefined ||
        typeof time.minutes !== 'number'
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Invalid time');
      }
      const foundGames = await readminCollections.game.findOne({
        gameId: parseInt(game),
        groupId: workspace.groupId,
      })
      if (!foundGames) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'Invalid game ID, or game is not tracked by ReAdmin',
        );
      }
      const roles: SessionRoles[] = [];
      for (const role of rolesEnabled) {
        const foundRole = await readminCollections.session_roles.findOne({
          groupId: workspace.groupId,
          id: role,
        })
        if (!foundRole) {
          throw ReturnNormalFailure(
            'BAD_REQUEST',
            'Invalid role ID, or role was deleted.',
          );
        }
        roles.push(foundRole);
      }

      for (const thing of template.roles.filter(
        (a) => !rolesEnabled.includes(a),
      )) {
        const foundRole = await readminCollections.session_roles.findOne({
          groupId: workspace.groupId,
          id: thing,
        });
        if (foundRole) {
          await readminCollections.session_roles.updateOne(
            { id: foundRole.id },
            { $set: { usedBy: foundRole.usedBy.filter((a) => a !== template.id) } },
          );
          roles.push(foundRole);
        }
      }

      await readminCollections.sessions_template.updateOne({
        groupId: workspace.groupId,
        id: templateId,
      }, {
        $set: {
          name,
          description,
          roles: rolesEnabled,
          schedule: repeatType == 'daily' ? {
            type: 'daily',
            hour: time.hours,
            minute: time.minutes
          } : {
            type: 'weekly',
            day: day!,
            hour: time.hours,
            minute: time.minutes
          },
          appearsMinutesBefore: parseInt(appearsMinutesBefore),
          sessionDuration: parseInt(sessionDuration),
          placeId: foundGames.placeId,
          gameId: foundGames.gameId,
          createDiscordEvent,
        },
      })

      await Promise.all(
        roles.map((a) => {
          return readminCollections.session_roles.updateOne({ id: a.id }, { $addToSet: { usedBy: template.id } })
        }),
      );

      return template;
    }),
  deleteTemplate: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        templateId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { templateId } = input;
      if (!department.permissions.sessions.manage) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to manage sessions',
        );
      }
      await readminCollections.sessions_template.deleteOne({
        groupId: workspace.groupId,
        id: templateId,
      })

      return { success: true };
    }),
});
