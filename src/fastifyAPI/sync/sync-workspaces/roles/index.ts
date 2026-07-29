import { Workspace } from "~/services/NewMongoTypes";
import { readminCollections } from "~/services/mongo.service";
import { openCloudGetAllGroupRoles } from "~/services/opencloud.roblox.service";
import * as Roblox from '~/services/roblox.service';

export default async function SyncRoles(workspace: Workspace) {
  try {
    const groupId = workspace.groupId;
    const roles = await openCloudGetAllGroupRoles('group', groupId, groupId);
    if (!roles) return;

    const now = new Date();
    // Exclude the Guest role (rank 0) and the default "Member" role (rank 1 named
    // "Member"). A role is only excluded when BOTH conditions match — previously
    // this used `&&` which wrongly dropped any rank-1 role or any role named
    // "Member", causing legitimate roles to be deleted.
    const filteredRoles = roles.filter(
      role => role.rank !== 0 && !(role.rank === 1 && role.displayName === 'Member'),
    );

  const isOpenCloudSetup = await readminCollections.group_oauth_authorization.findOne({
    groupId,
    lastUsed: { $gt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // only consider OAuth links created in the last 90 days as valid
  })
  if (!isOpenCloudSetup) {
    console.log(`[SyncRoles-${workspace.groupId}] No valid OpenCloud OAuth link found, skipping role sync`);
    return;
  }

    const validRoleIds = filteredRoles.map(role => parseInt(role.id));

    // Upsert all current roles in a single batched round-trip.
    if (filteredRoles.length) {
      await readminCollections.group_role.bulkWrite(
        filteredRoles.map(role => {
          const id = parseInt(role.id);
          return {
            updateOne: {
              filter: { groupId, id },
              update: {
                $set: {
                  groupId,
                  id,
                  rank: role.rank,
                  memberCount: role.memberCount,
                  name: role.displayName,
                },
                $setOnInsert: { created: now },
              },
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );
    }

    // Remove roles that no longer exist on Roblox, plus the default Member role
    // (rank 1) which should never be tracked.
    const removedRoles = await readminCollections.group_role
      .find({
        groupId,
        $or: [
          { id: { $nin: validRoleIds } },
          { rank: 1, name: 'Member' },
        ],
      })
      .project<{ id: number }>({ id: 1 })
      .toArray();

    if (removedRoles.length) {
      const removedRoleIds = removedRoles.map(role => role.id);
      // Delete the stale roles and clean up any department assignments that
      // referenced them so old roles stop propagating into departments.
      await Promise.all([
        readminCollections.group_role.deleteMany({ groupId, id: { $in: removedRoleIds } }),
        readminCollections.department_role.deleteMany({ groupId, roleId: { $in: removedRoleIds } }),
      ]);
    }
  } catch (e) {
    console.log('roles ', e)
  }
}
