/**
 * Returns all teams (with role info) for a user in a workspace, direct or via link.
 */
export async function getTeamsForUser(groupId: string, userId: string) {
  // Direct memberships
  const direct = await readminCollections.team_member.find({ groupId, userId }).toArray();
  // Linked memberships (via team_role_link)
  const links = await readminCollections.team_role_link.find({ groupId }).toArray();
  const robloxRoleLinks = links.filter((l) => l.sourceType === 'robloxRole' && typeof l.robloxRoleId === 'number');
  const deptLinks = links.filter((l) => l.sourceType === 'department' && l.departmentId != null);
  // Find group_member records for this user matching any robloxRoleId/departmentId
  const groupMember = await readminCollections.group_member.find({ groupId, userId: Number(userId) }).toArray();
  // A member can hold several roles, so flatten every role they hold — this
  // already treated the result as a list, it just never had more than one.
  const roleIds = groupMember
    .flatMap((m) => memberRoleIds(m))
    .filter((v): v is number => typeof v === 'number');
  // departmentId can be ObjectId or string; normalize to string for comparison
  const departmentIds = groupMember
    .flatMap((m) => memberDepartmentIds(m))
    .filter((v) => v != null)
    .map((v) => typeof v === 'string' ? v : v.toString());
  const linked: any[] = [];
  for (const link of robloxRoleLinks) {
    if (typeof link.robloxRoleId === 'number' && roleIds.includes(link.robloxRoleId)) {
      linked.push({
        groupId,
        teamId: link.teamId,
        userId,
        roleId: link.roleId,
        created: link.created,
        addedBy: link.createdBy,
        via: 'robloxRole',
      });
    }
  }
  for (const link of deptLinks) {
    if (
      link.departmentId != null &&
      departmentIds.includes(link.departmentId.toString())
    ) {
      linked.push({
        groupId,
        teamId: link.teamId,
        userId,
        roleId: link.roleId,
        created: link.created,
        addedBy: link.createdBy,
        via: 'department',
      });
    }
  }
  // Merge by teamId, direct takes priority
  const byTeam = new Map<string, any>();
  for (const m of direct) byTeam.set(m.teamId.toString(), { ...m, via: 'direct' });
  for (const m of linked) if (!byTeam.has(m.teamId.toString())) byTeam.set(m.teamId.toString(), m);
  // Attach team info
  const teamIds = Array.from(byTeam.keys()).map((id) => new ObjectId(id));
  const teams = await readminCollections.team.find({ groupId, _id: { $in: teamIds } }).toArray();
  return Array.from(byTeam.values()).map((m) => ({
    ...m,
    team: teams.find((t) => t._id?.toString() === m.teamId.toString()) || null,
  }));
}
import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { Team, TeamRole, TeamMember, TeamRoleLink, GroupMember } from '~/services/NewMongoTypes';
import { v4 as uuidv4 } from 'uuid';
import {
  andFilters,
  departmentIdFilter,
  departmentIdInFilter,
  memberDepartmentIds,
  memberRoleIds,
  roleIdFilter,
  roleIdInFilter,
} from '~/services/groupMember.helpers';

// ── Team CRUD ──────────────────────────────────────────────────────────────────

export async function createTeam(
  groupId: string,
  createdBy: string,
  data: { name: string; description?: string; parentTeamId?: string },
): Promise<Team> {
  const defaultLeadRole: TeamRole = {
    id: uuidv4(),
    name: 'Team Lead',
    isLead: true,
    created: new Date(),
  };
  const defaultMemberRole: TeamRole = {
    id: uuidv4(),
    name: 'Member',
    isLead: false,
    created: new Date(),
  };

  const team: Team = {
    groupId,
    name: data.name,
    description: data.description,
    parentTeamId: data.parentTeamId ? new ObjectId(data.parentTeamId) : null,
    roles: [defaultLeadRole, defaultMemberRole],
    created: new Date(),
    createdBy,
  };

  const result = await readminCollections.team.insertOne(team as any);
  return { ...team, _id: result.insertedId };
}

export async function updateTeam(
  groupId: string,
  teamId: string,
  data: { name?: string; description?: string; parentTeamId?: string | null },
): Promise<void> {
  const update: Partial<Team> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (data.parentTeamId !== undefined) {
    update.parentTeamId = data.parentTeamId ? new ObjectId(data.parentTeamId) : null;
  }
  await readminCollections.team.updateOne(
    { _id: new ObjectId(teamId), groupId },
    { $set: update },
  );
}

export async function deleteTeam(groupId: string, teamId: string): Promise<void> {
  const oid = new ObjectId(teamId);
  // Cascade: remove all members and re-parent direct children to grandparent
  const team = await readminCollections.team.findOne({ _id: oid, groupId });
  if (team) {
    await readminCollections.team.updateMany(
      { groupId, parentTeamId: oid },
      { $set: { parentTeamId: team.parentTeamId ?? null } },
    );
  }
  await Promise.all([
    readminCollections.team.deleteOne({ _id: oid, groupId }),
    readminCollections.team_member.deleteMany({ teamId: oid, groupId }),
    readminCollections.team_role_link.deleteMany({ teamId: oid, groupId }),
  ]);
}

export async function getTeamsForWorkspace(groupId: string): Promise<Team[]> {
  return readminCollections.team.find({ groupId }).sort({ name: 1 }).toArray();
}

export async function getTeamById(groupId: string, teamId: string): Promise<Team | null> {
  return readminCollections.team.findOne({ _id: new ObjectId(teamId), groupId });
}

// ── Team management authorization ────────────────────────────────────────────

/**
 * True if the user is an effective member of the team whose assigned role is a
 * lead role (TeamRole.isLead). Leads may manage the team(s) they lead.
 */
export async function isUserTeamLead(
  groupId: string,
  userId: string,
  teamId: string,
): Promise<boolean> {
  const [team, members] = await Promise.all([
    getTeamById(groupId, teamId),
    getEffectiveTeamMembers(groupId, teamId),
  ]);
  if (!team) return false;
  const me = members.find((m) => m.userId === userId.toString());
  if (!me) return false;
  const role = team.roles.find((r) => r.id === me.roleId);
  return !!role?.isLead;
}

/**
 * Authorization for editing a *specific* team. Workspace admins and departments
 * with `teams.manageAll` can edit any team; otherwise the user must be a lead of
 * that team. (The legacy `teams.manage` permission no longer grants blanket edit.)
 */
export async function userCanManageTeam(params: {
  groupId: string;
  userId: string;
  teamId: string;
  permissions: { admin?: boolean; teams?: { manageAll?: boolean } };
}): Promise<boolean> {
  if (params.permissions.admin || params.permissions.teams?.manageAll) return true;
  return isUserTeamLead(params.groupId, params.userId, params.teamId);
}

// ── Team Roles ─────────────────────────────────────────────────────────────────

export async function addTeamRole(
  groupId: string,
  teamId: string,
  data: { name: string; isLead: boolean },
): Promise<TeamRole> {
  const role: TeamRole = {
    id: uuidv4(),
    name: data.name,
    isLead: data.isLead,
    created: new Date(),
  };
  await readminCollections.team.updateOne(
    { _id: new ObjectId(teamId), groupId },
    { $push: { roles: role } as any },
  );
  return role;
}

export async function updateTeamRole(
  groupId: string,
  teamId: string,
  roleId: string,
  data: { name?: string; isLead?: boolean },
): Promise<void> {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates['roles.$.name'] = data.name;
  if (data.isLead !== undefined) updates['roles.$.isLead'] = data.isLead;
  await readminCollections.team.updateOne(
    { _id: new ObjectId(teamId), groupId, 'roles.id': roleId },
    { $set: updates },
  );
}

export async function removeTeamRole(
  groupId: string,
  teamId: string,
  roleId: string,
): Promise<void> {
  await readminCollections.team.updateOne(
    { _id: new ObjectId(teamId), groupId },
    { $pull: { roles: { id: roleId } } as any },
  );
}

// ── Team Members ───────────────────────────────────────────────────────────────

export async function addTeamMember(
  groupId: string,
  teamId: string,
  userId: string,
  roleId: string,
  addedBy: string,
): Promise<void> {
  // Upsert: if already a member, just update their role
  await readminCollections.team_member.updateOne(
    { groupId, teamId: new ObjectId(teamId), userId },
    {
      $set: { roleId, addedBy },
      $setOnInsert: { created: new Date() },
    },
    { upsert: true },
  );
}

export async function removeTeamMember(
  groupId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  await readminCollections.team_member.deleteOne({
    groupId,
    teamId: new ObjectId(teamId),
    userId,
  });
}

export async function updateTeamMemberRole(
  groupId: string,
  teamId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await readminCollections.team_member.updateOne(
    { groupId, teamId: new ObjectId(teamId), userId },
    { $set: { roleId } },
  );
}

export async function getTeamMembers(groupId: string, teamId: string) {
  return readminCollections.team_member.find({ groupId, teamId: new ObjectId(teamId) }).toArray();
}

// ── Team Role Links (bulk membership via Roblox role or department) ────────────

export async function addTeamRoleLink(
  groupId: string,
  teamId: string,
  roleId: string,
  source: { sourceType: 'robloxRole'; robloxRoleId: number } | { sourceType: 'department'; departmentId: string },
  createdBy: string,
): Promise<void> {
  const filter: Record<string, any> = {
    groupId,
    teamId: new ObjectId(teamId),
    sourceType: source.sourceType,
  };
  if (source.sourceType === 'robloxRole') {
    filter.robloxRoleId = source.robloxRoleId;
  } else {
    filter.departmentId = new ObjectId(source.departmentId);
  }

  // Upsert so the same source can't be linked twice; just updates the team role
  await readminCollections.team_role_link.updateOne(
    filter,
    {
      $set: { roleId, createdBy },
      $setOnInsert: {
        created: new Date(),
        ...(source.sourceType === 'robloxRole'
          ? { robloxRoleId: source.robloxRoleId }
          : { departmentId: new ObjectId(source.departmentId) }),
        sourceType: source.sourceType,
        groupId,
        teamId: new ObjectId(teamId),
      },
    },
    { upsert: true },
  );
}

export async function removeTeamRoleLink(groupId: string, linkId: string): Promise<void> {
  await readminCollections.team_role_link.deleteOne({ _id: new ObjectId(linkId), groupId });
}

export async function getTeamRoleLinkById(groupId: string, linkId: string): Promise<TeamRoleLink | null> {
  return readminCollections.team_role_link.findOne({ _id: new ObjectId(linkId), groupId });
}

export async function getTeamRoleLinks(groupId: string, teamId: string): Promise<TeamRoleLink[]> {
  return readminCollections.team_role_link
    .find({ groupId, teamId: new ObjectId(teamId) })
    .toArray();
}

/**
 * Resolves linked members for a team by querying group_member for each link.
 * Returns virtual TeamMember-shaped objects (no _id since they aren't stored).
 */
export async function getLinkedTeamMembers(
  groupId: string,
  teamId: string,
): Promise<TeamMember[]> {
  const links = await getTeamRoleLinks(groupId, teamId);
  if (links.length === 0) return [];

  const results: TeamMember[] = [];
  const seen = new Set<string>(); // dedupe by `userId`

  for (const link of links) {
    let members: {userId: number}[];

    if (link.sourceType === 'robloxRole' && link.robloxRoleId != null) {
      members = await readminCollections.group_member
        // Matches on the member's full role set, so someone whose SECONDARY role
        // is linked to this team is no longer invisible to it.
        .find(andFilters({ groupId }, roleIdFilter(link.robloxRoleId)))
        .project({ userId: 1 })
        .toArray() as {userId: number}[];
    } else if (link.sourceType === 'department' && link.departmentId != null) {
      members = await readminCollections.group_member
        .find(andFilters({ groupId }, departmentIdFilter(link.departmentId)))
        .project({ userId: 1 })
        .toArray() as {userId: number}[];
    } else {
      continue;
    }

    for (const m of members) {
      const uid = m.userId.toString();
      if (seen.has(uid)) continue;
      seen.add(uid);
      results.push({
        groupId,
        teamId: new ObjectId(teamId),
        userId: uid,
        roleId: link.roleId,
        created: link.created,
        addedBy: link.createdBy,
      });
    }
  }

  return results;
}

/**
 * Returns all effective members of a team: directly-added members merged with
 * members resolved from role links. Direct members take priority (their roleId
 * is kept when a user appears in both).
 */
export async function getEffectiveTeamMembers(
  groupId: string,
  teamId: string,
): Promise<TeamMember[]> {
  const [direct, linked] = await Promise.all([
    getTeamMembers(groupId, teamId),
    getLinkedTeamMembers(groupId, teamId),
  ]);

  const byUser = new Map<string, TeamMember>();
  // Direct members first so they take priority
  for (const m of direct) byUser.set(m.userId, m);
  for (const m of linked) {
    if (!byUser.has(m.userId)) byUser.set(m.userId, m);
  }

  return Array.from(byUser.values());
}

/**
 * Same as getEffectiveTeamMembers but for all teams in a workspace at once.
 * Used by hierarchy/org-chart code to avoid N+1 queries.
 */
export async function getAllEffectiveMembers(
  groupId: string,
): Promise<Map<string, TeamMember[]>> {
  const [allDirect, allLinks] = await Promise.all([
    readminCollections.team_member.find({ groupId }).toArray(),
    readminCollections.team_role_link.find({ groupId }).toArray(),
  ]);

  // Group direct members by team
  const byTeam = new Map<string, Map<string, TeamMember>>();
  for (const m of allDirect) {
    const key = m.teamId.toString();
    if (!byTeam.has(key)) byTeam.set(key, new Map());
    byTeam.get(key)!.set(m.userId, m);
  }

  // Resolve links in bulk
  if (allLinks.length > 0) {
    const robloxRoleIds = allLinks.filter((l) => l.sourceType === 'robloxRole' && l.robloxRoleId != null).map((l) => l.robloxRoleId!);
    const departmentIds = allLinks.filter((l) => l.sourceType === 'department' && l.departmentId != null).map((l) => l.departmentId!);

    const [roleMembers, deptMembers] = await Promise.all([
      robloxRoleIds.length > 0
        ? readminCollections.group_member.find(andFilters({ groupId }, roleIdInFilter(robloxRoleIds))).project({ userId: 1, roleId: 1, roleIds: 1 }).toArray()
        : [],
      departmentIds.length > 0
        ? readminCollections.group_member.find(andFilters({ groupId }, departmentIdInFilter(departmentIds))).project({ userId: 1, departmentId: 1, departmentIds: 1 }).toArray()
        : [],
    ]);

    // Index group_member results for fast lookup. A member holding several
    // linked roles is indexed under each of them, so they resolve into every
    // team those roles link to.
    const membersByRobloxRole = new Map<number, { userId: string }[]>();
    for (const m of roleMembers) {
      for (const rid of memberRoleIds(m as any)) {
        if (!membersByRobloxRole.has(rid)) membersByRobloxRole.set(rid, []);
        membersByRobloxRole.get(rid)!.push({ userId: m.userId.toString() });
      }
    }
    const membersByDept = new Map<string, { userId: string }[]>();
    for (const m of deptMembers) {
      for (const did of memberDepartmentIds(m as any)) {
        const key = did.toString();
        if (!membersByDept.has(key)) membersByDept.set(key, []);
        membersByDept.get(key)!.push({ userId: m.userId.toString() });
      }
    }

    for (const link of allLinks) {
      const teamKey = link.teamId.toString();
      if (!byTeam.has(teamKey)) byTeam.set(teamKey, new Map());
      const teamMap = byTeam.get(teamKey)!;

      let linked: { userId: string }[] = [];
      if (link.sourceType === 'robloxRole' && link.robloxRoleId != null) {
        linked = membersByRobloxRole.get(link.robloxRoleId) ?? [];
      } else if (link.sourceType === 'department' && link.departmentId != null) {
        linked = membersByDept.get(link.departmentId.toString()) ?? [];
      }

      for (const m of linked) {
        if (!teamMap.has(m.userId)) {
          teamMap.set(m.userId, {
            groupId,
            teamId: link.teamId,
            userId: m.userId,
            roleId: link.roleId,
            created: link.created,
            addedBy: link.createdBy,
          });
        }
      }
    }
  }

  const result = new Map<string, TeamMember[]>();
  for (const [teamKey, userMap] of byTeam) {
    result.set(teamKey, Array.from(userMap.values()));
  }
  return result;
}
