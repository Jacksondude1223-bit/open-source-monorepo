/**
 * Configurable, multi-step approval routing for the Teams feature
 * (time-off and expense requests). Lives on the workspace so the website is the
 * single source of truth, mirroring afkReportingSettings / timeclockSettings.
 */

/** What kind of approver a configured chain step targets. */
export type ApprovalStepType =
  | 'manager' // the requester's manager `managerLevel` steps up their chain (1 = direct manager)
  | 'team' // any lead of the team `teamId`
  | 'user'; // the specific `userId`

/** A configured step in an approval chain (stored in workspace settings). */
export type ApprovalStepConfig = {
  id: string; // uuid, stable react key
  type: ApprovalStepType;
  managerLevel?: number; // for 'manager'; 1 = direct manager, 2 = their manager, ...
  teamId?: string; // for 'team'
  userId?: string; // for 'user' (robloxId)
  label?: string; // optional human label override
};

/** How a request type (time off / expenses) is routed for approval. */
export type ApprovalChainConfig = {
  // 'hierarchy' = walk up the requester's manager chain, each level approves in turn.
  //   `hierarchyLevels` caps the number of levels (undefined/0 = all the way up).
  // 'custom'    = use the explicit ordered `steps` (can skip the direct manager,
  //   route to a whole other team, a specific user, etc.).
  mode: 'hierarchy' | 'custom';
  hierarchyLevels?: number;
  steps?: ApprovalStepConfig[];
};

/** Per-workspace Teams feature configuration. */
export type TeamsSettings = {
  enabled: boolean; // master on/off — hides Teams from nav + user profile when false
  timeOff: ApprovalChainConfig; // routing for time-off requests
  expenses: ApprovalChainConfig; // routing for expense requests
  // When false, only managers/approvers/admins can submit expense requests; the
  // "Request Expense" action is hidden from regular members. Defaults to true.
  allowMemberExpenseRequests?: boolean;
};

// ── Per-request runtime state (snapshot taken when a request is submitted) ──────

export type ApprovalStepDecision = 'pending' | 'approved' | 'denied' | 'skipped';

/** A resolved step on an individual request. */
export type ApprovalStepState = {
  index: number;
  label: string; // resolved human label, e.g. "Direct manager", "Finance leads"
  type: ApprovalStepType | 'admin'; // 'admin' = fell back to workspace admins/approvers
  approverIds: string[]; // robloxIds eligible to act (any one). Empty = admins/approvers only.
  status: ApprovalStepDecision;
  decidedBy?: string; // robloxId who approved/denied this step
  decidedAt?: Date;
  note?: string;
};

/** A free-form comment on a request (e.g. how funds were disbursed). */
export type RequestComment = {
  id: string;
  userId: string; // robloxId of the commenter
  text: string;
  created: Date;
};
