import { ObjectId } from "mongodb";

/**
 * `promote`/`demote` mean the member's HIGHEST rank moved up/down — the one
 * definition that survives members holding several roles at once. Gaining or
 * losing a role without changing the highest rank is a lateral move and emits
 * only `role.added`/`role.removed`.
 */
export type GroupAuditLogAction =
  | 'promote'
  | 'demote'
  | 'join'
  | 'leave'
  | 'role.added'
  | 'role.removed';

export type GroupAuditLog = {
  _id?: ObjectId;
  groupId: string;
  userId: string;
  action: GroupAuditLogAction;
  /**
   * The member's derived highest role/rank after and before the change, so
   * readers written against the single-role model keep rendering correctly.
   */
  newRole: number;
  newRank: number;
  oldRole: number;
  oldRank: number;
  /** The specific role added or removed. Only set on role.added / role.removed. */
  roleId?: number;
  date: Date;
}
