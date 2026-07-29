import { ObjectId } from "mongodb";

export type ActivityRequirement = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  departments: ObjectId[];
  type: 'global' | 'game';
  gameId?: string; // Universe ID
  placeId?: string; // Sub universe
  minimumMinutes: number;
  minimumActiveMinutes: number;
  minimumMessages: number;
  minimumSessions: number;
  created: Date;
}
