import { Filter, ObjectId } from 'mongodb';
import { GroupMember } from '~/services/NewMongoTypes';

/**
 * Accessors and query builders for the multi-role `group_member` shape.
 *
 * A Roblox community member can hold several roles. `group_member` stores the
 * full set in `roleIds`/`rankIds`/`departmentIds`, and keeps the original
 * scalar `roleId`/`rankId`/`departmentId` as the derived highest/primary so the
 * many threshold checks and display paths that only want one value keep working.
 *
 * Until the Phase 3 backfill finishes, older documents have only the scalars.
 * Everything here tolerates that, so no caller needs to know about the window —
 * and when the backfill is done the tolerance is removed in ONE place (see
 * MIGRATION below) rather than at every call site.
 */

// ── Accessors ────────────────────────────────────────────────────────────────

export function memberRoleIds(member: Pick<GroupMember, 'roleId' | 'roleIds'>): number[] {
    return member.roleIds?.length ? member.roleIds : [member.roleId];
}

export function memberRankIds(member: Pick<GroupMember, 'rankId' | 'rankIds'>): number[] {
    return member.rankIds?.length ? member.rankIds : [member.rankId];
}

export function memberDepartmentIds(
    member: Pick<GroupMember, 'departmentId' | 'departmentIds'>,
): ObjectId[] {
    if (member.departmentIds?.length) return member.departmentIds;
    return member.departmentId ? [member.departmentId] : [];
}

/** The member's highest rank. Equivalent to the stored scalar, computed defensively. */
export function memberHighestRank(member: Pick<GroupMember, 'rankId' | 'rankIds'>): number {
    return Math.max(...memberRankIds(member));
}

// ── Query builders ───────────────────────────────────────────────────────────
//
// MIGRATION: while some documents predate the backfill, each builder emits a
// dual-branch filter — the array form for migrated docs, the scalar form for the
// rest. Once `countDocuments({ roleIds: { $exists: false } })` is 0 across the
// board, delete the `legacy` branches below and these collapse to the plain
// array match. That is the only edit required; every call site is already
// routed through here.

export function roleIdFilter(roleId: number): Filter<GroupMember> {
    return {
        $or: [
            { roleIds: roleId },
            { roleIds: { $exists: false }, roleId },
        ],
    };
}

export function roleIdInFilter(roleIds: number[]): Filter<GroupMember> {
    return {
        $or: [
            // On an array field `$in` means "intersects", which is what we want.
            { roleIds: { $in: roleIds } },
            { roleIds: { $exists: false }, roleId: { $in: roleIds } },
        ],
    };
}

export function departmentIdFilter(departmentId: ObjectId): Filter<GroupMember> {
    return {
        $or: [
            { departmentIds: departmentId },
            { departmentIds: { $exists: false }, departmentId },
        ],
    };
}

export function departmentIdInFilter(departmentIds: ObjectId[]): Filter<GroupMember> {
    return {
        $or: [
            { departmentIds: { $in: departmentIds } },
            { departmentIds: { $exists: false }, departmentId: { $in: departmentIds } },
        ],
    };
}

/**
 * Combine a role filter with other conditions. The builders above return an
 * `$or`, so spreading two of them into one object would drop the first — this
 * wraps them in `$and` instead.
 */
export function andFilters(...filters: Filter<GroupMember>[]): Filter<GroupMember> {
    const nonEmpty = filters.filter(f => Object.keys(f).length > 0);
    if (nonEmpty.length === 0) return {};
    if (nonEmpty.length === 1) return nonEmpty[0]!;
    return { $and: nonEmpty };
}
