import { ObjectId } from "mongodb";

export type PromotionRequestStatus = 'pending' | 'approved' | 'declined';

export type PromotionRequestVote = {
  userId: string; // robloxId of the voter
  vote: 'support' | 'oppose';
  comment: string; // required comment explaining the vote
  attachments: string[]; // CDN file paths for images
  created: Date;
};

export type PromotionRequestComment = {
  userId: string;
  message: string;
  attachments: string[]; // CDN file paths for images
  created: Date;
};

export type PromotionRequest = {
  _id?: ObjectId;
  groupId: string;
  targetUserId: string; // robloxId of the user being nominated
  targetUserName: string; // display name at time of creation
  currentRoleId: number; // role id at time of creation
  currentRoleName: string; // role name at time of creation
  requestedRoleId?: number; // optional: specific role being requested
  requestedRoleName?: string;
  reason: string; // why this user should be promoted
  attachments: string[]; // CDN file paths for images on the request itself
  requestedBy: string; // robloxId of the requester
  requestedByName: string;
  status: PromotionRequestStatus;
  votes: PromotionRequestVote[];
  comments: PromotionRequestComment[];
  closedBy?: string; // robloxId of staff who closed it
  closedByName?: string;
  closeComment?: string; // closing remark e.g. "Approved! Ranked to X"
  rankedTo?: string; // role name if auto-ranked
  created: Date;
  closedAt?: Date;
};
