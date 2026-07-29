import { ObjectId } from 'mongodb';

export type PendingVerifications = {
  _id?: ObjectId;
  discordId: string;
  verificationId: string;
  created: Date;
};
