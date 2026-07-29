import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import {
  TimeOffRequest,
  ExpenseRequest,
  ExpenseCategory,
  ApprovalStepState,
  RequestComment,
} from '~/services/NewMongoTypes';
import { applyChainDecision } from '~/services/workspaceServices/approvalChain.service';

// ── Time Off ───────────────────────────────────────────────────────────────────

export async function submitTimeOffRequest(
  groupId: string,
  teamId: string,
  userId: string,
  data: { reason: string; starts: Date; ends: Date },
  approvalChain: ApprovalStepState[],
): Promise<TimeOffRequest> {
  const request: TimeOffRequest = {
    groupId,
    teamId: new ObjectId(teamId),
    userId,
    reason: data.reason,
    starts: data.starts,
    ends: data.ends,
    status: 'pending',
    approvalChain,
    currentStepIndex: 0,
    currentApproverIds: approvalChain[0]?.approverIds ?? [],
    comments: [],
    created: new Date(),
  };
  const result = await readminCollections.time_off_request.insertOne(request as any);
  return { ...request, _id: result.insertedId };
}

export async function reviewTimeOffRequest(
  groupId: string,
  request: TimeOffRequest,
  reviewedBy: string,
  decision: 'approved' | 'denied',
  reviewNote?: string,
): Promise<void> {
  const update = applyChainDecision(request, reviewedBy, decision, reviewNote);
  await readminCollections.time_off_request.updateOne(
    { _id: request._id, groupId },
    {
      $set: {
        status: update.status,
        approvalChain: update.approvalChain,
        currentStepIndex: update.currentStepIndex,
        currentApproverIds: update.currentApproverIds,
        reviewedBy: update.reviewedBy ?? request.reviewedBy,
        reviewedAt: update.reviewedAt ?? request.reviewedAt,
        reviewNote: reviewNote ?? request.reviewNote,
      },
    },
  );
}

export async function addTimeOffComment(
  groupId: string,
  requestId: string,
  comment: RequestComment,
): Promise<void> {
  await readminCollections.time_off_request.updateOne(
    { _id: new ObjectId(requestId), groupId },
    { $push: { comments: comment } } as any,
  );
}

export async function getTimeOffRequestById(
  groupId: string,
  requestId: string,
): Promise<TimeOffRequest | null> {
  return readminCollections.time_off_request.findOne({
    _id: new ObjectId(requestId),
    groupId,
  });
}

export async function getTimeOffRequestsForUser(
  groupId: string,
  userId: string,
): Promise<TimeOffRequest[]> {
  return readminCollections.time_off_request
    .find({ groupId, userId })
    .sort({ created: -1 })
    .toArray();
}

export async function getPendingTimeOffForTeams(
  groupId: string,
  teamIds: string[],
): Promise<TimeOffRequest[]> {
  return readminCollections.time_off_request
    .find({ groupId, teamId: { $in: teamIds.map((id) => new ObjectId(id)) }, status: 'pending' })
    .sort({ created: 1 })
    .toArray();
}

export async function getAllPendingTimeOff(groupId: string): Promise<TimeOffRequest[]> {
  return readminCollections.time_off_request
    .find({ groupId, status: 'pending' })
    .sort({ created: 1 })
    .toArray();
}

/**
 * Pending time-off the given user can act on: requests whose active step lists
 * them as an approver, plus legacy (chain-less) requests for teams they manage.
 */
export async function getPendingTimeOffForApprover(
  groupId: string,
  userId: string,
  managedTeamIds: string[],
): Promise<TimeOffRequest[]> {
  return readminCollections.time_off_request
    .find({
      groupId,
      status: 'pending',
      $or: [
        { currentApproverIds: userId },
        {
          approvalChain: { $exists: false },
          teamId: { $in: managedTeamIds.map((id) => new ObjectId(id)) },
        },
      ],
    })
    .sort({ created: 1 })
    .toArray();
}

// ── Expenses ───────────────────────────────────────────────────────────────────

export async function submitExpenseRequest(
  groupId: string,
  teamId: string,
  userId: string,
  data: {
    category: ExpenseCategory;
    amount: number;
    title: string;
    description: string;
    attachments: string[];
  },
  approvalChain: ApprovalStepState[],
): Promise<ExpenseRequest> {
  const request: ExpenseRequest = {
    groupId,
    teamId: new ObjectId(teamId),
    userId,
    category: data.category,
    amount: data.amount,
    title: data.title,
    description: data.description,
    attachments: data.attachments,
    status: 'pending',
    approvalChain,
    currentStepIndex: 0,
    currentApproverIds: approvalChain[0]?.approverIds ?? [],
    comments: [],
    created: new Date(),
  };
  const result = await readminCollections.expense_request.insertOne(request as any);
  return { ...request, _id: result.insertedId };
}

export async function reviewExpenseRequest(
  groupId: string,
  request: ExpenseRequest,
  reviewedBy: string,
  decision: 'approved' | 'denied',
  reviewNote?: string,
): Promise<void> {
  const update = applyChainDecision(request, reviewedBy, decision, reviewNote);
  await readminCollections.expense_request.updateOne(
    { _id: request._id, groupId },
    {
      $set: {
        status: update.status,
        approvalChain: update.approvalChain,
        currentStepIndex: update.currentStepIndex,
        currentApproverIds: update.currentApproverIds,
        reviewedBy: update.reviewedBy ?? request.reviewedBy,
        reviewedAt: update.reviewedAt ?? request.reviewedAt,
        reviewNote: reviewNote ?? request.reviewNote,
      },
    },
  );
}

export async function addExpenseComment(
  groupId: string,
  requestId: string,
  comment: RequestComment,
): Promise<void> {
  await readminCollections.expense_request.updateOne(
    { _id: new ObjectId(requestId), groupId },
    { $push: { comments: comment } } as any,
  );
}

export async function getExpenseRequestById(
  groupId: string,
  requestId: string,
): Promise<ExpenseRequest | null> {
  return readminCollections.expense_request.findOne({
    _id: new ObjectId(requestId),
    groupId,
  });
}

export async function getExpenseRequestsForUser(
  groupId: string,
  userId: string,
): Promise<ExpenseRequest[]> {
  return readminCollections.expense_request
    .find({ groupId, userId })
    .sort({ created: -1 })
    .toArray();
}

export async function getPendingExpensesForTeams(
  groupId: string,
  teamIds: string[],
): Promise<ExpenseRequest[]> {
  return readminCollections.expense_request
    .find({ groupId, teamId: { $in: teamIds.map((id) => new ObjectId(id)) }, status: 'pending' })
    .sort({ created: 1 })
    .toArray();
}

export async function getAllPendingExpenses(groupId: string): Promise<ExpenseRequest[]> {
  return readminCollections.expense_request
    .find({ groupId, status: 'pending' })
    .sort({ created: 1 })
    .toArray();
}

/**
 * Pending expenses the given user can act on: requests whose active step lists
 * them as an approver, plus legacy (chain-less) requests for teams they manage.
 */
export async function getPendingExpensesForApprover(
  groupId: string,
  userId: string,
  managedTeamIds: string[],
): Promise<ExpenseRequest[]> {
  return readminCollections.expense_request
    .find({
      groupId,
      status: 'pending',
      $or: [
        { currentApproverIds: userId },
        {
          approvalChain: { $exists: false },
          teamId: { $in: managedTeamIds.map((id) => new ObjectId(id)) },
        },
      ],
    })
    .sort({ created: 1 })
    .toArray();
}
