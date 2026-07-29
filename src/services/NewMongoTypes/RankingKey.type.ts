import { ObjectId } from 'mongodb';

export type RankingKey = {
  _id?: ObjectId;
  groupId: string;
  id: string;
  key: string;
  name: string;
  rankingEnabled: boolean;
  allowedRanks: number[];
  enableShouting: boolean;
  enableJoinRequestManagement: boolean;
  enableExile: boolean;
  created: Date;
};
