import { ObjectId } from 'mongodb';

export type SessionsTemplate = {
  _id?: ObjectId;
  id: string;
  groupId: string;
  name: string;
  description: string;
  roles: string[];
  schedule:
  | {
    type: 'daily';
    hour: number;
    minute: number;
  }
  | {
    type: 'weekly';
    day:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
    hour: number;
    minute: number;
  }|{type: 'none', hour: 0, minute: 0};
  appearsMinutesBefore: number;
  sessionDuration: number;
  placeId: number;
  gameId: number;
  createDiscordEvent: boolean;
  created: Date;
};
