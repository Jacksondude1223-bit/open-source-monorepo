import { ObjectId } from 'mongodb';

/**
 * A player's activity-tracking consent decision within one workspace. Only
 * relevant when the workspace has privacySettings.requireConsent on.
 *
 *  - 'granted' : the player opted in; track normally.
 *  - 'denied'  : the player opted out. This doubles as the per-workspace
 *                tracking ignore — a denied player is skipped at join, same as
 *                a GDPR-removed user, but scoped to this workspace only.
 *
 * Keyed by canonical userKey (see userIdentity.service.ts) so the decision
 * follows scoped and legacy identities alike. Opting out does NOT purge past
 * data — deletion is a separate request the player makes by contacting the
 * group (workspace-admin tooling, tracked separately).
 */
export type WorkspaceTrackingConsent = {
  _id?: ObjectId;
  groupId: string;
  userKey: string;
  status: 'granted' | 'denied';
  decidedAt: Date;
  updatedAt: Date;
  // internalGameId where the decision was made (audit trail).
  decidedInGameId?: string;
};
