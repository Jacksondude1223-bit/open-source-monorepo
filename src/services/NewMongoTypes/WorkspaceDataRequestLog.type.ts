import { ObjectId } from 'mongodb';

/**
 * Audit record for a workspace admin fulfilling a player's data-access or
 * data-deletion request for ReAdmin activity tracking.
 *
 * Built for the Roblox scoped-user-ID privacy rollout: the in-game privacy
 * policy tells players to "contact the group" to request or delete their data
 * (Roblox ToS forbids linking them to the ReAdmin website from in-game), so a
 * workspace admin actions the request from the panel. Every export/delete is
 * recorded here so the workspace has a defensible trail of who actioned what,
 * for whom, and how much data it touched.
 */
export type WorkspaceDataRequestAction = 'export' | 'delete';

export type WorkspaceDataRequestLog = {
  _id?: ObjectId;
  groupId: string;
  // Who performed the action (the acting admin).
  actorRobloxId: string;
  actorName?: string;
  // The data subject, captured at action time.
  subjectUserKey: string; // canonical key the admin looked up (see userIdentity.service.ts)
  subjectKeys: string[]; // every linked identity key the action covered
  subjectGlobalUserId?: number; // global Roblox id, when known
  action: WorkspaceDataRequestAction;
  // Per-collection record counts — number exported (access) or deleted (deletion).
  counts: Record<string, number>;
  created: Date;
};
