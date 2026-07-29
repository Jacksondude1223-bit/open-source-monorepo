import { getTeamsForUser } from '~/services/teams.service';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import {
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamsForWorkspace,
  getTeamById,
  addTeamRole,
  updateTeamRole,
  removeTeamRole,
  getAllEffectiveMembers,
  getEffectiveTeamMembers,
  userCanManageTeam,
} from '~/services/teams.service';
import { batchGetRobloxUsers } from '~/services/roblox.service';
import { validateNoCircularReference } from '~/services/teamHierarchy.service';
import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { assertCanManageTeam, requireManageAllTeams, requireTeamView } from './auth';

export const workspaceTeamsCoreRouter = router({
    getTeamsForUser: workspaceProcedure
      .input(z.object({ groupId: z.string(), userId: z.string() }))
      .query(async ({ ctx, input }) => {
        requireTeamView(ctx);
        return getTeamsForUser(ctx.workspace.groupId, input.userId);
      }),
  getAll: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      requireTeamView(ctx);
      const [teams, membersByTeam] = await Promise.all([
        getTeamsForWorkspace(ctx.workspace.groupId),
        getAllEffectiveMembers(ctx.workspace.groupId),
      ]);
      return teams.map((team) => ({
        ...team,
        memberCount: membersByTeam.get(team._id!.toString())?.length ?? 0,
      }));
    }),

  getById: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireTeamView(ctx);
      const team = await getTeamById(ctx.workspace.groupId, input.teamId);
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found.' });
      const members = await getEffectiveTeamMembers(ctx.workspace.groupId, input.teamId);
      // Enrich members with usernames so the UI can search/sort by name.
      const userMap = await batchGetRobloxUsers(
        members.map((m) => Number(m.userId)).filter((n) => !Number.isNaN(n)),
      );
      const enriched = members.map((m) => {
        const u = userMap.get(Number(m.userId));
        return {
          ...m,
          username: u?.name ?? null,
          displayName: u?.displayName ?? null,
        };
      });
      const viewerCanManage = await userCanManageTeam({
        groupId: ctx.workspace.groupId,
        userId: ctx.user.dbUser.robloxId ?? '',
        teamId: input.teamId,
        permissions: ctx.department.permissions,
      });
      return { ...team, members: enriched, viewerCanManage };
    }),

  create: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string().min(1).max(80),
        description: z.string().max(500).optional(),
        parentTeamId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireManageAllTeams(ctx);
      return createTeam(ctx.workspace.groupId, ctx.user.dbUser.robloxId!, {
        name: input.name,
        description: input.description,
        parentTeamId: input.parentTeamId,
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(500).optional(),
        parentTeamId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      if (input.parentTeamId) {
        const ok = await validateNoCircularReference(
          ctx.workspace.groupId,
          input.teamId,
          input.parentTeamId,
        );
        if (!ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This would create a circular team hierarchy.',
          });
        }
      }
      await updateTeam(ctx.workspace.groupId, input.teamId, {
        name: input.name,
        description: input.description,
        parentTeamId: input.parentTeamId,
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      // Cascade-delete all documents for this team
      await readminCollections.team_document.deleteMany({
        groupId: input.groupId,
        teamId: StringToObjectID(input.teamId),
      });
      await deleteTeam(ctx.workspace.groupId, input.teamId);
    }),

  // ── Roles ──────────────────────────────────────────────────────────────────

  addRole: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        name: z.string().min(1).max(60),
        isLead: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      return addTeamRole(ctx.workspace.groupId, input.teamId, {
        name: input.name,
        isLead: input.isLead,
      });
    }),

  updateRole: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        roleId: z.string(),
        name: z.string().min(1).max(60).optional(),
        isLead: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      await updateTeamRole(ctx.workspace.groupId, input.teamId, input.roleId, {
        name: input.name,
        isLead: input.isLead,
      });
    }),

  removeRole: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string(), roleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      await removeTeamRole(ctx.workspace.groupId, input.teamId, input.roleId);
    }),
});
