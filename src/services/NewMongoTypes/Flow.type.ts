import { ObjectId } from 'mongodb';

// ─────────────────────────────────────────────────────────────────────────────
// Flows — workspace automation engine
//
// A Flow is a single sentence:
//   WHEN <trigger> -> IF <filters> -> (once it happens N times in a window via
//   <accumulator>) -> DO <actions> TO <subject>.
//
// These types are shared between the engine (src/services/flows), the tRPC
// router and the builder UI. Keep them serialisable (no class instances).
// ─────────────────────────────────────────────────────────────────────────────

/** Every event type the engine understands. Producers emit one of these. */
export type FlowTriggerType =
  // ReAdmin — discipline & rank
  | 'writeup.created'
  | 'promotionRequest.created'
  | 'promotionRequest.accepted'
  | 'promotionRequest.declined'
  | 'promotionRequest.voted'
  | 'member.joined'
  | 'member.left'
  | 'member.promoted'
  | 'member.demoted'
  // A member can hold several Roblox roles, so gaining or losing one is not
  // necessarily a promotion or demotion — those two still mean the member's
  // HIGHEST rank moved.
  | 'member.roleAdded'
  | 'member.roleRemoved'
  // Activity & distribution
  | 'distribution.started'
  | 'distribution.evaluated'
  | 'goal.met'
  // Time based (no event — the scheduler is the trigger)
  | 'schedule';

/** Action verbs the executor can perform. */
export type FlowActionType =
  | 'discord.webhook'
  | 'discord.dm'
  | 'discord.channel'
  | 'user.addNote'
  | 'user.addTag'
  | 'user.removeTag'
  | 'task.create'
  | 'feed.post'
  | 'discipline.create'
  | 'rank.set'
  | 'promotionRequest.resolve'
  | 'game.queueAction';

// ── Conditions ───────────────────────────────────────────────────────────────

export type FlowConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'matchesRegex'
  | 'isEmpty'
  | 'isNotEmpty';

/**
 * A single condition. `field` is a dotted path resolved against the evaluation
 * context, e.g. `event.writeUp.type`, `subject.tenureDays`, `actor.rank`.
 */
export type FlowCondition = {
  id: string;
  field: string;
  operator: FlowConditionOperator;
  /** Compared against the resolved field. Unused for isEmpty/isNotEmpty. */
  value?: string | number | boolean | Array<string | number>;
};

/** Boolean tree of conditions. AND/OR over leaves and nested groups. */
export type FlowConditionGroup = {
  combinator: 'and' | 'or';
  conditions: FlowCondition[];
  groups?: FlowConditionGroup[];
};

// ── Accumulator (the "how many times" differentiator) ────────────────────────

export type FlowAccumulatorWindowKind =
  | 'rolling'
  | 'calendar'
  | 'sinceReset'
  | 'lastNDistributions';
export type FlowAccumulatorWindowUnit = 'hour' | 'day' | 'week' | 'month';

/** Which entity each independent counter is keyed by. */
export type FlowAccumulatorCountBy =
  | 'subjectUser'
  | 'actor'
  | 'game'
  | 'team'
  | 'global';

export type FlowAccumulator = {
  countBy: FlowAccumulatorCountBy;
  threshold: number;
  window: {
    kind: FlowAccumulatorWindowKind;
    /**
     * Length of a rolling window, or the number of distributions to look back
     * over when kind is 'lastNDistributions'. Ignored for calendar/sinceReset.
     */
    value: number;
    unit: FlowAccumulatorWindowUnit;
  };
  /** resetOnFire zeros the counter after firing; continuous keeps counting. */
  rearm: 'resetOnFire' | 'continuous';
  /**
   * Escalation mode. When true the flow fires on *every* increment instead of
   * only at the threshold, and each action's `tier` decides which step it runs
   * on (e.g. 1st miss -> warn, 2nd -> suspend, 3rd -> terminate). The threshold
   * is treated as the final step; resetOnFire clears the count once the highest
   * tier is reached.
   */
  escalate?: boolean;
};

// ── Subject ──────────────────────────────────────────────────────────────────

/** Who/what the actions operate on. Defaults to the event's subject user. */
export type FlowSubjectSource =
  | 'eventSubject'
  | 'eventActor'
  | 'eventTeam'
  | 'eventGame';

// ── Actions ──────────────────────────────────────────────────────────────────

export type FlowAction = {
  id: string;
  type: FlowActionType;
  /** Free-form, per-action configuration. Shape depends on `type`. */
  config: Record<string, any>;
  /** Optional per-action gate; the action only runs when this passes. */
  runIf?: FlowConditionGroup;
  /**
   * Escalation step. Only used when the accumulator runs in `escalate` mode:
   * the action runs when the running count reaches exactly this number
   * (1 = first time, 2 = second time, ...). Leave unset/null to run on every
   * step (e.g. a "log every miss" action).
   */
  tier?: number | null;
  /**
   * When true, the action is not executed automatically. Instead the flow
   * parks a `flow_approval` request and a human must approve it before the
   * action runs. Useful for high-stakes actions (terminations, rank changes).
   */
  requireApproval?: boolean;
};

// ── Trigger ──────────────────────────────────────────────────────────────────

export type FlowTrigger = {
  type: FlowTriggerType;
  /** Trigger-specific config (e.g. schedule cron, watched channel). */
  config?: Record<string, any>;
};

// ── Flow definition ──────────────────────────────────────────────────────────

export type Flow = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  description?: string;
  enabled: boolean;
  /** When true, actions are simulated and logged but never executed. */
  dryRun: boolean;

  trigger: FlowTrigger;
  filters?: FlowConditionGroup;
  accumulator?: FlowAccumulator | null;
  subjectSource: FlowSubjectSource;
  actions: FlowAction[];

  /**
   * The user the flow acts "as". Caps what the flow can do — it can never
   * perform an action this user couldn't perform manually.
   */
  ownerUserId: string;

  /** Safety: max fires per hour before the flow auto-pauses. */
  maxFiresPerHour: number;
  /** Set when the circuit breaker trips; surfaced in the UI. */
  pausedReason?: string | null;

  // Stats
  fireCount: number;
  lastFiredAt?: Date | null;

  createdBy: string; // roblox id
  created: Date;
  updated: Date;
};

// ── Accumulator state ────────────────────────────────────────────────────────

export type FlowCounter = {
  _id?: ObjectId;
  flowId: ObjectId;
  groupId: string;
  /** Counter key — derived from accumulator.countBy (e.g. the subject id). */
  key: string;
  /** Recent qualifying events inside the window. */
  events: { at: Date; refId?: string; seq?: number }[];
  firedAt?: Date | null;
  updated: Date;
};

// ── Execution log ────────────────────────────────────────────────────────────

export type FlowRunActionResult = {
  actionId: string;
  type: FlowActionType;
  status:
    | 'success'
    | 'skipped'
    | 'failed'
    | 'simulated'
    | 'pendingApproval';
  message: string;
};

export type FlowRun = {
  _id?: ObjectId;
  flowId: ObjectId;
  groupId: string;
  trigger: FlowTriggerType;
  status:
    | 'fired'
    | 'filtered'
    | 'accumulating'
    | 'failed'
    | 'simulated'
    | 'pendingApproval';
  /** Resolved subject the actions targeted. */
  subjectId?: string;
  actorId?: string;
  /** Idempotency key — prevents double-processing a redelivered event. */
  dedupeKey?: string;
  results: FlowRunActionResult[];
  /** Snapshot of the context for debugging the timeline. */
  contextSnapshot?: Record<string, any>;
  message?: string;
  created: Date;
};

// ── Approval gate ────────────────────────────────────────────────────────────

/** A parked, human-approved action set produced by an approval-gated flow. */
export type FlowApproval = {
  _id?: ObjectId;
  flowId: ObjectId;
  groupId: string;
  flowName: string;
  trigger: FlowTriggerType;
  /** Subject the held actions will operate on once approved. */
  subjectId?: string;
  actorId?: string;
  /** Rendered (templated) actions waiting on approval. */
  actions: {
    actionId: string;
    type: FlowActionType;
    config: Record<string, any>;
    destructive?: boolean;
  }[];
  /** Human-readable summary lines for the approver. */
  summary: string[];
  contextSnapshot?: Record<string, any>;
  status: 'pending' | 'approved' | 'denied';
  decidedBy?: string | null;
  decidedAt?: Date | null;
  note?: string | null;
  created: Date;
};
