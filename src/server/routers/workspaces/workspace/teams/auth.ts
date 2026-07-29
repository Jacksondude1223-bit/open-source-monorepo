import { TRPCError } from '@trpc/server';
import { userCanManageTeam } from '~/services/teams.service';

// Shared authorization helpers for the team routers.
//
// Model (see Department.type.ts):
//   - teams.view      → see teams / org chart
//   - teams.manage    → manage the team(s) you lead
//   - teams.manageAll → create + manage ALL teams regardless of leadership
//   - admin           → everything
// Editing a *specific* team requires admin, manageAll, or being a lead of that team.

type TeamCtx = {
  department: { permissions: any };
  workspace: { groupId: string };
  user: { dbUser: { robloxId?: string | null } };
};

export function requireTeamView(ctx: { department: { permissions: any } }) {
  const p = ctx.department.permissions;
  if (!p.admin && !p.teams?.view && !p.teams?.manage && !p.teams?.manageAll) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to view teams.' });
  }
}

// Creating a team isn't scoped to an existing team's leadership, so it needs the
// workspace-wide "manage all teams" capability (or admin).
export function requireManageAllTeams(ctx: { department: { permissions: any } }) {
  if (!ctx.department.permissions.admin && !ctx.department.permissions.teams?.manageAll) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to create teams.' });
  }
}

export async function canManageTeam(ctx: TeamCtx, teamId: string): Promise<boolean> {
  return userCanManageTeam({
    groupId: ctx.workspace.groupId,
    userId: ctx.user.dbUser.robloxId ?? '',
    teamId,
    permissions: ctx.department.permissions,
  });
}

export async function assertCanManageTeam(ctx: TeamCtx, teamId: string) {
  if (!(await canManageTeam(ctx, teamId))) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to manage this team.' });
  }
}
