import { ObjectId } from 'mongodb';

export type logType = 'Output' | 'Info' | 'Warning' | 'Error';

export type RunningGames = {
  _id?: ObjectId;
  version: string;
  groupId: string;
  internalGameId: string;
  gameId: number;
  placeId: number;
  jobId: string;
  privateServerId: string;
  privateServerOwnerId: number;
  placeVersion: number;
  players: string[];
  lastPing: Date;
  created: Date;
};
