import { ObjectId } from 'mongodb';

/**
 * Links a source (Roblox group role OR department) to a team+role so that all
 * members of the source are implicitly team members — no individual
 * team_member docs needed.
 */
export type TeamRoleLink = {
  _id?: ObjectId;
  groupId: string;
  teamId: ObjectId;
  roleId: string; // TeamRole.id within the team
  sourceType: 'robloxRole' | 'department';
  robloxRoleId?: number; // set when sourceType === 'robloxRole'
  departmentId?: ObjectId; // set when sourceType === 'department'
  created: Date;
  createdBy: string; // robloxId
};
