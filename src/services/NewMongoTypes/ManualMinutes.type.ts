import { ObjectId } from 'mongodb';

export type ManualMinutes = {
  _id?: ObjectId;
  groupId: string;
  userId: string;
  createdBy: string;
  type: 'idle' | 'active' | 'typing';
  minutes: number;
  distribution: number;
  created: Date;
};
