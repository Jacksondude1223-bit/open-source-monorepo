import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { getTeamsSettings } from '~/services/workspaceServices/approvalChain.service';
import { ApprovalChainConfig } from '~/services/NewMongoTypes';

const approvalStepSchema = z.object({
  id: z.string(),
  type: z.enum(['manager', 'team', 'user']),
  managerLevel: z.number().int().min(1).max(20).optional(),
  teamId: z.string().optional(),
  userId: z.string().optional(),
  label: z.string().max(120).optional(),
});

const chainConfigSchema = z.object({
  mode: z.enum(['hierarchy', 'custom']),
  hierarchyLevels: z.number().int().min(1).max(20).optional(),
  steps: z.array(approvalStepSchema).max(20).optional(),
});

function normalizeChainConfig(config: z.infer<typeof chainConfigSchema>): ApprovalChainConfig {
  if (config.mode === 'hierarchy') {
    return { mode: 'hierarchy', hierarchyLevels: config.hierarchyLevels ?? 1 };
  }
  return {
    mode: 'custom',
    steps: (config.steps ?? []).map((s) => ({
      id: s.id,
      type: s.type,
      managerLevel: s.type === 'manager' ? s.managerLevel ?? 1 : undefined,
      teamId: s.type === 'team' ? s.teamId : undefined,
      userId: s.type === 'user' ? s.userId : undefined,
      label: s.label?.trim() || undefined,
    })),
  };
}

export const workspaceSettingsTeamsRouter = router({
  getSettings: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const settings = getTeamsSettings(ctx.workspace);
      const teams = await readminCollections.team
        .find({ groupId: ctx.workspace.groupId })
        .toArray();
      return {
        ...settings,
        teams: teams.map((t) => ({ _id: t._id!.toString(), name: t.name })),
      };
    }),

  updateSettings: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        enabled: z.boolean(),
        allowMemberExpenseRequests: z.boolean(),
        timeOff: chainConfigSchema,
        expenses: chainConfigSchema,
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
            teamsSettings: {
              enabled: input.enabled,
              allowMemberExpenseRequests: input.allowMemberExpenseRequests,
              timeOff: normalizeChainConfig(input.timeOff),
              expenses: normalizeChainConfig(input.expenses),
            },
          },
        },
      );

      return { ok: true };
    }),
});
