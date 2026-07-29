import { ObjectId } from 'mongodb';

export type Summary = {
  sessions: ObjectId[];
  minutes: {
    total: number;
    active: number;
    inactive: number;
    typing: number;
    messages: number;
  };
};

export type UserGameSessionYearlySummary = {
  _id?: ObjectId;
  userId: string;
  groupId: string;
  year: string;
  sessions: ObjectId[];
  minutes: {
    total: number;
    active: number;
    inactive: number;
    typing: number;
    messages: number;
  };
  summaries: {
    weeks: { [week: number]: Summary };
    months: { [month: number]: Summary };
    days?: { [dayKey: string]: Summary };
  };
  attendedSessions?: string[];
  updated?: Date;
  created: Date;
};
