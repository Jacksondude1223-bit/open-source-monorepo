import { ObjectId } from "mongodb";

export type TagColor = 'red' | 'yellow' | 'green' | 'blue';

export type Tag = {
  _id?: ObjectId;
  groupId: string;
  tagId: string;
  name: string;
  color: TagColor;
  created: Date;
}
