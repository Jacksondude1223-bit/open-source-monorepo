import { ObjectId } from 'mongodb';

export type QueuedGameAction = {
  _id?: ObjectId;
  internalGameId: string;
  runningGameId?: ObjectId;
  type: 'kick' | 'notify' | 'shutdown';
  userId: string;
  message: string;
  created: Date;
};
