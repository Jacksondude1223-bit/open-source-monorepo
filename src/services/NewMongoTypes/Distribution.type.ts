import { ObjectId } from "mongodb";

export type Distribution = {
  _id?: ObjectId;
  groupId: string;
  isCurrent: boolean;
  num: number;
  from: Date;
  to?: Date;
  automated?: true;
  created: Date;
}
