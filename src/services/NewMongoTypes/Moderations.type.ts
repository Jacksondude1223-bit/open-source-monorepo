import { ObjectId } from 'mongodb';

export type Moderations = {
  _id?: ObjectId;
  discordId?: string;
  robloxId?: string;
  groupId?: string;
  reason: string;
  createdBy: {
    hidden: boolean;
    discordId: string;
    robloxId: string;
  };
  expiration?: Date;
  created?: Date;
};
