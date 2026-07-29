import { ObjectId } from 'mongodb';
import { SessionsTemplate } from './SessionsTemplate.type';

export type UserState = 'none' | 'current' | 'completed' | 'passed' | 'failed';
export type SessionClaim = {
  claimedRole?: string;
  state?: UserState;
  claimedBy: string;
  claimedAt: Date;
  claimId: string;
};
export type SessionClaimV2 = {
  userId: string;
  claimedRole?: string;
  state?: UserState;
  claimedBy: string;
  claimedAt: Date;
  claimId: string;
};
export type SessionAttendee = {
  state?: UserState;
  addedBy: string;
}
export type SessionServerType = {
  nickname?: string;
  linkedToServer: boolean;
  linkedServerReAdminId?: string; // the ReAdmin 'running_game' _id
  linkedServerJobId?: string;
  linkedByUser?: string;

  claims: {
    [userId: string]: SessionClaim;
  } | SessionClaimV2[]
  attendees: {
    [userId: string]: SessionAttendee;
  };
};
export type SessionCommentType = {
  id: string;
  authorId: string;
  note: string;
  deleteable: boolean;
  attachments: string[];
  created: Date;
};

export type Session = {
  _id?: ObjectId;
  groupId: string;
  id: string;
  templateId: ObjectId | null;
  claims: string[];
  attendees: string[];
  comments: SessionCommentType[];
  servers: {
    [serverId: string]: SessionServerType;
  };
  newClaimingSystem?: true;

  date: Date;
  notifyTime: Date;
  endsAt: Date;
  created: Date;
  createdBy?: string;
  sentDMS: boolean;
  sentStartMessage: boolean;
  sentEndMessage: boolean;
  oneOffSession: boolean;
  template: SessionsTemplate;
  createdDiscordEvent?: boolean;
};
