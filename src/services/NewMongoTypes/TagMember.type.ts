import { ObjectId } from "mongodb";

export type TagMember = {
  _id?: ObjectId;
  groupId: string;
  userId: string;
  tagId: string;
  created: Date;
}
