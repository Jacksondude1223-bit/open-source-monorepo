import { readminCollections } from "~/services/mongo.service";
import { Workspace } from "~/services/NewMongoTypes";
import { getDepartmentForWorkspaceOwner } from "~/services/workspaces.service";
import { AnyBulkWriteOperation, ObjectId } from "mongodb";
import { GroupMember } from "~/services/NewMongoTypes";
import { isSyntheticDepartmentId } from "~/services/departmentPermissions.service";
import { memberRoleIds } from "~/services/groupMember.helpers";

const BULK_BATCH_SIZE = 1000;

export default async function SyncDepartments(workspace: Workspace) {
    const groupId = workspace.groupId;

    const [members, departmentMembers, departmentRoles] = await Promise.all([
        // Only pull the fields we need to resolve + compare departments.
        readminCollections.group_member
            .find({ groupId })
            .project<Pick<GroupMember, '_id' | 'userId' | 'roleId' | 'roleIds' | 'departmentId' | 'departmentIds'>>({
                userId: 1,
                roleId: 1,
                roleIds: 1,
                departmentId: 1,
                departmentIds: 1,
            })
            .toArray(),
        readminCollections.department_users.find({ groupId }).toArray(),
        readminCollections.department_role.find({ groupId }).toArray(),
    ]);

    // userId (string) -> department _id (explicitly added members)
    const departmentByUserId = new Map<string, ObjectId>();
    for (const dm of departmentMembers) {
        departmentByUserId.set(dm.userId.toString(), dm.departmentId);
    }

    // roleId (number) -> department _id (members synced via their group role)
    const departmentByRoleId = new Map<number, ObjectId>();
    const rankByRoleId = new Map<number, number>();
    for (const dr of departmentRoles) {
        departmentByRoleId.set(dr.roleId, dr.departmentId);
        rankByRoleId.set(dr.roleId, dr.rankId ?? 0);
    }

    // The owner's department is computed specially; resolve it once.
    const ownerRobloxId = workspace.owner.robloxId;
    const ownerDepartmentId = ownerRobloxId
        ? (await getDepartmentForWorkspaceOwner(groupId, ownerRobloxId.toString()))._id
        : undefined;

    /**
     * Every department a member belongs to, via direct assignment or ANY of
     * their roles — a member holding several roles can sit in several
     * departments. Ordered highest-rank-role first so `departmentIds[0]` is a
     * sensible primary. Never emits the synthetic owner id, which is a string
     * masquerading as an ObjectId and must not be persisted or queried.
     */
    const resolveDepartmentIds = (member: typeof members[number]): ObjectId[] => {
        const userId = member.userId.toString();
        const ids: ObjectId[] = [];
        const seen = new Set<string>();
        const add = (id: ObjectId | undefined) => {
            if (!id || isSyntheticDepartmentId(id)) return;
            const key = id.toString();
            if (seen.has(key)) return;
            seen.add(key);
            ids.push(id);
        };

        if (userId === ownerRobloxId) add(ownerDepartmentId);
        add(departmentByUserId.get(userId));
        const roleIds = [...memberRoleIds(member)].sort(
            (a, b) => (rankByRoleId.get(b) ?? 0) - (rankByRoleId.get(a) ?? 0),
        );
        for (const roleId of roleIds) add(departmentByRoleId.get(roleId));

        return ids;
    };

    const sameIds = (a: ObjectId[], b: ObjectId[]) =>
        a.length === b.length && a.every((id, i) => id.equals(b[i]!));

    const operations: AnyBulkWriteOperation<GroupMember>[] = [];
    for (const member of members) {
        const desired = resolveDepartmentIds(member);
        const currentIds = member.departmentIds ?? (member.departmentId ? [member.departmentId] : []);
        const currentPrimary = member.departmentId;

        // Skip writes when nothing changed to avoid unnecessary churn.
        if (desired.length > 0) {
            if (
                sameIds(currentIds, desired) &&
                currentPrimary && currentPrimary.equals(desired[0]!)
            ) continue;
            operations.push({
                updateOne: {
                    filter: { _id: member._id },
                    update: { $set: { departmentIds: desired, departmentId: desired[0]! } },
                },
            });
        } else if (currentPrimary || currentIds.length > 0) {
            // Member is no longer in any department; clear the stale values.
            operations.push({
                updateOne: {
                    filter: { _id: member._id },
                    update: { $set: { departmentIds: [] }, $unset: { departmentId: '' } },
                },
            });
        }
    }

    for (let i = 0; i < operations.length; i += BULK_BATCH_SIZE) {
        await readminCollections.group_member.bulkWrite(
            operations.slice(i, i + BULK_BATCH_SIZE),
            { ordered: false },
        );
    }
}
