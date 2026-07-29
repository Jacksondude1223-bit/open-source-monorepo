import { ObjectId } from "mongodb";

export type UserNoteCategory = 'commendation' | 'poor_performance';

export type UserNote = {
  _id?: ObjectId;
  groupId: string;
  userId: string;
  authorId: string;
  note: string;
  adminOnly: boolean;
  attachments: string[];
  created: Date;
  // Optional team-feedback context. When set, this note was created via the teams
  // "feedback" flow (commendation / poor performance) rather than a free-form note.
  category?: UserNoteCategory;
  teamId?: ObjectId;
}
