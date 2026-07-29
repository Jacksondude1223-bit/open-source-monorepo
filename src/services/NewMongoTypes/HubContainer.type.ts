import { ObjectId } from "mongodb";

export type HubContainer = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  description: string;
  visibleToDepartments: ObjectId[];
  resources: ObjectId[];
  created: Date;
}
