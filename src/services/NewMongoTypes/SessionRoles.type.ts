import { ObjectId } from 'mongodb';

export type SessionRole = {
  id: string;
  name: string;
  maxUsers: number;
  minRank: number;
  claimOnce: boolean;
};

export type SessionRoles = {
  _id?: ObjectId;
  id: string;
  groupId: string;
  name: string;
  roles: SessionRole[];
  usedBy: string[];
  created: Date;
};
