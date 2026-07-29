import { ObjectId } from 'mongodb';

export type RobloxUser = {
  _id?: ObjectId;
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  externalAppDisplayName: string|null;
  isBanned: boolean;
  created: Date;
  description: string;
  headshotUrl: string;

  cacheInfo: {
    lastUpdated: Date;
    created: Date;
  }
};