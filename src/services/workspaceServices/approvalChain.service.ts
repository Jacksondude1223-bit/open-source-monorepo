import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { getManagerChain } from '~/services/teamHierarchy.service';
import { getEffectiveTeamMembers } from '~/services/teams.service';
import {
  ApprovalChainConfig,
  ApprovalStepState,
  TeamsSettings,
  Workspace,
} from '~/services/NewMongoTypes';

/**
 * Default Teams configuration applied when a workspace has none saved yet.
 * Defaults preserve the historical single-step behaviour (direct manager only);
 * admins opt into deeper escalation / custom routing from workspace settings.
 */
export const DEFAULT_TEAMS_SETTINGS: TeamsSettings = {
  enabled: true,
  timeOff: { mode: 'hierarchy', hierarchyLevels: 1 },
  expenses: { mode: 'hierarchy', hierarchyLevels: 1 },
  allowMemberExpenseRequests: true,
};

/** Resolves the effective Teams settings for a workspace (filling in defaults). */
export function getTeamsSettings(workspace: Pick<Workspace, 'teamsSettings'>): TeamsSettings {
  const s = workspace.teamsSettings;
  return {
    enabled: s?.enabled !== false,
    timeOff: s?.timeOff ?? DEFAULT_TEAMS_SETTINGS.timeOff,
    expenses: s?.expenses ?? DEFAULT_TEAMS_SETTINGS.expenses,
    allowMemberExpenseRequests: s?.allowMemberExpenseRequests !== false,
  };
}

/** robloxIds of the lead members of a team. */
async function getTeamLeadIds(groupId: string, teamId: string): Promise<string[]> {
  let team;
  try {
    team = await readminCollections.team.findOne({ _id: new ObjectId(teamId), groupId });
  } catch {
    return [];
  }
  if (!team) return [];
  const members = await getEffectiveTeamMembers(groupId, teamId);
  return members
    .filter((m) => team!.roles.find((r) => r.id === m.roleId)?.isLead)
    .map((m) => m.userId);
}

/** Ordered, de-duplicated manager chain (direct manager first, then up). */
async function getOrderedManagers(groupId: string, requesterId: string): Promise<string[]> {
  const chain = await getManagerChain(groupId, requesterId);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const m of chain) {
    if (m.userId === requesterId || seen.has(m.userId)) continue;
    seen.add(m.userId);
    ordered.push(m.userId);
  }
  return ordered;
}

/**
 * Resolves a configured approval chain into concrete, ordered steps for a
 * specific requester at submit time. When no approvers can be resolved the
 * request falls back to a single 'admin' step so workspace admins/approvers
 * can still action it.
 */
export async function buildApprovalChain(
  groupId: string,
  requesterId: string,
  config: ApprovalChainConfig,
  teamNames: Map<string, string>,
): Promise<ApprovalStepState[]> {
  const steps: ApprovalStepState[] = [];

  if (config.mode === 'hierarchy') {
    const managers = await getOrderedManagers(groupId, requesterId);
    const cap =
      config.hierarchyLevels && config.hierarchyLevels > 0
        ? config.hierarchyLevels
        : managers.length;
    for (const managerId of managers.slice(0, cap)) {
      steps.push({
        index: steps.length,
        label: steps.length === 0 ? 'Direct manager' : `Manager (level ${steps.length + 1})`,
        type: 'manager',
        approverIds: [managerId],
        status: 'pending',
      });
    }
  } else {
    const orderedManagers = await getOrderedManagers(groupId, requesterId);
    for (const stepCfg of config.steps ?? []) {
      let approverIds: string[] = [];
      let label = stepCfg.label?.trim() ?? '';

      if (stepCfg.type === 'manager') {
        const lvl = Math.max(1, stepCfg.managerLevel ?? 1);
        const target = orderedManagers[lvl - 1];
        if (target) approverIds = [target];
        if (!label) label = lvl === 1 ? 'Direct manager' : `Manager (level ${lvl})`;
      } else if (stepCfg.type === 'team' && stepCfg.teamId) {
        approverIds = await getTeamLeadIds(groupId, stepCfg.teamId);
        if (!label) label = teamNames.get(stepCfg.teamId) ? `${teamNames.get(stepCfg.teamId)} leads` : 'Team leads';
      } else if (stepCfg.type === 'user' && stepCfg.userId) {
        approverIds = [stepCfg.userId];
        if (!label) label = 'Assigned approver';
      }

      steps.push({
        index: steps.length,
        label: label || 'Approver',
        type: stepCfg.type,
        approverIds,
        status: 'pending',
      });
    }
  }

  if (steps.length === 0) {
    steps.push({
      index: 0,
      label: 'Workspace admin',
      type: 'admin',
      approverIds: [],
      status: 'pending',
    });
  }

  return steps;
}

export type ChainDecisionResult = {
  status: 'pending' | 'approved' | 'denied';
  approvalChain: ApprovalStepState[];
  currentStepIndex: number;
  currentApproverIds: string[];
  reviewedBy?: string;
  reviewedAt?: Date;
};

/**
 * Pure helper: applies an approve/deny decision to the active step of a
 * request's chain and returns the new persisted state. Denial stops the chain;
 * approval advances to the next step (or finalizes on the last step). Requests
 * without a chain (legacy) are finalized in a single decision.
 */
export function applyChainDecision(
  request: { approvalChain?: ApprovalStepState[]; currentStepIndex?: number },
  decidedBy: string,
  decision: 'approved' | 'denied',
  note?: string,
): ChainDecisionResult {
  const now = new Date();
  const chain = (request.approvalChain ?? []).map((s) => ({ ...s }));
  const idx = request.currentStepIndex ?? 0;

  if (chain.length === 0) {
    return {
      status: decision,
      approvalChain: chain,
      currentStepIndex: idx,
      currentApproverIds: [],
      reviewedBy: decidedBy,
      reviewedAt: now,
    };
  }

  const step = chain[idx];
  if (step) {
    step.status = decision;
    step.decidedBy = decidedBy;
    step.decidedAt = now;
    step.note = note;
  }

  if (decision === 'denied') {
    return {
      status: 'denied',
      approvalChain: chain,
      currentStepIndex: idx,
      currentApproverIds: [],
      reviewedBy: decidedBy,
      reviewedAt: now,
    };
  }

  const nextIdx = idx + 1;
  if (nextIdx >= chain.length) {
    return {
      status: 'approved',
      approvalChain: chain,
      currentStepIndex: idx,
      currentApproverIds: [],
      reviewedBy: decidedBy,
      reviewedAt: now,
    };
  }

  return {
    status: 'pending',
    approvalChain: chain,
    currentStepIndex: nextIdx,
    currentApproverIds: chain[nextIdx]?.approverIds ?? [],
  };
}

/**
 * Whether `userId` may currently action a request. Admins/approvers can act on
 * any step; otherwise the user must be listed on the active step's approvers, or
 * (for legacy chain-less requests) manage the request's team.
 */
export function canActionRequest(
  request: { approvalChain?: ApprovalStepState[]; currentStepIndex?: number; teamId: ObjectId },
  userId: string,
  isAdminOrApprover: boolean,
  managedTeamIds: string[],
): boolean {
  if (isAdminOrApprover) return true;
  const chain = request.approvalChain;
  if (chain && chain.length > 0) {
    const cur = chain[request.currentStepIndex ?? 0];
    return (cur?.approverIds ?? []).includes(userId);
  }
  return managedTeamIds.includes(request.teamId.toString());
}

/**
 * Whether `userId` may comment on a request: the requester, anyone listed on any
 * step of the chain, an admin/approver, or (legacy) a manager of the team.
 */
export function canCommentOnRequest(
  request: { userId: string; approvalChain?: ApprovalStepState[]; teamId: ObjectId },
  userId: string,
  isAdminOrApprover: boolean,
  managedTeamIds: string[],
): boolean {
  if (isAdminOrApprover) return true;
  if (request.userId === userId) return true;
  const chain = request.approvalChain;
  if (chain && chain.length > 0) {
    return chain.some((s) => (s.approverIds ?? []).includes(userId));
  }
  return managedTeamIds.includes(request.teamId.toString());
}
