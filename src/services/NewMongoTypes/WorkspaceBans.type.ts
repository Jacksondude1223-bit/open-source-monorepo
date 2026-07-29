import { ObjectId } from "mongodb";

export type WorkspaceBans = {
  _id?: ObjectId;
  groupId: string;
  userId: string;
  reason: string;
  disciplinarianId: string;
  active: boolean;
  expires?: Date;
  created: Date;
  evidence?: string[];
}
