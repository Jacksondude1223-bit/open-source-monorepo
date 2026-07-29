import { ObjectId } from 'mongodb';

export type FeedbackType =
  | 'commendation'
  | 'poor_performance'
  | 'strike'
  | 'demotion_recommendation';

export type TeamFeedback = {
  _id?: ObjectId;
  groupId: string;
  teamId: ObjectId;
  fromUserId: string; // robloxId — manager submitting feedback
  toUserId: string; // robloxId — staff member receiving feedback
  type: FeedbackType;
  note: string;
  created: Date;
};
