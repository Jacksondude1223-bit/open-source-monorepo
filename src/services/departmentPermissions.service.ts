import { ObjectId } from 'mongodb';
import { Department, GroupMember } from '~/services/NewMongoTypes';
import { DepartmentPermissions } from '~/services/NewMongoTypes/Department.type';
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import { WORKSPACE_NO_ACCESS_PERMISSIONS } from '~/services/constants/WorkspaceOwnerPermissions';
import { readminCollections } from '~/services/mongo.service';
import { memberRoleIds } from '~/services/groupMember.helpers';

/**
 * Merging departments for members who hold several Roblox roles.
 *
 * A Roblox role maps to at most one department (enforced by the conflict check
 * in settings/departments.ts), so a member only ends up with several departments
 * because they hold several roles. Their effective permissions are the UNION:
 * holding a staff role should never take away what another of your roles grants.
 */

// ── The merge spec ───────────────────────────────────────────────────────────
//
// Every leaf is combined with OR, because permissions are grants. The single
// exception is `writeUps.approval_required`, which is a RESTRICTION — OR-ing it
// would make a member MORE restricted for holding an extra role, so it is AND'd
// (if any of your roles is exempt from approval, you are exempt). That matches
// how the existing check reads it: `approval_required && approver !== true`.
type LeafRule = 'or' | 'and';

type PermissionSpec = {
    [Group in keyof DepartmentPermissions]: DepartmentPermissions[Group] extends boolean
    ? LeafRule
    : { [Leaf in keyof DepartmentPermissions[Group]]-?: LeafRule };
};

/**
 * Exhaustive by construction: adding a permission group or leaf to
 * DepartmentPermissions without listing it here is a COMPILE ERROR. That is
 * deliberate — an unlisted permission would silently be dropped to `false` for
 * every multi-role member, and there is no test suite to catch it.
 */
const PERMISSION_MERGE_SPEC: PermissionSpec = {
    feed: { postPublic: 'or', postDepartment: 'or' },
    activity: {
        view: 'or', createInactivity: 'or', approveInactivity: 'or',
        requestInactivityForOtherUsers: 'or', manageInactivity: 'or',
        viewTimeOffReasons: 'or', ranking: 'or', admin: 'or',
    },
    writeUps: {
        writeUps: 'or', suspensions: 'or', terminations: 'or', delete: 'or',
        promote: 'or', demote: 'or',
        // The one restriction in the whole permission set.
        approval_required: 'and',
        approver: 'or', viewHidden: 'or',
    },
    profile: { view: 'or', edit: 'or' },
    knowledgeHub: { manage: 'or' },
    reports: { view: 'or', export: 'or' },
    games: { view: 'or', manageBans: 'or', admin: 'or' },
    sessions: { view: 'or', createOneTime: 'or', manage: 'or', attendance: 'or' },
    calls: { view: 'or', manage: 'or', deleteBans: 'or' },
    applications: { viewApplications: 'or', readApplications: 'or', editApplications: 'or' },
    promotionRequests: { view: 'or', create: 'or', viewClosed: 'or', delete: 'or', manage: 'or' },
    tasks: { assign: 'or' },
    teams: { view: 'or', manage: 'or', manageAll: 'or', approve: 'or' },
    postings: { canManage: 'or', canViewApplicants: 'or' },
    timeclock: { clock: 'or', view: 'or', manage: 'or', edit: 'or' },
    orders: { view: 'or', manage: 'or', manageProducts: 'or', manageSettings: 'or' },
    admin: 'or',
};

export function mergePermissions(list: DepartmentPermissions[]): DepartmentPermissions {
    if (list.length === 1) return list[0]!;
    // Deep clone so the shared constant is never mutated.
    const merged = JSON.parse(JSON.stringify(WORKSPACE_NO_ACCESS_PERMISSIONS)) as DepartmentPermissions;
    if (list.length === 0) return merged;

    // `approval_required` is AND'd, so it must start true and be narrowed —
    // the no-access baseline has it false, which would swallow every source.
    let approvalRequired = true;

    for (const permissions of list) {
        if (!permissions) continue;
        for (const groupKey of Object.keys(PERMISSION_MERGE_SPEC) as (keyof PermissionSpec)[]) {
            const rule = PERMISSION_MERGE_SPEC[groupKey];
            if (rule === 'or') {
                // Top-level boolean (`admin`).
                (merged as any)[groupKey] = (merged as any)[groupKey] === true || (permissions as any)[groupKey] === true;
                continue;
            }
            const sourceGroup = (permissions as any)[groupKey] || {};
            const targetGroup = ((merged as any)[groupKey] ||= {});
            for (const leafKey of Object.keys(rule) as string[]) {
                if ((rule as any)[leafKey] === 'and') {
                    approvalRequired = approvalRequired && sourceGroup[leafKey] === true;
                    continue;
                }
                targetGroup[leafKey] = targetGroup[leafKey] === true || sourceGroup[leafKey] === true;
            }
        }
    }

    merged.writeUps.approval_required = approvalRequired;
    return merged;
}

// ── Effective department ─────────────────────────────────────────────────────

export const SYNTHETIC_OWNER_DEPARTMENT_ID = 'readmin-internal-workspace-owner';

/**
 * The workspace owner gets a fabricated department whose `_id` is a string cast
 * to ObjectId. It must never be written to group_member.departmentIds or used in
 * an `$in`, so callers that persist or query department ids filter with this.
 */
export function isSyntheticDepartmentId(id: unknown): boolean {
    return id?.toString() === SYNTHETIC_OWNER_DEPARTMENT_ID;
}

export type EffectiveDepartment = Department & {
    /**
     * Every real department this was merged from. Scope checks that ask "is this
     * item visible to my department" must test against all of these, not just
     * `_id` — see the feed / knowledge-hub / banner queries.
     */
    sourceDepartmentIds: ObjectId[];
    sourceDepartments: { _id: ObjectId; name: string; color?: BrandColors }[];
};

/**
 * Collapse several departments into one effective department.
 *
 * With exactly ONE source this returns that department's real `_id`, name and
 * colour unchanged — which is what keeps every existing `ctx.department._id`
 * scope check byte-identical for single-role members (the vast majority).
 */
export function mergeDepartments(groupId: string, departments: Department[]): EffectiveDepartment {
    const real = departments.filter(Boolean);
    const sourceDepartments = real
        .filter(d => d._id && !isSyntheticDepartmentId(d._id))
        .map(d => ({ _id: d._id!, name: d.name, color: d.color }));
    const sourceDepartmentIds = sourceDepartments.map(d => d._id);

    if (real.length === 1) {
        const only = real[0]!;
        return { ...only, sourceDepartmentIds, sourceDepartments };
    }

    // Deterministic primary: an admin department if there is one, else the first
    // given (callers pass them highest-role-first).
    const primary = real.find(d => d.permissions?.admin) ?? real[0];

    return {
        ...(primary as Department),
        groupId,
        _id: primary?._id,
        name: real.map(d => d.name).join(' + '),
        isOwner: real.some(d => d.isOwner) ? true : undefined,
        permissions: mergePermissions(real.map(d => d.permissions).filter(Boolean)),
        cankRankRoles: Array.from(new Set(real.flatMap(d => d.cankRankRoles || []))),
        sourceDepartmentIds,
        sourceDepartments,
    };
}

/**
 * The department ids a visibility check should match against.
 *
 * Use this anywhere an item is scoped to a department ("visible to departments
 * X, Y"). A member holding several roles belongs to all of their departments, so
 * matching only `department._id` would hide items their other roles can see.
 * Falls back to the single `_id` for a plain Department.
 */
export function departmentScopeIds(department: Department | EffectiveDepartment | null | undefined): ObjectId[] {
    if (!department) return [];
    const sources = (department as EffectiveDepartment).sourceDepartmentIds;
    if (sources?.length) return sources;
    return department._id && !isSyntheticDepartmentId(department._id) ? [department._id] : [];
}

/**
 * Resolve every department a user belongs to in a workspace, from BOTH direct
 * department assignment and all of their Roblox roles.
 *
 * Always reads department_users / department_role live rather than the
 * denormalised `group_member.departmentIds` cache, so a permission edit takes
 * effect immediately instead of on the next member sync (which can be up to 12
 * hours away for a non-premium workspace).
 */
export async function resolveDepartmentsForUser(
    groupId: string,
    userId: string,
    opts?: { member?: Pick<GroupMember, 'roleId' | 'roleIds'> | null; extraRoleIds?: number[] },
): Promise<Department[]> {
    const member = opts?.member;
    const roleIds = Array.from(new Set([
        ...(member ? memberRoleIds(member) : []),
        ...(opts?.extraRoleIds ?? []),
    ]));

    const [directAssignments, roleMappings] = await Promise.all([
        readminCollections.department_users.find({ groupId, userId }).toArray(),
        roleIds.length > 0
            ? readminCollections.department_role.find({ groupId, roleId: { $in: roleIds } }).toArray()
            : Promise.resolve([]),
    ]);

    const departmentIds = Array.from(new Set([
        ...directAssignments.map(a => a.departmentId.toString()),
        ...roleMappings.map(m => m.departmentId.toString()),
    ])).map(id => new ObjectId(id));

    if (departmentIds.length === 0) return [];

    const departments = await readminCollections.department
        .find({ groupId, _id: { $in: departmentIds } })
        .toArray();

    // Order highest-rank-role first so mergeDepartments' primary tie-break is
    // deterministic and matches the member's most senior role.
    const rankByDepartmentId = new Map<string, number>();
    for (const mapping of roleMappings) {
        const key = mapping.departmentId.toString();
        rankByDepartmentId.set(key, Math.max(rankByDepartmentId.get(key) ?? 0, mapping.rankId ?? 0));
    }
    return departments.sort(
        (a, b) => (rankByDepartmentId.get(b._id!.toString()) ?? 0) - (rankByDepartmentId.get(a._id!.toString()) ?? 0),
    );
}

/**
 * The single effective department for a user, or null when they belong to none.
 * Pass `extraRoleIds` to fold in roles known from a source other than
 * `group_member` (e.g. the live Roblox group listing).
 */
export async function resolveEffectiveDepartment(
    groupId: string,
    userId: string,
    opts?: { member?: Pick<GroupMember, 'roleId' | 'roleIds'> | null; extraRoleIds?: number[] },
): Promise<EffectiveDepartment | null> {
    const departments = await resolveDepartmentsForUser(groupId, userId, opts);
    if (departments.length === 0) return null;
    return mergeDepartments(groupId, departments);
}
