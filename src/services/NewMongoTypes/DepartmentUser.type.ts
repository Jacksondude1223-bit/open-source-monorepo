import { ObjectId } from "mongodb";

export type DepartmentUser = {
  _id?: ObjectId;
  groupId: string;
  departmentId: ObjectId;
  userId: string;
  created: Date;
}
