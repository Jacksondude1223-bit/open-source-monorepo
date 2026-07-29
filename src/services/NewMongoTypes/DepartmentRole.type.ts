import { ObjectId } from "mongodb";


export type DepartmentRole = {
  _id?: ObjectId;
  groupId: string;
  departmentId: ObjectId;
  roleId: number;
  rankId: number;
  created: Date;
}
