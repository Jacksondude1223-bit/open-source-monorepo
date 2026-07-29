import { ObjectId } from 'mongodb';

export type PunishmentType = 'promotion' | 'writeup' | 'suspension' | 'termination' | 'demotion';

// Controls who can read a punishment's reason:
//   public       → anyone who can see the punishment reads the reason (default)
//   reasonHidden → entry stays visible, reason + evidence masked from users
//                  without the writeUps.viewHidden permission
//   hidden       → entry is removed entirely for users without writeUps.viewHidden
// The author, approver, and admins/viewHidden holders always see full content.
export type PunishmentVisibility = 'public' | 'reasonHidden' | 'hidden';

export type WriteUps = {
  _id?: ObjectId;
  groupId: string;
  type: PunishmentType;
  pendingApproval?: boolean;
  approvedBy?: string;
  notify?: boolean;
  evidence: string[]; // links/images to evidence
  rankTo?: string | boolean; // the rank they were demoted/promoted to
  rankFrom?: string; // what rank the user was when they got the promotion/suspension/termination
  ended?: boolean; // if the suspension has ended
  endedBy?: string; // who ended the suspension
  userId: number;
  disciplinarianId: number;
  distribution?: number;
  reason: string;
  visibility?: PunishmentVisibility; // defaults to 'public' when absent
  expires?: Date;
  created: Date;
  // Transient (not persisted): set by the API when `reason` has been masked from a
  // viewer who lacks the writeUps.viewHidden permission.
  reasonHidden?: boolean;
};
