import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { ActivityRequirement } from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import StringToObjectID from '~/utils/StringToObjectID';

export const workspaceSettingsActivityGoalsRouter = router({
  getGoals: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId } = input;
      const goals = await readminCollections.activity_requirements.find({ groupId }).toArray();
      return goals;
    }),
  createGoal: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        creatingForGameOrGlobal: z.enum(['game', 'global']),
        game: z
          .object({ gameId: z.string(), placeId: z.string() })
          .nullable()
          .optional(),
        minimumMinutes: z.string(),
        minimumActiveMinutes: z.string(),
        minimumMessages: z.string(),
        minimumSessions: z.string(),
        departmentsSelected: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const {
        groupId,
        name,
        creatingForGameOrGlobal,
        game,
        minimumMinutes,
        minimumActiveMinutes,
        minimumMessages,
        minimumSessions,
        departmentsSelected,
      } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      if (
        creatingForGameOrGlobal == 'game' &&
        !(game && game?.gameId && game?.placeId)
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'You must select a game');
      }
      const foundDepartments = await readminCollections.department.find({
        groupId,
        _id: { $in: departmentsSelected.map(a => StringToObjectID(a)) },

      }).toArray();
      if (foundDepartments.length == 0) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'You must select at least a single valid department',
        );
      }
      const newGoal: ActivityRequirement = {
        groupId,
        name,
        departments: foundDepartments.map((a) => a._id),
        type: creatingForGameOrGlobal,
        minimumMinutes: parseInt(minimumMinutes) || 0,
        minimumActiveMinutes: parseInt(minimumActiveMinutes) || 0,
        minimumMessages: parseInt(minimumMessages) || 0,
        minimumSessions: parseInt(minimumSessions) || 0,
        created: new Date(),
      };
      if (creatingForGameOrGlobal == 'game') {
        newGoal.gameId = game ? game?.gameId || '0' : '0';
        newGoal.placeId = game ? game?.placeId || '0' : '0';
      }

      await readminCollections.activity_requirements.insertOne(newGoal);


      return newGoal;
    }),
  updateGoal: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        goalId: z.string(),
        name: z.string(),
        creatingForGameOrGlobal: z.enum(['game', 'global']),
        game: z
          .object({ gameId: z.string(), placeId: z.string() })
          .nullable()
          .optional(),
        minimumMinutes: z.string(),
        minimumActiveMinutes: z.string(),
        minimumMessages: z.string(),
        minimumSessions: z.string(),
        departmentsSelected: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const {
        groupId,
        goalId,
        name,
        creatingForGameOrGlobal,
        game,
        minimumMinutes,
        minimumActiveMinutes,
        minimumMessages,
        minimumSessions,
        departmentsSelected,
      } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      if (
        creatingForGameOrGlobal == 'game' &&
        !(game && game?.gameId && game?.placeId)
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'You must select a game');
      }
      const foundDepartments = await readminCollections.department.find({
        groupId,
        _id: { $in: departmentsSelected.map(a => StringToObjectID(a)) },

      }).toArray();
      if (foundDepartments.length == 0) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'You must select at least a single valid department',
        );
      }
      const newGoal = await readminCollections.activity_requirements.findOne({
        _id: StringToObjectID(goalId), groupId,
      });
      if (!newGoal) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Could not find goal');
      }

      const { _id, ...goalWithoutId } = newGoal;
      const toSet: ActivityRequirement = {
        ...goalWithoutId,
        name,
        departments: foundDepartments.map((a) => a._id),
        type: creatingForGameOrGlobal,
        minimumMinutes: parseInt(minimumMinutes) || 0,
        minimumActiveMinutes: parseInt(minimumActiveMinutes) || 0,
        minimumMessages: parseInt(minimumMessages) || 0,
        minimumSessions: parseInt(minimumSessions) || 0,
      };


      if (creatingForGameOrGlobal == 'game') {
        toSet.gameId = game ? game?.gameId || '0' : '0';
        toSet.placeId = game ? game?.placeId || '0' : '0';
      } else {
        delete toSet.gameId;
        delete toSet.placeId;
      }

      await readminCollections.activity_requirements.updateOne({
        _id: newGoal._id,
      }, {
        $set: toSet,
      })

      return newGoal;
    }),
  deleteGoal: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        goalId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, goalId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const found = await readminCollections.activity_requirements.findOne({
        groupId,
        _id: StringToObjectID(goalId),
      });
      if (found) {
        await readminCollections.activity_requirements.deleteOne({
          _id: found._id,
        });
      }
      return true;
    }),
});
