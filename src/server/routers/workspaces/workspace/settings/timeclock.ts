import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { DEFAULT_MAX_SHIFT_HOURS } from '~/services/workspaceServices/timeclock';

export const workspaceSettingsTimeclockRouter = router({
  getSettings: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const settings = ctx.workspace.timeclockSettings;
      const departments = await readminCollections.department
        .find({ groupId: ctx.workspace.groupId })
        .toArray();
      return {
        enabled: settings?.enabled === true,
        enabledDepartments: settings?.enabledDepartments ?? [],
        allowManualEntries: settings?.allowManualEntries !== false,
        maxShiftHours: settings?.maxShiftHours ?? DEFAULT_MAX_SHIFT_HOURS,
        autoClockOutOverMax: settings?.autoClockOutOverMax === true,
        departments: departments.map((d) => ({
          _id: d._id!.toString(),
          name: d.name,
          isOwner: d.isOwner === true,
        })),
      };
    }),
  updateSettings: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        enabled: z.boolean(),
        enabledDepartments: z.array(z.string()),
        allowManualEntries: z.boolean(),
        maxShiftHours: z.number().min(1).max(48),
        autoClockOutOverMax: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
      }

      await readminCollections.workspace.updateOne(
        { _id: workspace._id },
        {
          $set: {
            timeclockSettings: {
              enabled: input.enabled,
              enabledDepartments: input.enabledDepartments,
              allowManualEntries: input.allowManualEntries,
              maxShiftHours: input.maxShiftHours,
              autoClockOutOverMax: input.autoClockOutOverMax,
            },
          },
        },
      );

      return { ok: true };
    }),
});
