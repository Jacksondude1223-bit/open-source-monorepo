import { ObjectId } from 'mongodb';

export type RunningGameChats = {
  _id?: ObjectId;
  runningGameId?: ObjectId;
  internalGameId: string;
  message: string;
  userId: string;
  // Canonical identity key (see userIdentity.service.ts); missing on records
  // written before the scoped-ID migration — treat as userId.
  userKey?: string;
  to?: string;
  created: Date;
};
