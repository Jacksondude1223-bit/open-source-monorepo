import { ObjectId } from "mongodb";

export type GroupRole = {
  _id?: ObjectId;
  groupId: string;
  id: number;
  rank: number;
  memberCount: number;
  name: string;
  created: Date;
}
