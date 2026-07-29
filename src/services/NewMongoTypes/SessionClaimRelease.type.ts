import { ObjectId } from 'mongodb';

// Audit record written every time a user's claim is released/unclaimed from a
// session server. There is no backfill — only releases that happen after this
// ships are recorded. Powers the "Replaced" (R) status on the attendance grid:
// a user who once held a claim on a session but no longer does.
export type SessionClaimRelease = {
  _id?: ObjectId;
  groupId: string; // string form, matches session.groupId
  sessionId: string; // session _id as a string
  serverId: string; // the server the claim was released from
  userId: string; // the user whose claim was released
  claimId?: string; // the released claim's id, when known
  claimedRole?: string; // role/subrole id that was released (for host analysis)
  releasedBy: string; // robloxId of the actor performing the release
  reason?: 'manual' | 'reassigned' | 'admin';
  created: Date;
};
