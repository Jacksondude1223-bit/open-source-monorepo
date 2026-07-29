import { v4 } from 'uuid';
import { z } from 'zod';
import { workspacePremiumProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';

export const workspaceSessionsRolesRouter = router({
  getRoles: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const { } = input;
      const foundRoles = await readminCollections.session_roles.find({ groupId: workspace.groupId }).toArray();
      return foundRoles;
    }),
  createRole: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const { name } = input;
      if (!department.permissions.sessions.manage) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'You do not have permissions to manage this',
        );
      }

      await readminCollections.session_roles.insertOne({
        id: v4(),
        groupId: workspace.groupId,
        name,
        roles: [],
        usedBy: [],
        created: new Date(),
      });

      return { success: true };
    }),
  updateRole: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        roleId: z.string(),
        name: z.string(),
        roles: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            maxUsers: z.number(),
            minRank: z.number(),
            claimOnce: z.boolean(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const { roleId, name, roles } = input;
      console.log(roles)
      if (!department.permissions.sessions.manage) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'You do not have permissions to manage this',
        );
      }

      await readminCollections.session_roles.updateOne({
        groupId: workspace.groupId,
        id: roleId,
      }, {
        $set: {
          name,
          roles,
        },
      });

      return { success: true };
    }),
  deleteRole: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const { roleId } = input;
      if (!department.permissions.sessions.manage) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'You do not have permissions to manage this',
        );
      }

      await readminCollections.session_roles.deleteOne({
        groupId: workspace.groupId,
        id: roleId,
      })

      return { success: true };
    }),
});
