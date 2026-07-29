import { ObjectId } from 'mongodb';

export type TeamRole = {
  id: string; // UUID
  name: string;
  isLead: boolean; // Whether this role has manager-level permissions over the team
  robloxRoleId?: number; // Synced Roblox group role ID (for auto-sync from ReAdmin)
  created: Date;
};

export type Team = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  description?: string;
  parentTeamId?: ObjectId | null; // null = top-level team
  roles: TeamRole[];
  syncedDepartments?: string[]; // Department IDs that auto-sync members
  autoSyncEnabled?: boolean; // Whether to auto-sync based on Roblox roles
  created: Date;
  createdBy: string; // robloxId
  updatedAt?: Date;
};
