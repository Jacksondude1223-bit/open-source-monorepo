import { ObjectId } from 'mongodb';

import { ApprovalStepState, RequestComment } from './ApprovalWorkflow.type';

export type TimeOffStatus = 'pending' | 'approved' | 'denied';

export type TimeOffRequest = {
  _id?: ObjectId;
  groupId: string;
  teamId: ObjectId;
  userId: string; // robloxId of the requester
  reason: string;
  starts: Date;
  ends: Date;
  status: TimeOffStatus;
  reviewedBy?: string; // robloxId of the final approver/denier
  reviewNote?: string;
  reviewedAt?: Date;
  // Multi-step approval routing (snapshot taken at submit time). Absent on
  // legacy requests created before configurable routing existed.
  approvalChain?: ApprovalStepState[];
  currentStepIndex?: number; // index of the active pending step
  currentApproverIds?: string[]; // denormalized approverIds of the active step (fast queries)
  comments?: RequestComment[];
  created: Date;
};
