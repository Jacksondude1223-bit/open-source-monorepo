import { ObjectId } from 'mongodb';

import { ApprovalStepState, RequestComment } from './ApprovalWorkflow.type';

export type ExpenseCategory = 'robux' | 'budget' | 'general';

export type ExpenseStatus = 'pending' | 'approved' | 'denied';

export type ExpenseRequest = {
  _id?: ObjectId;
  groupId: string;
  teamId: ObjectId;
  userId: string; // robloxId of the requester
  category: ExpenseCategory;
  amount: number; // Robux units or budget dollar amount
  title: string;
  description: string;
  attachments: string[]; // CDN paths for supporting documents / screenshots
  status: ExpenseStatus;
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
