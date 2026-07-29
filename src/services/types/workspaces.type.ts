
import { ObjectId } from 'mongodb';
import { Department } from '~/services/NewMongoTypes';
import { Workspace } from '~/services/NewMongoTypes/Workspace.type';

export interface WorkspaceWithRole extends Workspace {
  _id?: ObjectId;
  role: string;
  department: Department;
}
