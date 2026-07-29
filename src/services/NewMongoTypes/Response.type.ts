import { ObjectId } from 'mongodb';
import { ResponseApplicationQuestion, ResponseStatus } from './Application.type';

export type Comment = {
  userId: string;
  message: string;
  created: Date;
};

export type Response = {
  _id?: ObjectId;
  groupId: string;
  applicationId: string;
  source: 'game' | 'online' | 'discord';
  status: ResponseStatus;
  // Whether a reviewer has marked this response as read.
  read?: boolean;
  comments: Comment[];
  timeTakenSeconds: number;
  score?: number;
  userId: string;
  responseBody: ResponseApplicationQuestion[];
  created: Date;
};
