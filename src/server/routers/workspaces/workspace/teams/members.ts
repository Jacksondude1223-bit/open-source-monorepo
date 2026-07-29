import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import {
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  getEffectiveTeamMembers,
  getTeamById,
  addTeamRoleLink,
  removeTeamRoleLink,
  getTeamRoleLinks,
  getTeamRoleLinkById,
} from '~/services/teams.service';
import { getGroupRoles } from '~/services/roblox.service';
import { assertCanManageTeam, requireTeamView } from './auth';

export const workspaceTeamsMembersRouter = router({
  getMembers: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireTeamView(ctx);
      return getEffectiveTeamMembers(ctx.workspace.groupId, input.teamId);
    }),

  addMember: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        userId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      const team = await getTeamById(ctx.workspace.groupId, input.teamId);
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found.' });
      const roleExists = team.roles.some((r) => r.id === input.roleId);
      if (!roleExists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role not found in this team.' });
      await addTeamMember(ctx.workspace.groupId, input.teamId, input.userId, input.roleId, ctx.user.dbUser.robloxId!);
    }),

  removeMember: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      await removeTeamMember(ctx.workspace.groupId, input.teamId, input.userId);
    }),

  updateMemberRole: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        userId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      const team = await getTeamById(ctx.workspace.groupId, input.teamId);
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found.' });
      const roleExists = team.roles.some((r) => r.id === input.roleId);
      if (!roleExists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role not found in this team.' });
      await updateTeamMemberRole(ctx.workspace.groupId, input.teamId, input.userId, input.roleId);
    }),

  linkDepartment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        departmentId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      const team = await getTeamById(ctx.workspace.groupId, input.teamId);
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found.' });
      const roleExists = team.roles.some((r) => r.id === input.roleId);
      if (!roleExists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role not found in this team.' });

      await addTeamRoleLink(
        ctx.workspace.groupId,
        input.teamId,
        input.roleId,
        { sourceType: 'department', departmentId: input.departmentId },
        ctx.user.dbUser.robloxId!,
      );
    }),

  getGroupRoles: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      // No teamId here; the actual link mutation is team-scoped. Listing the group's
      // roles only needs team-view access (a lead linking their own team needs this).
      requireTeamView(ctx);
      const roles = await getGroupRoles(ctx.workspace.groupId, false);
      const minSyncRole = ctx.workspace.minSyncRole;
      const maxMembersInRole = ctx.workspace.overrideRoleMaximumSize || 15000;
      // Only expose roles that the member sync actually ingests into group_member.
      // Roles outside this set (the default "Member" role, roles below the minimum
      // sync rank, or roles over the size cap) would never resolve members on the
      // teams dashboard and could be very expensive to pull in, so they can't be linked.
      return (roles ?? []).filter(
        (r) =>
          r.rank > 0 &&
          !(r.rank === 1 && r.name === 'Member') &&
          r.rank >= minSyncRole &&
          r.memberCount <= maxMembersInRole,
      );
    }),

  linkGroupRole: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        robloxRoleId: z.number(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      const team = await getTeamById(ctx.workspace.groupId, input.teamId);
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found.' });
      const roleExists = team.roles.some((r) => r.id === input.roleId);
      if (!roleExists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role not found in this team.' });

      await addTeamRoleLink(
        ctx.workspace.groupId,
        input.teamId,
        input.roleId,
        { sourceType: 'robloxRole', robloxRoleId: input.robloxRoleId },
        ctx.user.dbUser.robloxId!,
      );
    }),

  getRoleLinks: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireTeamView(ctx);
      return getTeamRoleLinks(ctx.workspace.groupId, input.teamId);
    }),

  removeRoleLink: workspaceProcedure
    .input(z.object({ groupId: z.string(), linkId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // The link carries its own teamId; scope the check to that team.
      const link = await getTeamRoleLinkById(ctx.workspace.groupId, input.linkId);
      if (!link) throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found.' });
      await assertCanManageTeam(ctx, link.teamId.toString());
      await removeTeamRoleLink(ctx.workspace.groupId, input.linkId);
    }),
});

