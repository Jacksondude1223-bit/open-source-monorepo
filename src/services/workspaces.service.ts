import { JWTUser } from '~/services/types/JWT.type';
import { getUserGroups } from './roblox.service';
import { WorkspaceWithRole } from '~/services/types/workspaces.type';
import { WORKSPACE_OWNER_PERMISSIONS } from './constants/WorkspaceOwnerPermissions';
import { readminCollections } from '~/services/mongo.service';
import { Department, GroupMember, GroupRole, User, Workspace } from './NewMongoTypes';
import { ObjectId } from 'mongodb';
import {
  EffectiveDepartment,
  mergeDepartments,
  resolveDepartmentsForUser,
  resolveEffectiveDepartment,
  SYNTHETIC_OWNER_DEPARTMENT_ID,
} from './departmentPermissions.service';
import { memberRoleIds } from './groupMember.helpers';

export type UserWorkspaceResponse = {
  workspace: Workspace;
  department: Department;
};

/**
 * Removes orphaned `department_users` records that point at a department which
 * no longer exists. Also clears any `department_role` mappings for that dead
 * department so members aren't silently re-attached to it.
 */
export async function deleteOrphanedDepartmentUsers(
  groupId: string,
  departmentId: ObjectId,
): Promise<void> {
  const departmentStillExists = await readminCollections.department.findOne({
    _id: departmentId,
    groupId,
  });
  if (departmentStillExists) {
    return;
  }
  await Promise.all([
    readminCollections.department_users.deleteMany({ groupId, departmentId }),
    readminCollections.department_role.deleteMany({ groupId, departmentId }),
  ]);
}

export async function getDepartmentForWorkspaceOwner(groupId: string, userId: string): Promise<EffectiveDepartment> {
  // The owner's own departments matter for scope checks (feed, knowledge hub,
  // banners) even though their permissions are already total. Resolving them
  // through the shared resolver also fixes the old bug here where the
  // department_role lookup overwrote the department_users one instead of
  // considering both.
  const foundMember = await readminCollections.group_member.findOne({ groupId, userId: parseInt(userId) });
  const ownDepartments = await resolveDepartmentsForUser(groupId, userId, { member: foundMember });

  const ownerDepartment: Department = {
    _id: ownDepartments[0]?._id || SYNTHETIC_OWNER_DEPARTMENT_ID as unknown as ObjectId,
    groupId: groupId,
    isOwner: true,
    name: 'Workspace Owner',
    permissions: WORKSPACE_OWNER_PERMISSIONS,
    cankRankRoles: await readminCollections.group_role.find({ groupId: groupId, rank: { $ne: 0 } }, { sort: { rank: 1 } }).toArray().then((roles) => roles.map((role) => role.id.toString())),
    created: new Date()
  };

  // Merge so sourceDepartmentIds carries the owner's real departments; the
  // owner's total permissions dominate the union regardless. Keep the label and
  // the owner flag — merging would otherwise rename them "Workspace Owner + X".
  const merged = mergeDepartments(groupId, [ownerDepartment, ...ownDepartments]);
  return { ...merged, name: 'Workspace Owner', isOwner: true };
}

export async function getRolesDepartmentCanRankTo(workspace: Workspace, department: Department): Promise<GroupRole[]> {
  if (!department || !workspace) {
    return [];
  }
  if (department.permissions.admin){
    return await readminCollections.group_role.find({ groupId: workspace.groupId, rank: { $ne: 0 } }, { sort: { rank: 1 } }).toArray();
  }
  return readminCollections.group_role.find({ groupId: workspace.groupId, rank: { $ne: 0 }, id: { $in: (department.cankRankRoles || []).map(roleId => parseInt(roleId)) } }, { sort: { rank: 1 } }).toArray();
}

export async function workspaceUsingOpenCloud(groupId: string): Promise<boolean> {
  const workspace = await readminCollections.group_oauth_authorization.findOne({ groupId });
  return !!workspace;
}

export async function getUserWorkspace(
  workspaceId: string,
  user: JWTUser,
): Promise<UserWorkspaceResponse> {
  if (!user.dbUser.robloxId) {
    return Promise.reject('User does not have a linked Roblox account');
  }
  const foundWorkspace = await readminCollections.workspace.findOne({
    groupId: workspaceId,
  });
  if (!foundWorkspace) {
    return Promise.reject(`User is not in workspace`);
  }

  if (foundWorkspace.owner.robloxId == user.dbUser.robloxId) {
    return { workspace: foundWorkspace, department: await getDepartmentForWorkspaceOwner(foundWorkspace.groupId, user.dbUser.robloxId) };
  }

  // All local sources at once, unioned. This used to be a cascade — direct
  // department assignment, then the synced role, then the live Roblox role —
  // where each branch returned the FIRST department it found, so which
  // permissions you got depended on which branch matched first. The other
  // resolvers in this file ordered those branches differently, which is how two
  // functions answering the same question could disagree. A union has no
  // precedence question.
  const foundGroupMember = await readminCollections.group_member.findOne({
    userId: parseInt(user.dbUser.robloxId),
    groupId: workspaceId,
  });

  const department = await resolveEffectiveDepartment(
    foundWorkspace.groupId,
    user.dbUser.robloxId,
    { member: foundGroupMember },
  );

  if (department) {
    return { workspace: foundWorkspace, department };
  }

  // Nothing locally. Fall back to the user's live Roblox roles: `group_member`
  // can be missing or stale (workspaces without Open Cloud syncing), and the
  // workspace LIST is built from live Roblox data, so without this the list and
  // this check disagree — the workspace shows up but won't open.
  //
  // Deliberately only reached when the local lookup found nothing: this runs in
  // the workspace middleware on essentially every request, and getUserGroups is
  // an external Roblox call (cached, but still a network hop on a miss).
  const liveGroups = await getUserGroups(user.dbUser.robloxId);
  const liveGroupRole = liveGroups?.find(
    (g) => g.group.id.toString() === foundWorkspace.groupId,
  );
  if (liveGroupRole) {
    const liveDepartment = await resolveEffectiveDepartment(
      foundWorkspace.groupId,
      user.dbUser.robloxId,
      { member: foundGroupMember, extraRoleIds: [liveGroupRole.role.id] },
    );
    if (liveDepartment) {
      return { workspace: foundWorkspace, department: liveDepartment };
    }
  }

  // No department at all. If that's because they're assigned to one that no
  // longer exists, clean the orphan up so they stop appearing as a member of a
  // department that isn't there.
  const orphanedAssignment = await readminCollections.department_users.findOne({
    groupId: foundWorkspace.groupId,
    userId: user.dbUser.robloxId,
  });
  if (orphanedAssignment) {
    await deleteOrphanedDepartmentUsers(foundWorkspace.groupId, orphanedAssignment.departmentId);
  }

  // If not we'll return a error
  return Promise.reject(`User is not in workspace`);
}


export async function getDepartmentForUserId(
  userId: string,
  groupId: string,
): Promise<Department | null> {
  const workspace = await readminCollections.workspace.findOne({ groupId });
  if (!workspace) {
    return null;
  }
  if (workspace.owner.robloxId == userId) {
    return await getDepartmentForWorkspaceOwner(workspace.groupId, userId);
  }
  const foundGroupMember = await readminCollections.group_member.findOne({
    groupId,
    userId: parseInt(userId),
  });
  return resolveEffectiveDepartment(groupId, userId, { member: foundGroupMember });
}

export async function getDepartmentForGroupMember(
  groupMember: GroupMember,
  workspace: Workspace,
): Promise<Department | null> {
  if (!groupMember) {
    return null;
  }
  if (workspace.owner.robloxId == groupMember.userId.toString()) {
    return await getDepartmentForWorkspaceOwner(workspace.groupId, groupMember.userId.toString());
  }
  // Note this used to check department_role BEFORE department_users, the
  // opposite order to getDepartmentForUserId above — two functions answering the
  // same question differently. The union makes the order irrelevant.
  return resolveEffectiveDepartment(
    groupMember.groupId.toString(),
    groupMember.userId.toString(),
    { member: groupMember },
  );
}

export async function getUserWorkspaces(
  user: User,
): Promise<WorkspaceWithRole[]> {
  if (!user) {
    return [];
  }
  if (!user?.robloxId) {
    return [];
  }

  let toReturn: WorkspaceWithRole[] = [];
  const numericRobloxId = parseInt(user.robloxId);
  const [ownedWorkspaces, groupsUserIsIn, foundUser, syncedMemberships] = await Promise.all([
    readminCollections.workspace.find({
      'owner.robloxId': user.robloxId,
    }).toArray(),
    getUserGroups(user.robloxId),
    readminCollections.department_users.find({
      userId: user.robloxId,
    }).toArray(),
    Number.isFinite(numericRobloxId)
      ? readminCollections.group_member.find({ userId: numericRobloxId }).toArray()
      : Promise.resolve([]),
  ])

  for (const ownedWorkspace of ownedWorkspaces) {
    const OwnerDepartment = await getDepartmentForWorkspaceOwner(ownedWorkspace.groupId, user.robloxId);
    toReturn.push({
      ...ownedWorkspace,
      role: 'Owner',
      department: OwnerDepartment,
    });
  }

  // Collect every (groupId, roleId) the user might hold. Two sources, because a
  // Roblox community member can hold several roles but the legacy
  // /users/{id}/groups/roles endpoint only ever reports ONE of them: if that one
  // happened to have no department mapping, the workspace never appeared in the
  // user's list even though a mapped staff role would have let them in by URL.
  const roleCandidates = new Map<string, { groupId: string; roleId: number }>();
  for (const group of groupsUserIsIn || []) {
    const groupId = group.group.id.toString();
    roleCandidates.set(`${groupId}:${group.role.id}`, { groupId, roleId: group.role.id });
  }
  for (const membership of syncedMemberships) {
    const groupId = membership.groupId.toString();
    for (const roleId of memberRoleIds(membership)) {
      roleCandidates.set(`${groupId}:${roleId}`, { groupId, roleId });
    }
  }

  // Gather every department per workspace, then merge — rather than the old
  // first-wins `if (!toReturn.find(...))`, under which a user whose SECOND
  // department was the admin one silently got `loaderId: 'no-sir'` and the wrong
  // role label, depending purely on iteration order.
  const departmentsByGroupId = new Map<string, Department[]>();
  const addDepartment = (groupId: string, department: Department) => {
    const list = departmentsByGroupId.get(groupId);
    if (!list) return departmentsByGroupId.set(groupId, [department]);
    if (!list.some(d => d._id?.toString() === department._id?.toString())) list.push(department);
  };

  if (roleCandidates.size !== 0) {
    const foundRoles = await readminCollections.department_role.find({
      $or: Array.from(roleCandidates.values()),
    }).toArray();

    for (const role of foundRoles) {
      const foundDepartment = await readminCollections.department.findOne({
        groupId: role.groupId,
        _id: role.departmentId,
      });
      if (!foundDepartment) continue;
      addDepartment(role.groupId, foundDepartment);
    }
  }

  for (const departmentUser of foundUser) {
    const foundDepartment = await readminCollections.department.findOne({
      groupId: departmentUser.groupId,
      _id: departmentUser.departmentId,
    });
    if (!foundDepartment) {
      // This membership points at a department that no longer exists. Clean it
      // up (along with any others stuck in the same dead department) instead of
      // silently skipping it.
      await deleteOrphanedDepartmentUsers(departmentUser.groupId, departmentUser.departmentId);
      continue;
    }
    addDepartment(departmentUser.groupId, foundDepartment);
  }

  for (const [groupId, departments] of departmentsByGroupId) {
    // Owned workspaces already got the owner department above.
    if (toReturn.find((a) => a.groupId == groupId)) continue;
    const workspace = await readminCollections.workspace.findOne({ groupId });
    if (!workspace) continue;

    const department = mergeDepartments(groupId, departments);
    const isAdmin = department.permissions.admin;
    toReturn.push({
      ...workspace,
      loaderId: isAdmin ? workspace.loaderId : 'no-sir',
      role: department.name,
      department,
    });
  }



  return toReturn;
}


export async function getWorkspaceCurrentDistribution(groupId: number | string): Promise<number> {
  const distributions = await readminCollections.distribution.findOne({
    groupId: groupId.toString(),
    isCurrent: true,
  })
  if (distributions) {
    return distributions.num;
  }
  return 0;
}