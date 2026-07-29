import { ObjectId } from 'mongodb';

export type TeamMember = {
  _id?: ObjectId;
  groupId: string;
  teamId: ObjectId;
  userId: string; // robloxId
  roleId: string; // TeamRole.id within the team
  created: Date;
  addedBy: string; // robloxId of whoever added this member
};
