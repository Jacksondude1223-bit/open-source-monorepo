import { ObjectId } from 'mongodb';

export type CancellationReason =
  | 'switched_to_competitor'
  | 'too_expensive'
  | 'group_inactive'
  | 'setup_confusing'
  | 'didnt_understand_value'
  | 'missing_feature'
  | 'bugs_reliability'
  | 'support_issue'
  | 'other';

export type CancellationFeedback = {
  _id?: ObjectId;
  groupId: string;
  groupName?: string;
  robloxId: string; // robloxId of the user who cancelled
  reason: CancellationReason;
  details?: string; // optional freeform context
  created: Date;
};
