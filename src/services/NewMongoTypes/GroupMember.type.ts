import { ObjectId } from "mongodb";

export type GroupMember = {
  _id?: ObjectId;
  groupId: string;
  userId: number;
  /**
   * DERIVED: the rank of the member's highest role — `max(rankIds)`. Kept as a
   * scalar because threshold checks (`rankId >= minSyncRole`) stay correct
   * against it: max(rankIds) >= X is equivalent to any(rankIds) >= X.
   */
  rankId: number;
  /** DERIVED: the member's highest role, tie-broken by the higher role id. */
  roleId: number;
  /** DERIVED: primary department, chosen from departmentIds. */
  departmentId?: ObjectId; // in department
  /**
   * Every role the member holds. Roblox communities allow more than one.
   *
   * Only contains SYNCABLE roles — `syncableRoles` in SyncMembers drops rank 0,
   * the default rank-1 "Member" role, anything below `workspace.minSyncRole`,
   * and roles larger than `overrideRoleMaximumSize`. So a member can hold a
   * Roblox role that never appears here; that matches what ReAdmin has always
   * tracked, and is the most likely source of "why isn't my role in roleIds".
   *
   * Optional only until the backfill completes — read it through
   * `memberRoleIds()` in groupMember.helpers.ts, never directly.
   */
  roleIds?: number[];
  /**
   * The ranks the member holds. A SET, not positionally aligned with `roleIds`
   * — both are accumulated with $setUnion, and two roles can share a rank. Use
   * it for "does the member hold rank X" and threshold checks; to get the rank
   * of a SPECIFIC role, look that role up in `group_role`.
   */
  rankIds?: number[];
  /** Every department the member's roles map into. Read via `memberDepartmentIds()`. */
  departmentIds?: ObjectId[];
  /**
   * Transient, written by SyncMembers and unset again by its derive pass at the
   * end of the same run: the pre-run role set / highest role, used to diff for
   * join / promote / demote / role.added / role.removed audit events without
   * holding an O(members) map in process memory. Never read outside that sync.
   */
  prevRoleIds?: number[];
  prevRoleId?: number;
  prevRankId?: number;
  /**
   * Whether the member already had a role set before this run. False marks the
   * one-off migration from the single-role shape, where a computed rank change
   * is a correction of stale data rather than a real promotion/demotion — so
   * the derive pass writes the corrected value but suppresses the event.
   */
  prevHadRoleIds?: boolean;
  inGame?: boolean;
  inGameId?: string; // running interal game id
  inRunningGameId?: ObjectId; // running game id
  lastSessionId?: any;
  sessionId?: any;
  playerId?: any;
  safeChat?: boolean;
  timezone?: string | null;
  created: Date;
  // Sync marker — set on every successful upsert during SyncMembers. After a
  // sync completes, any member whose lastSeenSyncId !== current run's syncId
  // is considered to have left the group.
  lastSeenSyncId?: ObjectId;
}
