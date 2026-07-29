import { ObjectId } from 'mongodb';

export type Inactivity = {
  _id?: ObjectId;
  groupId: string;
  userId: string;
  request:
  | false
  | {
    approved: boolean;
    reason?: string;
    adminUser?: string;
  };
  active: boolean;
  createdBy?: string;
  starts: Date;
  ends: Date;
  reason: string;
  created: Date;
  // Transient (not persisted): set by the API when `reason` has been masked from a
  // viewer who lacks the activity.viewTimeOffReasons permission.
  reasonHidden?: boolean;
};
