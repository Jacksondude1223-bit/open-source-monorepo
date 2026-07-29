import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { Team, TeamMember } from '~/services/NewMongoTypes';
import { getEffectiveTeamMembers, getAllEffectiveMembers } from '~/services/teams.service';
import { memberDepartmentIds, memberRoleIds } from '~/services/groupMember.helpers';

// ── Type helpers ───────────────────────────────────────────────────────────────

export type TeamWithMembers = Team & { members: TeamMember[] };

export type OrgNode = {
  team: Team;
  members: TeamMember[];
  children: OrgNode[];
};

// ── Core hierarchy helpers ─────────────────────────────────────────────────────

/**
 * Returns the team IDs where the given user holds a lead role.
 * Checks both direct team_member docs and linked role memberships.
 */
async function getLeadTeamIds(groupId: string, userId: string): Promise<ObjectId[]> {
  // Direct memberships
  const directMemberships = await readminCollections.team_member
    .find({ groupId, userId })
    .toArray();

  const directTeamIds = directMemberships.map((m) => m.teamId);

  // Also find teams where user is linked via role links
  const groupMember = await readminCollections.group_member.findOne({ groupId, userId: parseInt(userId) || userId as any });
  let linkedTeamIds: ObjectId[] = [];
  // Every role and department the member holds, not just their highest — a
  // member whose secondary role is linked to a team belongs to that team too.
  const memberRoles = groupMember ? memberRoleIds(groupMember) : [];
  const memberDepartments = groupMember ? memberDepartmentIds(groupMember) : [];
  if (groupMember) {
    const matchFilters: any[] = [];
    if (memberRoles.length > 0) {
      matchFilters.push({ groupId, sourceType: 'robloxRole', robloxRoleId: { $in: memberRoles } });
    }
    if (memberDepartments.length > 0) {
      matchFilters.push({ groupId, sourceType: 'department', departmentId: { $in: memberDepartments } });
    }
    if (matchFilters.length > 0) {
      const links = await readminCollections.team_role_link.find({ $or: matchFilters }).toArray();
      linkedTeamIds = links.map((l) => l.teamId);
    }
  }

  const allTeamIds = [...directTeamIds, ...linkedTeamIds];
  if (allTeamIds.length === 0) return [];

  const uniqueTeamIds = [...new Map(allTeamIds.map((id) => [id.toString(), id])).values()];
  const teams = await readminCollections.team.find({ _id: { $in: uniqueTeamIds }, groupId }).toArray();

  // Build a map of userId -> roleId per team from direct + linked
  const membershipMap = new Map<string, string>(); // teamId -> roleId
  for (const m of directMemberships) {
    membershipMap.set(m.teamId.toString(), m.roleId);
  }
  if (groupMember) {
    const [links, memberRoleDocs] = await Promise.all([
      readminCollections.team_role_link.find({
        groupId,
        teamId: { $in: uniqueTeamIds },
      }).toArray(),
      // rankIds on group_member is a SET, not positionally aligned with roleIds,
      // so the rank of a specific role has to come from group_role.
      memberRoles.length > 0
        ? readminCollections.group_role.find({ groupId, id: { $in: memberRoles } }).toArray()
        : Promise.resolve([]),
    ]);
    const rankByRoleId = new Map(memberRoleDocs.map((r) => [r.id, r.rank]));
    const memberDepartmentKeys = new Set(memberDepartments.map((d) => d.toString()));

    // A member holding several roles can match the SAME team through more than
    // one link, each pointing at a different team role. Resolve deterministically
    // to their highest-ranked linked role, and prefer a lead role when two of
    // their roles tie on rank — otherwise lead status would depend on the order
    // Mongo happened to return the links in.
    const applicable = links
      .filter((link) => {
        if (link.sourceType === 'robloxRole') return link.robloxRoleId != null && memberRoles.includes(link.robloxRoleId);
        if (link.sourceType === 'department') return !!link.departmentId && memberDepartmentKeys.has(link.departmentId.toString());
        return false;
      })
      .map((link) => {
        const team = teams.find((t) => t._id!.toString() === link.teamId.toString());
        const isLead = team?.roles.find((r) => r.id === link.roleId)?.isLead === true;
        const rank = link.sourceType === 'robloxRole' && link.robloxRoleId != null
          ? rankByRoleId.get(link.robloxRoleId) ?? 0
          : 0;
        return { link, rank, isLead };
      })
      .sort((a, b) => (b.rank - a.rank) || (Number(b.isLead) - Number(a.isLead)));

    for (const { link } of applicable) {
      const teamKey = link.teamId.toString();
      if (membershipMap.has(teamKey)) continue; // direct takes priority, then highest role
      membershipMap.set(teamKey, link.roleId);
    }
  }

  return uniqueTeamIds.filter((teamId) => {
    const team = teams.find((t) => t._id!.toString() === teamId.toString());
    if (!team) return false;
    const roleId = membershipMap.get(teamId.toString());
    if (!roleId) return false;
    const role = team.roles.find((r) => r.id === roleId);
    return !!(role?.isLead);
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Direct reports of `userId`:
 *   1. Non-lead members of every team this user leads.
 *   2. Lead members of sub-teams within those teams.
 *
 * Returns a deduplicated list of robloxIds.
 */
export async function getDirectReports(
  groupId: string,
  userId: string,
): Promise<{ userId: string; teamId: string; roleId: string }[]> {
  const leadTeamIds = await getLeadTeamIds(groupId, userId);
  if (leadTeamIds.length === 0) return [];

  const teams = await readminCollections.team
    .find({ _id: { $in: leadTeamIds }, groupId })
    .toArray();

  const results: { userId: string; teamId: string; roleId: string }[] = [];
  const seen = new Set<string>();

  for (const team of teams) {
    // 1. Non-lead members of this team (direct subordinates)
    const members = await getEffectiveTeamMembers(groupId, team._id!.toString());

    for (const m of members) {
      if (m.userId === userId) continue;
      const key = `${m.userId}-${team._id!.toString()}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ userId: m.userId, teamId: team._id!.toString(), roleId: m.roleId });
      }
    }

    // 2. Lead members of direct sub-teams
    const subTeams = await readminCollections.team
      .find({ groupId, parentTeamId: team._id! })
      .toArray();

    for (const sub of subTeams) {
      const subMembers = await getEffectiveTeamMembers(groupId, sub._id!.toString());
      for (const sm of subMembers) {
        const role = sub.roles.find((r) => r.id === sm.roleId);
        if (!role?.isLead) continue;
        const key = `${sm.userId}-${sub._id!.toString()}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ userId: sm.userId, teamId: sub._id!.toString(), roleId: sm.roleId });
        }
      }
    }
  }

  return results;
}

/**
 * Recursively collects ALL users who report through this user's chain of command.
 * Prevents infinite loops via a visited set.
 */
export async function getAllReportsRecursive(
  groupId: string,
  userId: string,
  visited = new Set<string>(),
): Promise<{ userId: string; teamId: string; depth: number }[]> {
  if (visited.has(userId)) return [];
  visited.add(userId);

  const direct = await getDirectReports(groupId, userId);
  const result: { userId: string; teamId: string; depth: number }[] = direct.map((d) => ({
    ...d,
    depth: 1,
  }));

  for (const report of direct) {
    if (visited.has(report.userId)) continue;
    const deeper = await getAllReportsRecursive(groupId, report.userId, visited);
    result.push(...deeper.map((d) => ({ ...d, depth: d.depth + 1 })));
  }

  return result;
}

/**
 * Returns the chain of managers above `userId` all the way to the top.
 * Prevents circular references via a visited set.
 */
export async function getManagerChain(
  groupId: string,
  userId: string,
  visited = new Set<string>(),
): Promise<{ userId: string; teamId: string }[]> {
  if (visited.has(userId)) return [];
  visited.add(userId);

  const memberships = await readminCollections.team_member
    .find({ groupId, userId })
    .toArray();

  if (memberships.length === 0) return [];

  const teamIds = memberships.map((m) => m.teamId);
  const teams = await readminCollections.team.find({ _id: { $in: teamIds }, groupId }).toArray();

  const managers: { userId: string; teamId: string }[] = [];
  const seen = new Set<string>();

  for (const membership of memberships) {
    const team = teams.find((t) => t._id!.toString() === membership.teamId.toString());
    if (!team) continue;

    // Find lead members of the team this user belongs to — they're the manager
    const teamMembers = await getEffectiveTeamMembers(groupId, team._id!.toString());

    for (const tm of teamMembers) {
      if (tm.userId === userId) continue;
      const role = team.roles.find((r) => r.id === tm.roleId);
      if (!role?.isLead) continue;
      const key = `${tm.userId}-${team._id!.toString()}`;
      if (!seen.has(key)) {
        seen.add(key);
        managers.push({ userId: tm.userId, teamId: team._id!.toString() });
      }
    }

    // Also check if this team has a parent and recurse
    if (team.parentTeamId) {
      const parentTeam = await readminCollections.team.findOne({
        _id: team.parentTeamId,
        groupId,
      });
      if (parentTeam) {
        const parentLeads = await getEffectiveTeamMembers(groupId, parentTeam._id!.toString());
        for (const pl of parentLeads) {
          const role = parentTeam.roles.find((r) => r.id === pl.roleId);
          if (!role?.isLead) continue;
          if (!visited.has(pl.userId)) {
            managers.push({ userId: pl.userId, teamId: parentTeam._id!.toString() });
            const higher = await getManagerChain(groupId, pl.userId, visited);
            managers.push(...higher);
          }
        }
      }
    }
  }

  return managers;
}

/**
 * Builds the nested org chart tree for the workspace.
 * `startTeamId` optionally scopes the tree to a specific sub-tree.
 */
export async function buildOrgChart(
  groupId: string,
  startTeamId?: string,
): Promise<OrgNode[]> {
  const [allTeams, effectiveMembers] = await Promise.all([
    readminCollections.team.find({ groupId }).toArray(),
    getAllEffectiveMembers(groupId),
  ]);

  function buildChildren(parentId: ObjectId | null): OrgNode[] {
    return allTeams
      .filter((t) =>
        parentId ? t.parentTeamId?.toString() === parentId.toString() : !t.parentTeamId,
      )
      .map((team) => ({
        team,
        members: effectiveMembers.get(team._id!.toString()) ?? [],
        children: buildChildren(team._id!),
      }));
  }

  if (startTeamId) {
    const root = allTeams.find((t) => t._id!.toString() === startTeamId);
    if (!root) return [];
    return [
      {
        team: root,
        members: effectiveMembers.get(root._id!.toString()) ?? [],
        children: buildChildren(root._id!),
      },
    ];
  }

  return buildChildren(null);
}

/**
 * Validates that setting `childTeamId`'s parent to `proposedParentId` would
 * not create a cycle in the hierarchy.
 */
export async function validateNoCircularReference(
  groupId: string,
  childTeamId: string,
  proposedParentId: string,
): Promise<boolean> {
  if (childTeamId === proposedParentId) return false;

  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) return false; // cycle already present
    visited.add(currentId);
    if (currentId === childTeamId) return false; // would create a cycle

    //@ts-expect-error is fine because we check existence above
    const team = await readminCollections.team.findOne({
      _id: new ObjectId(currentId),
      groupId,
    });
    currentId = team?.parentTeamId?.toString() ?? null;
  }

  return true;
}
