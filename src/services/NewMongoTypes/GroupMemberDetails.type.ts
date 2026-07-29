import { ObjectId } from "mongodb";

/**
 * Workspace-scoped personal/contact details an admin (or a member of a
 * department with the `profile.edit` permission) can attach to a group member.
 *
 * Some of these fields are PII, so reading them is gated behind the
 * `profile.view` permission. The `address` field is considered sensitive and is
 * stored encrypted at rest (see Crypto-service) — it is only ever decrypted
 * server-side for users that pass the view permission check.
 *
 * Birthday is intentionally NOT stored here: it is sourced read-only from the
 * member's ReAdmin user account (`user.birthday`).
 */
export type GroupMemberDetails = {
  _id?: ObjectId;
  groupId: string;
  userId: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  country?: string;
  timezone?: string;
  // Stored encrypted at rest in the `iv:cipher` hex format produced by
  // Crypto-service.encrypt(). Never persisted in plaintext.
  address?: string;
  updatedBy?: string; // robloxId of the staff member who last edited
  updatedAt?: Date;
  created: Date;
};
