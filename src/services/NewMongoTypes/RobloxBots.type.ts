import { ObjectId } from 'mongodb';

export type FailedRobloxAction =
  | {
    action: 'rank';
    id: string;
    retry: number;
    userId: string;
    rankId: string;
  }
  | {
    action: 'exile';
    id: string;
    retry: number;
    userId: string;
  }
  | {
    action: 'message';
    id: string;
    retry: number;
    userId: string;
    subject: string;
    body: string;
  };

export type RobloxBots = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  password: string;
  userId: number;
  displayName: string;
  cookie: string;
  loggedIn: boolean;
  pendingLogin: boolean;
  created: Date;
};
