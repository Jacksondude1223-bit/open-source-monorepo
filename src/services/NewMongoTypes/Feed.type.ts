import { ObjectId } from "mongodb";


export type Feed = {
  _id?: ObjectId;
  groupId: string;
  departments?: ObjectId[];
  userId: string;
  content: string;
  attachments: string[];
  created: Date;
}
