import { ObjectId } from "mongodb";

export type HubResourceOpen = {
  _id?: ObjectId;
  groupId: string;
  resourceId: ObjectId;
  userId: string;
  url: string;
  date: Date;
}
