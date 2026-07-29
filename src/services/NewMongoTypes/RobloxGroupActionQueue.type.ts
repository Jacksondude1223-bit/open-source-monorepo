import { ObjectId } from 'mongodb';

export type rankingAPIMetadata = {
  //@ts-expect-error er what
  rankingKeyId?: string;
  [key: string]: string; // metadata
};

export type RobloxGroupActionQueue = {
  _id?: ObjectId;
  actionId: string;
  groupId: string;
  actionType: 'rank' | 'exile' | 'acceptJoinRequest' | 'denyJoinRequest' | 'message' | 'shout';
  userId?: string;
  rankId?: number;
  roleId?: number;
  subject?: string;
  body?: string;
  shout?: string;
  status: 'pending' | 'failed' | 'complete';
  failure?: {
    reason: string | 'loggedout';
    retryable: boolean;
    retryCount?: number;
    retryDates?: Date[];
    failureDate?: Date;
  };
  method: 'open-cloud' | 'roblox-bot';
  initatorUserId?: string;
  initatorSource?: 'ranking-api' | 'user' | 'discord' | 'application';
  rankingApiMetadata?: rankingAPIMetadata;
  created: Date;
};
