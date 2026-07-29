import { ObjectId } from 'mongodb';
import { v4 } from 'uuid';
import { readminCollections } from '~/services/mongo.service';
import {
  Flow,
  FlowAccumulator,
  FlowActionType,
  FlowCounter,
  FlowRun,
  FlowRunActionResult,
  FlowSubjectSource,
  FlowTriggerType,
} from '~/services/NewMongoTypes/Flow.type';
import {
  evaluateConditionGroup,
  FlowContext,
  renderConfig,
} from './conditions';
import { DESTRUCTIVE_ACTIONS, getActionDefinition } from './registry';
import { getProcessedUserObject } from '~/services/roblox.service';
import { getDepartmentForUserId } from '~/services/workspaces.service';
import { sendWebhookMessage, dmUserDiscord, sendGuildTextMessage, EmebedColors } from '~/services/discord.service';
import { createHistory } from '~/services/workspaceServices/staffHistory';
import { rankUser } from '~/services/group-actions.service';
import { memberRoleIds } from '~/services/groupMember.helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Flow engine — receives events from producers, evaluates matching flows and
// executes their actions.
//
// Producers call `emitFlowEvent(...)`. It is fire-and-forget and must never throw
// into the caller: a broken flow can never break the mutation that triggered it.
// This keeps user-facing requests fast and the engine decoupled. A dedicated
// queue worker can be layered on later without changing call sites.
// ─────────────────────────────────────────────────────────────────────────────

export type EmitFlowEventArgs = {
  groupId: string;
  type: FlowTriggerType;
  /** The user the event is about (the default subject). */
  subjectUserId?: string;
  /** Who caused the event, if applicable. */
  actorUserId?: string;
  /** Optional related entity ids for subject redirection. */
  teamId?: string;
  gameId?: string;
  /** Arbitrary event payload addressable via `event.*` in conditions/templates. */
  event?: Record<string, any>;
  /** Stable id for dedupe (e.g. the write-up _id). */
  refId?: string;
};

type EngineUserSummary = {
  userId: string;
  displayName: string;
  rank: number;
  tenureDays: number;
  /** Ids of every department this user belongs to (direct or via their role). */
  departments: string[];
};

async function resolveUserSummary(
  groupId: string,
  userId?: string,
): Promise<EngineUserSummary | null> {
  if (!userId) return null;
  try {
    const [profile, member] = await Promise.all([
      getProcessedUserObject(Number(userId)).catch(() => null),
      readminCollections.group_member.findOne({
        groupId,
        userId: parseInt(userId),
      }),
    ]);
    // The role lookup and department resolution both depend only on
    // member.roleId and are otherwise independent, so run them together.
    const [role, departments] = await Promise.all([
      member
        ? readminCollections.group_role.findOne({
            groupId,
            id: member.roleId,
          })
        : Promise.resolve(null),
      resolveUserDepartments(groupId, userId, member ? memberRoleIds(member) : []),
    ]);
    let tenureDays = 0;
    const joinDate = (member as any)?.joinDate || (member as any)?.created;
    if (joinDate) {
      tenureDays = Math.floor(
        (Date.now() - new Date(joinDate).getTime()) / 86400000,
      );
    }
    return {
      userId,
      displayName:
        (profile as any)?.displayName || (profile as any)?.name || userId,
      rank: role?.rank ?? 0,
      tenureDays,
      departments,
    };
  } catch {
    return { userId, displayName: userId, rank: 0, tenureDays: 0, departments: [] };
  }
}

/** All department ids a user belongs to — directly assigned or via any of their roles. */
async function resolveUserDepartments(
  groupId: string,
  userId: string,
  roleIds: number[] = [],
): Promise<string[]> {
  try {
    const [directs, roleDepts] = await Promise.all([
      readminCollections.department_users.find({ groupId, userId }).toArray(),
      roleIds.length > 0
        ? readminCollections.department_role.find({ groupId, roleId: { $in: roleIds } }).toArray()
        : Promise.resolve([]),
    ]);
    const ids = new Set<string>();
    for (const d of directs) ids.add(d.departmentId.toString());
    for (const r of roleDepts) ids.add(r.departmentId.toString());
    return [...ids];
  } catch {
    return [];
  }
}

/** Builds the full evaluation context for a flow given an inbound event. */
async function buildContext(
  flow: Flow,
  args: EmitFlowEventArgs,
): Promise<FlowContext> {
  const [subject, actor] = await Promise.all([
    resolveUserSummary(args.groupId, args.subjectUserId),
    resolveUserSummary(args.groupId, args.actorUserId),
  ]);
  // Derive convenience flags for distribution evaluations so builders can use a
  // single condition for "missed requirements (while|without) time off" instead
  // of combining two separate fields.
  const event: Record<string, any> = { ...(args.event || {}) };
  if (args.type === 'distribution.evaluated') {
    const failed = event.failedAny === true || event.metAll === false;
    const onTimeOff = event.onTimeOff === true;
    event.failedWhileOnTimeOff = failed && onTimeOff;
    event.failedWithoutTimeOff = failed && !onTimeOff;
  }
  return {
    event,
    subject: subject || {},
    actor: actor || {},
    team: { id: args.teamId },
    game: { id: args.gameId },
    flow: { name: flow.name, id: flow._id?.toString() },
    accumulator: { count: 0 },
  };
}

/** Resolve which id the flow's actions operate on. */
function resolveSubjectId(
  source: FlowSubjectSource,
  args: EmitFlowEventArgs,
): string | undefined {
  switch (source) {
    case 'eventActor':
      return args.actorUserId;
    case 'eventTeam':
      return args.teamId;
    case 'eventGame':
      return args.gameId;
    case 'eventSubject':
    default:
      return args.subjectUserId;
  }
}

function accumulatorKey(
  acc: FlowAccumulator,
  args: EmitFlowEventArgs,
): string {
  switch (acc.countBy) {
    case 'actor':
      return `actor:${args.actorUserId || 'unknown'}`;
    case 'game':
      return `game:${args.gameId || 'unknown'}`;
    case 'team':
      return `team:${args.teamId || 'unknown'}`;
    case 'global':
      return 'global';
    case 'subjectUser':
    default:
      return `subject:${args.subjectUserId || 'unknown'}`;
  }
}

/** Returns the start of the window: events older than this are pruned. */
function windowStart(acc: FlowAccumulator): Date {
  const now = new Date();
  if (acc.window.kind === 'calendar') {
    const d = new Date(now);
    switch (acc.window.unit) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week': {
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        break;
      }
      case 'month':
        d.setHours(0, 0, 0, 0);
        d.setDate(1);
        break;
    }
    return d;
  }
  if (acc.window.kind === 'sinceReset') {
    return new Date(0); // never prune; reset clears the counter explicitly
  }
  // rolling
  const ms =
    { hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 }[
      acc.window.unit
    ] * acc.window.value;
  return new Date(now.getTime() - ms);
}

/**
 * Counts qualifying events. Events tagged with a distribution number (`seq`)
 * are counted once per distribution so two failed goals in the same period
 * count as a single missed distribution; untagged events count individually.
 */
function countEvents(events: { seq?: number }[]): number {
  const seqs = new Set<number>();
  let untagged = 0;
  for (const e of events) {
    if (typeof e.seq === 'number') seqs.add(e.seq);
    else untagged++;
  }
  return seqs.size + untagged;
}

/** Highest escalation step referenced by the flow's actions. */
function maxTier(flow: Flow): number {
  let max = 0;
  for (const a of flow.actions) {
    const t = Number(a.tier);
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max;
}

/**
 * Processes the accumulator for a qualifying event. Returns true if the
 * threshold has been reached (and the flow should fire) and sets the resolved
 * count on the context.
 */
async function processAccumulator(
  flow: Flow,
  acc: FlowAccumulator,
  args: EmitFlowEventArgs,
  context: FlowContext,
): Promise<boolean> {
  const key = accumulatorKey(acc, args);
  const now = new Date();
  const rawSeq = args.event?.distribution;
  const currentSeq =
    rawSeq !== undefined && rawSeq !== null && Number.isFinite(Number(rawSeq))
      ? Number(rawSeq)
      : undefined;

  const existing = await readminCollections.flow_counter.findOne({
    flowId: flow._id!,
    key,
  });

  // Prune events outside the window.
  let prior: { at: Date; refId?: string; seq?: number }[];
  if (acc.window.kind === 'lastNDistributions') {
    if (currentSeq !== undefined) {
      const minSeq = currentSeq - (acc.window.value - 1);
      prior = (existing?.events || []).filter(
        (e) => typeof e.seq === 'number' && e.seq >= minSeq,
      );
    } else {
      prior = existing?.events || [];
    }
  } else {
    const start = windowStart(acc);
    prior = (existing?.events || []).filter((e) => new Date(e.at) >= start);
  }
  prior.push({ at: now, refId: args.refId, seq: currentSeq });

  const count = countEvents(prior);
  context.accumulator = { count, threshold: acc.threshold };

  // Decide whether to fire and whether to reset.
  let reached: boolean;
  let shouldReset: boolean;
  if (acc.escalate) {
    // Escalation: fire on every step; action-level tiers gate what runs.
    reached = true;
    const top = maxTier(flow) || acc.threshold;
    shouldReset = acc.rearm === 'resetOnFire' && count >= top;
  } else {
    reached = count >= acc.threshold;
    shouldReset = reached && acc.rearm === 'resetOnFire';
  }

  await readminCollections.flow_counter.updateOne(
    { flowId: flow._id!, key },
    {
      $set: {
        flowId: flow._id!,
        groupId: flow.groupId,
        key,
        events: shouldReset ? [] : prior,
        updated: now,
        ...(reached ? { firedAt: now } : {}),
        ...(shouldReset ? { firedAt: now } : {}),
      },
    },
    { upsert: true },
  );

  return reached;
}

// ── Permission ceiling ───────────────────────────────────────────────────────

/**
 * A flow can never perform an action its owner couldn't perform manually.
 * Re-checked live at execution time so demoting the owner removes the power.
 */
async function ownerCanPerform(
  flow: Flow,
  actionType: FlowActionType,
): Promise<boolean> {
  if (!DESTRUCTIVE_ACTIONS.has(actionType)) return true;
  const dept = await getDepartmentForUserId(flow.ownerUserId, flow.groupId);
  if (!dept) return false;
  const p = dept.permissions;
  if (p.admin) return true;
  switch (actionType) {
    case 'discipline.create':
      return Boolean(
        p.writeUps?.writeUps ||
          p.writeUps?.suspensions ||
          p.writeUps?.terminations ||
          p.writeUps?.demote,
      );
    case 'rank.set':
      return Boolean(p.writeUps?.promote || p.writeUps?.demote || p.activity?.ranking);
    case 'promotionRequest.resolve':
      return Boolean(p.promotionRequests?.manage);
    case 'game.queueAction':
      return Boolean(p.games?.admin || p.games?.manageBans);
    default:
      return false;
  }
}

// ── Action execution ─────────────────────────────────────────────────────────

async function executeAction(
  flow: Flow,
  actionType: FlowActionType,
  config: Record<string, any>,
  subjectId: string | undefined,
): Promise<{ status: FlowRunActionResult['status']; message: string }> {
  const ok = (message: string) => ({ status: 'success' as const, message });
  const skip = (message: string) => ({ status: 'skipped' as const, message });
  const fail = (message: string) => ({ status: 'failed' as const, message });

  if (DESTRUCTIVE_ACTIONS.has(actionType)) {
    const allowed = await ownerCanPerform(flow, actionType);
    if (!allowed) {
      return skip(
        `Owner lacks permission for ${actionType}; action skipped (permission ceiling).`,
      );
    }
  }

  switch (actionType) {
    case 'discord.webhook': {
      if (!config.webhookUrl) return fail('No webhook URL configured.');
      await sendWebhookMessage(
        config.webhookUrl,
        (config.color || 'blue') as any,
        config.title || 'Flow',
        config.message || '',
      );
      return ok('Discord message sent.');
    }
    case 'discord.dm': {
      if (!subjectId) return skip('No subject user to DM.');
      await dmUserDiscord(
        subjectId,
        config.title || `Flow: ${flow.name}`,
        config.message || '',
        (config.color || 'blue') as any,
      );
      return ok('Discord DM sent (if the user has linked Discord).');
    }
    case 'discord.channel': {
      if (!config.channelId) return fail('No channel configured.');
      const bot = await readminCollections.discord_bots.findOne({
        groupId: flow.groupId,
      });
      if (!bot?.guildId)
        return skip('No Discord server is linked to this workspace.');
      const color =
        EmebedColors[(config.color || 'blue') as keyof typeof EmebedColors] ??
        EmebedColors.blue;
      await sendGuildTextMessage(config.channelId, {
        embeds: [
          {
            title: config.title || `Flow: ${flow.name}`,
            description: config.message || '',
            color,
          },
        ],
      });
      return ok('Discord channel message sent.');
    }
    case 'user.addNote': {
      if (!subjectId) return skip('No subject user to add a note to.');
      await readminCollections.user_note.insertOne({
        groupId: flow.groupId,
        userId: subjectId,
        authorId: flow.ownerUserId,
        note: config.note || `Added by flow: ${flow.name}`,
        adminOnly: false,
        attachments: [],
        created: new Date(),
      });
      return ok('Note added.');
    }
    case 'user.addTag': {
      if (!subjectId) return skip('No subject user to tag.');
      if (!config.tagId) return fail('No tag configured.');
      const exists = await readminCollections.workspace_tag_member.findOne({
        groupId: flow.groupId,
        userId: subjectId,
        tagId: config.tagId,
      });
      if (exists) return skip('User already has the tag.');
      await readminCollections.workspace_tag_member.insertOne({
        groupId: flow.groupId,
        userId: subjectId,
        tagId: config.tagId,
        created: new Date(),
      });
      return ok('Tag added.');
    }
    case 'user.removeTag': {
      if (!subjectId) return skip('No subject user to untag.');
      if (!config.tagId) return fail('No tag configured.');
      const res = await readminCollections.workspace_tag_member.deleteOne({
        groupId: flow.groupId,
        userId: subjectId,
        tagId: config.tagId,
      });
      return res.deletedCount
        ? ok('Tag removed.')
        : skip('User did not have the tag.');
    }
    case 'task.create': {
      const board = await readminCollections.task_board.findOne({
        groupId: flow.groupId,
      });
      const categoryId = board?.categories?.[0]?.id;
      if (!categoryId)
        return skip('No task board/category exists yet; create one first.');
      const now = new Date();
      await readminCollections.task.insertOne({
        groupId: flow.groupId,
        categoryId,
        title: config.title || `Flow: ${flow.name}`,
        description: config.description || '',
        priority: (config.priority || 'none') as any,
        dueBy: null,
        assignedUsers: subjectId ? [subjectId] : [],
        assignedDepartments: [],
        notes: [],
        attachments: [],
        customFields: {},
        timeline: [
          {
            id: v4(),
            type: 'created',
            message: `Created by flow "${flow.name}"`,
            created: now,
          },
        ],
        reminders: [],
        order: 0,
        completed: false,
        archived: false,
        createdBy: flow.ownerUserId,
        created: now,
        updated: now,
      });
      return ok('Task created.');
    }
    case 'feed.post': {
      await readminCollections.feed.insertOne({
        groupId: flow.groupId,
        userId: flow.ownerUserId,
        content: config.message || `Flow: ${flow.name}`,
        attachments: [],
        created: new Date(),
      });
      return ok('Feed post created.');
    }
    case 'discipline.create': {
      if (!subjectId) return skip('No subject user to discipline.');
      await createHistory({
        groupId: flow.groupId,
        actioningUser: flow.ownerUserId,
        userId: subjectId,
        reason: config.reason || `Issued by flow: ${flow.name}`,
        type: (config.type || 'writeup') as any,
        notify: Boolean(config.notify),
        approval_required: false,
        files: [],
      });
      return ok(`Discipline (${config.type || 'writeup'}) issued.`);
    }
    case 'rank.set': {
      if (!subjectId) return skip('No subject user to rank.');
      const mode = (config.mode || 'absolute') as 'absolute' | 'up' | 'down';

      let targetRankId: string | undefined;
      if (mode === 'absolute') {
        if (!config.rankId) return fail('No target rank configured.');
        targetRankId = config.rankId.toString();
      } else {
        // Relative move: order the group's rankable roles and step up/down from
        // the subject's current role. For a member holding several roles that
        // means their HIGHEST — the derived `member.roleId` — which is the only
        // well-defined place to step from. Note rankUser REPLACES the member's
        // roles with the target rather than adding to them.
        const steps = Math.max(1, Number(config.steps) || 1);
        const member = await readminCollections.group_member.findOne({
          groupId: flow.groupId,
          userId: parseInt(subjectId),
        });
        if (!member) return skip('Subject is not a group member.');
        const roles = (
          await readminCollections.group_role
            .find({ groupId: flow.groupId })
            .toArray()
        )
          .filter((r) => r.rank > 0 && r.rank < 255) // exclude guest/owner
          .sort((a, b) => a.rank - b.rank);
        if (roles.length === 0) return skip('No rankable roles found.');
        // Fall back to matching on rank: the stored roleId can point at a role
        // that was filtered out above (guest/owner) or deleted since the last sync.
        let currentIndex = roles.findIndex((r) => r.id === member.roleId);
        if (currentIndex === -1) currentIndex = roles.findIndex((r) => r.rank === member.rankId);
        if (currentIndex === -1)
          return skip("Could not locate the subject's current role.");
        const delta = mode === 'up' ? steps : -steps;
        const targetIndex = Math.min(
          roles.length - 1,
          Math.max(0, currentIndex + delta),
        );
        const target = roles[targetIndex];
        if (!target) return skip('No valid target role to move to.');
        if (target.id === member.roleId)
          return skip(
            `Subject is already at the ${mode === 'up' ? 'highest' : 'lowest'} rankable role.`,
          );
        targetRankId = target.id.toString();
      }

      const res = await rankUser(
        'group',
        flow.groupId,
        flow.groupId,
        subjectId,
        targetRankId!,
        'user',
        { sourceUserId: flow.ownerUserId },
      );
      return res === true
        ? ok(
            mode === 'absolute'
              ? 'Rank change queued.'
              : `Rank ${mode === 'up' ? 'promotion' : 'demotion'} queued.`,
          )
        : fail(`Rank change failed: ${res}`);
    }
    case 'promotionRequest.resolve': {
      if (!subjectId)
        return skip('No subject user to resolve a promotion request for.');
      const decision = (config.decision || 'approve') as 'approve' | 'decline';
      const request = await readminCollections.promotion_request.findOne({
        groupId: flow.groupId,
        targetUserId: subjectId,
        status: 'pending',
      });
      if (!request)
        return skip('No open promotion request for this user to resolve.');

      let rankedTo: string | undefined;
      if (
        decision === 'approve' &&
        config.rankOnApprove !== false &&
        request.requestedRoleId
      ) {
        const targetRole = await readminCollections.group_role.findOne({
          groupId: flow.groupId,
          id: request.requestedRoleId,
        });
        if (targetRole) {
          const result = await rankUser(
            'group',
            flow.groupId,
            flow.groupId,
            request.targetUserId,
            request.requestedRoleId,
            'user',
            { sourceUserId: flow.ownerUserId },
          );
          if (result === true) rankedTo = targetRole.name;
        }
      }

      await readminCollections.promotion_request.updateOne(
        { _id: request._id! },
        {
          $set: {
            status: decision === 'approve' ? 'approved' : 'declined',
            closedBy: flow.ownerUserId,
            closedByName: `Flow: ${flow.name}`,
            closeComment:
              config.reason ||
              (decision === 'approve'
                ? 'Approved automatically by flow.'
                : 'Declined automatically by flow.'),
            rankedTo,
            closedAt: new Date(),
          },
        },
      );

      if (decision === 'approve') {
        try {
          await createHistory({
            groupId: flow.groupId,
            actioningUser: flow.ownerUserId,
            userId: request.targetUserId,
            reason: config.reason || 'Approved via flow (promotion request).',
            type: 'promotion',
            notify: false,
            role: false,
            approval_required: false,
            files: [],
          });
        } catch {
          // Staff-history logging must not block the resolution.
        }
      }

      // Chain to the accepted/declined trigger so existing flows that message
      // the player or HR still fire off this automated decision.
      emitFlowEvent({
        groupId: flow.groupId,
        type:
          decision === 'approve'
            ? 'promotionRequest.accepted'
            : 'promotionRequest.declined',
        subjectUserId: request.targetUserId,
        actorUserId: flow.ownerUserId,
        event: {
          promotionRequest: {
            toRank: request.requestedRoleId,
            toRankName: request.requestedRoleName,
            reason: config.reason,
            rankedTo,
          },
        },
      });

      return ok(
        decision === 'approve'
          ? `Promotion request approved${rankedTo ? ` (ranked to ${rankedTo})` : ''}.`
          : 'Promotion request declined.',
      );
    }
    case 'game.queueAction': {
      if (!subjectId) return skip('No subject user to action in-game.');
      // Find whichever of the workspace's running games the subject is in right
      // now — no need to pick a specific game up front.
      const running = await readminCollections.running_games.findOne({
        groupId: flow.groupId,
        players: subjectId,
      });
      if (!running)
        return skip('Subject is not in any of your games right now.');
      await readminCollections.queued_game_action.insertOne({
        internalGameId: running.internalGameId,
        runningGameId: running._id,
        type: (config.type || 'notify') as 'kick' | 'notify' | 'shutdown',
        userId: subjectId,
        message: config.message || '',
        created: new Date(),
      });
      return ok(
        `Queued in-game ${config.type || 'notify'} in ${running.placeId}.`,
      );
    }
    default:
      return fail(`Unknown action type: ${actionType}`);
  }
}

// ── Rate limiting / circuit breaker ──────────────────────────────────────────

async function isRateLimited(flow: Flow): Promise<boolean> {
  const since = new Date(Date.now() - 3600000);
  const recent = await readminCollections.flow_run.countDocuments({
    flowId: flow._id!,
    status: 'fired',
    created: { $gte: since },
  });
  return recent >= (flow.maxFiresPerHour || 60);
}

// ── Core: run a single flow against an event ─────────────────────────────────

async function runFlow(flow: Flow, args: EmitFlowEventArgs): Promise<void> {
  const context = await buildContext(flow, args);

  // 1) Filters
  if (!evaluateConditionGroup(context, flow.filters)) {
    return; // Filtered out — not logged to avoid noise.
  }

  // 2) Accumulator
  if (flow.accumulator) {
    const reached = await processAccumulator(
      flow,
      flow.accumulator,
      args,
      context,
    );
    if (!reached) return; // Still counting.
  }

  // 3) Circuit breaker
  if (await isRateLimited(flow)) {
    await readminCollections.flow.updateOne(
      { _id: flow._id! },
      {
        $set: {
          enabled: false,
          pausedReason: `Auto-paused: exceeded ${flow.maxFiresPerHour}/hour.`,
          updated: new Date(),
        },
      },
    );
    return;
  }

  // 4) Resolve subject + run actions
  const subjectId = resolveSubjectId(flow.subjectSource, args);
  const dedupeKey = args.refId
    ? `${flow._id?.toString()}:${args.refId}:${subjectId || ''}`
    : undefined;

  if (dedupeKey) {
    const dup = await readminCollections.flow_run.findOne({ dedupeKey });
    if (dup) return; // Already processed this exact event.
  }

  const results: FlowRunActionResult[] = [];
  const held: {
    actionId: string;
    type: FlowActionType;
    config: Record<string, any>;
    destructive?: boolean;
  }[] = [];
  const heldSummary: string[] = [];

  for (const action of flow.actions) {
    // Escalation gate — when the accumulator runs in escalate mode, an action
    // tagged with a tier only runs on the step matching the current count.
    if (flow.accumulator?.escalate && action.tier != null) {
      if (Number(action.tier) !== Number(context.accumulator?.count)) {
        results.push({
          actionId: action.id,
          type: action.type,
          status: 'skipped',
          message: `Escalation step ${action.tier} not reached (currently ${context.accumulator?.count}).`,
        });
        continue;
      }
    }

    // Per-action gate
    if (!evaluateConditionGroup(context, action.runIf)) {
      results.push({
        actionId: action.id,
        type: action.type,
        status: 'skipped',
        message: 'runIf condition not met.',
      });
      continue;
    }
    const rendered = renderConfig(action.config || {}, context);

    if (flow.dryRun) {
      results.push({
        actionId: action.id,
        type: action.type,
        status: 'simulated',
        message: `Would run with: ${JSON.stringify(rendered)}`,
      });
      continue;
    }

    // Approval gate — park the action instead of running it.
    if (action.requireApproval) {
      held.push({
        actionId: action.id,
        type: action.type,
        config: rendered,
        destructive: DESTRUCTIVE_ACTIONS.has(action.type),
      });
      heldSummary.push(
        `${getActionDefinition(action.type)?.label || action.type}: ${JSON.stringify(rendered)}`,
      );
      results.push({
        actionId: action.id,
        type: action.type,
        status: 'pendingApproval',
        message: 'Awaiting human approval before running.',
      });
      continue;
    }

    try {
      const r = await executeAction(flow, action.type, rendered, subjectId);
      results.push({
        actionId: action.id,
        type: action.type,
        status: r.status,
        message: r.message,
      });
    } catch (e) {
      results.push({
        actionId: action.id,
        type: action.type,
        status: 'failed',
        message: (e as Error).message,
      });
    }
  }

  // Park any approval-gated actions for a human to action.
  if (held.length > 0) {
    await readminCollections.flow_approval.insertOne({
      flowId: flow._id!,
      groupId: flow.groupId,
      flowName: flow.name,
      trigger: flow.trigger.type,
      subjectId,
      actorId: args.actorUserId,
      actions: held,
      summary: heldSummary,
      contextSnapshot: {
        subject: context.subject,
        actor: context.actor,
        accumulator: context.accumulator,
        event: context.event,
      },
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      note: null,
      created: new Date(),
    });
  }

  const run: FlowRun = {
    flowId: flow._id!,
    groupId: flow.groupId,
    trigger: flow.trigger.type,
    status: flow.dryRun
      ? 'simulated'
      : held.length > 0
        ? 'pendingApproval'
        : 'fired',
    subjectId,
    actorId: args.actorUserId,
    dedupeKey,
    results,
    contextSnapshot: {
      subject: context.subject,
      actor: context.actor,
      accumulator: context.accumulator,
      event: context.event,
    },
    created: new Date(),
  };
  await readminCollections.flow_run.insertOne(run);

  if (!flow.dryRun) {
    await readminCollections.flow.updateOne(
      { _id: flow._id! },
      { $inc: { fireCount: 1 }, $set: { lastFiredAt: new Date() } },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounded background execution
//
// A single distribution can emit one event per member per goal — for a 26k+
// member group that is tens of thousands of `emitFlowEvent` calls in a tight
// loop. Firing an un-awaited async task per call would spawn tens of thousands
// of concurrent operations, each hitting Mongo and the Roblox API at once,
// exhausting the connection pool and tripping Roblox rate limits.
//
// Instead every event is pushed onto an in-process queue drained by a small,
// fixed worker pool. We also cache the matching-flows lookup per
// (group, trigger) for a few seconds so the overwhelmingly common "this group
// has no flows for this trigger" case costs ~one query for the whole batch
// instead of one query per member.
// ─────────────────────────────────────────────────────────────────────────────

const FLOW_EVENT_CONCURRENCY = 8;
const FLOWS_CACHE_TTL_MS = 5000;
// Safety ceiling: if producers ever outrun the workers by this much, shed load
// rather than grow memory without bound. Comfortably above a 26k member group.
const MAX_QUEUE_LENGTH = 200000;

type FlowsCacheEntry = { at: number; flows: Flow[] };
const flowsCache = new Map<string, FlowsCacheEntry>();

async function getFlowsForTrigger(
  groupId: string,
  type: FlowTriggerType,
): Promise<Flow[]> {
  const cacheKey = `${groupId}:${type}`;
  const cached = flowsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < FLOWS_CACHE_TTL_MS) {
    return cached.flows;
  }
  const flows = (await readminCollections.flow
    .find({ groupId, enabled: true, 'trigger.type': type })
    .toArray()) as Flow[];
  flowsCache.set(cacheKey, { at: Date.now(), flows });
  return flows;
}

const flowEventQueue: EmitFlowEventArgs[] = [];
let activeFlowWorkers = 0;

async function processFlowEvent(args: EmitFlowEventArgs): Promise<void> {
  const flows = await getFlowsForTrigger(args.groupId, args.type);
  // Per-flow circuit breaker (isRateLimited inside runFlow) still runs live
  // against the DB, so a cached flow list can never cause runaway firing.
  for (const flow of flows) {
    try {
      await runFlow(flow, args);
    } catch (e) {
      console.warn(
        `[flows] flow ${flow._id?.toString()} failed:`,
        (e as Error).message,
      );
    }
  }
}

function pumpFlowQueue(): void {
  while (
    activeFlowWorkers < FLOW_EVENT_CONCURRENCY &&
    flowEventQueue.length > 0
  ) {
    const args = flowEventQueue.shift()!;
    activeFlowWorkers++;
    void processFlowEvent(args)
      .catch((e) =>
        console.warn('[flows] processFlowEvent error:', (e as Error).message),
      )
      .finally(() => {
        activeFlowWorkers--;
        pumpFlowQueue();
      });
  }
}

/**
 * Public entry point for producers. Fire-and-forget and exception-safe — it
 * returns immediately so the calling mutation is never blocked or broken, and
 * the actual work is drained by a bounded worker pool (see above).
 */
export function emitFlowEvent(args: EmitFlowEventArgs): void {
  if (flowEventQueue.length >= MAX_QUEUE_LENGTH) {
    console.warn(
      `[flows] event queue full (${MAX_QUEUE_LENGTH}); dropping ${args.type} event for group ${args.groupId}.`,
    );
    return;
  }
  flowEventQueue.push(args);
  pumpFlowQueue();
}

/**
 * Synchronous variant used by the "Test / dry-run" button in the builder. Runs
 * a single flow immediately with a forced dry-run and returns the would-be
 * action results without persisting a run.
 */
export async function dryRunFlow(
  flow: Flow,
  args: EmitFlowEventArgs,
): Promise<{ matched: boolean; results: FlowRunActionResult[]; reason?: string }> {
  const context = await buildContext(flow, args);

  if (!evaluateConditionGroup(context, flow.filters)) {
    return { matched: false, results: [], reason: 'Filters did not match.' };
  }

  // For dry runs we report the accumulator state without mutating counters.
  if (flow.accumulator) {
    const key = accumulatorKey(flow.accumulator, args);
    const start = windowStart(flow.accumulator);
    const existing = await readminCollections.flow_counter.findOne({
      flowId: flow._id!,
      key,
    });
    const count =
      (existing?.events || []).filter((e) => new Date(e.at) >= start).length + 1;
    context.accumulator = { count, threshold: flow.accumulator.threshold };
    if (count < flow.accumulator.threshold) {
      return {
        matched: false,
        results: [],
        reason: `Accumulator at ${count}/${flow.accumulator.threshold}; would not fire yet.`,
      };
    }
  }

  const subjectId = resolveSubjectId(flow.subjectSource, args);
  const results: FlowRunActionResult[] = [];
  for (const action of flow.actions) {
    if (!evaluateConditionGroup(context, action.runIf)) {
      results.push({
        actionId: action.id,
        type: action.type,
        status: 'skipped',
        message: 'runIf condition not met.',
      });
      continue;
    }
    const rendered = renderConfig(action.config || {}, context);
    let ceilingNote = '';
    if (DESTRUCTIVE_ACTIONS.has(action.type)) {
      const allowed = await ownerCanPerform(flow, action.type);
      if (!allowed) ceilingNote = ' (would be BLOCKED by permission ceiling)';
    }
    results.push({
      actionId: action.id,
      type: action.type,
      status: 'simulated',
      message: `Would run with: ${JSON.stringify(rendered)}${ceilingNote}`,
    });
  }

  return { matched: true, results };
}

/** Clears a sinceReset accumulator counter (admin action from the UI). */
export async function resetAccumulator(flowId: ObjectId): Promise<void> {
  await readminCollections.flow_counter.deleteMany({ flowId });
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler — drives `schedule` trigger flows from the sync cron.
//
// `runScheduleFlows()` is invoked once a minute by the sync service. It matches
// each enabled schedule flow's 5-field cron expression against the current
// minute and fires the ones that are due. A per-minute dedupe ref prevents a
// flow from firing twice if the runner is invoked more than once in a minute.
// ─────────────────────────────────────────────────────────────────────────────

/** Match a single standard cron field (supports *, *\/n, a-b, a-b/n, lists). */
function cronFieldMatches(field: string, value: number): boolean {
  if (field === '*' || field === '?') return true;
  return field.split(',').some((part) => {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart ? parseInt(stepPart, 10) : 1;
    if (!step || step < 1) return false;
    if (rangePart === '*') return value % step === 0;
    if (rangePart && rangePart.includes('-')) {
      const [loStr, hiStr] = rangePart.split('-');
      const lo = parseInt(loStr ?? '', 10);
      const hi = parseInt(hiStr ?? '', 10);
      if (isNaN(lo) || isNaN(hi)) return false;
      if (value < lo || value > hi) return false;
      return (value - lo) % step === 0;
    }
    const n = parseInt(rangePart ?? '', 10);
    if (isNaN(n)) return false;
    return stepPart ? n === value && value % step === 0 : n === value;
  });
}

/** Evaluate a 5-field cron expression (min hour dom month dow) against a date. */
export function cronMatches(expr: string, date = new Date()): boolean {
  const fields = (expr || '').trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, dom, month, dow] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];
  return (
    cronFieldMatches(minute, date.getMinutes()) &&
    cronFieldMatches(hour, date.getHours()) &&
    cronFieldMatches(dom, date.getDate()) &&
    cronFieldMatches(month, date.getMonth() + 1) &&
    cronFieldMatches(dow, date.getDay())
  );
}

/** Fire all schedule flows whose cron matches the current minute. */
export async function runScheduleFlows(now = new Date()): Promise<void> {
  const flows = await readminCollections.flow
    .find({ enabled: true, 'trigger.type': 'schedule' })
    .toArray();
  // Stable per-minute key so a flow only fires once per matching minute.
  const minuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}T${now.getHours()}:${now.getMinutes()}`;

  for (const flow of flows) {
    try {
      const cron = (flow.trigger?.config?.cron as string) || '';
      if (!cron || !cronMatches(cron, now)) continue;
      await runFlow(flow as Flow, {
        groupId: flow.groupId,
        type: 'schedule',
        refId: `schedule:${minuteKey}`,
        event: { schedule: { cron, firedAt: now } },
      });
    } catch (e) {
      console.warn(
        `[flows] schedule flow ${flow._id?.toString()} failed:`,
        (e as Error).message,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval gate — execute or reject a parked approval request.
// ─────────────────────────────────────────────────────────────────────────────

export async function decideFlowApproval(args: {
  approvalId: ObjectId;
  groupId: string;
  decidedBy: string;
  approve: boolean;
  note?: string;
}): Promise<{ success: boolean; results: FlowRunActionResult[]; reason?: string }> {
  const approval = await readminCollections.flow_approval.findOne({
    _id: args.approvalId,
    groupId: args.groupId,
  });
  if (!approval) return { success: false, results: [], reason: 'Not found.' };
  if (approval.status !== 'pending')
    return { success: false, results: [], reason: 'Already decided.' };

  const now = new Date();

  if (!args.approve) {
    await readminCollections.flow_approval.updateOne(
      { _id: approval._id! },
      {
        $set: {
          status: 'denied',
          decidedBy: args.decidedBy,
          decidedAt: now,
          note: args.note || null,
        },
      },
    );
    return { success: true, results: [] };
  }

  const flow = await readminCollections.flow.findOne({ _id: approval.flowId });
  const results: FlowRunActionResult[] = [];

  if (!flow) {
    await readminCollections.flow_approval.updateOne(
      { _id: approval._id! },
      { $set: { status: 'approved', decidedBy: args.decidedBy, decidedAt: now, note: args.note || null } },
    );
    return { success: false, results: [], reason: 'Source flow no longer exists.' };
  }

  for (const action of approval.actions) {
    try {
      const r = await executeAction(
        flow as Flow,
        action.type,
        action.config || {},
        approval.subjectId,
      );
      results.push({ actionId: action.actionId, type: action.type, status: r.status, message: r.message });
    } catch (e) {
      results.push({
        actionId: action.actionId,
        type: action.type,
        status: 'failed',
        message: (e as Error).message,
      });
    }
  }

  await readminCollections.flow_approval.updateOne(
    { _id: approval._id! },
    { $set: { status: 'approved', decidedBy: args.decidedBy, decidedAt: now, note: args.note || null } },
  );

  await readminCollections.flow_run.insertOne({
    flowId: approval.flowId,
    groupId: approval.groupId,
    trigger: approval.trigger,
    status: 'fired',
    subjectId: approval.subjectId,
    actorId: approval.actorId,
    results,
    contextSnapshot: approval.contextSnapshot,
    message: `Approved by ${args.decidedBy}.`,
    created: now,
  });

  return { success: true, results };
}
