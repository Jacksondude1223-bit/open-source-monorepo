import { ObjectId } from 'mongodb';

export type UserGameSessionEvent = {
  _id?: ObjectId;
  eventId?: string;
  userGameSession: ObjectId;
  groupId: number;
  userId: number;
  // Canonical identity key (see userIdentity.service.ts); missing on records
  // written before the scoped-ID migration — treat as String(userId).
  userKey?: string;


  type: 'active' | 'idle' | 'message' | 'typing' | 'join' | 'leave';
  message?: string;
  to?: string;
  date: Date;

  created: Date;
};
