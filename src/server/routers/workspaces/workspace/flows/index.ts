import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ObjectId } from 'mongodb';
import { workspaceProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';
import { Flow } from '~/services/NewMongoTypes/Flow.type';
import { FLOW_ACTIONS, FLOW_TRIGGERS } from '~/services/flows/registry';
import { getGroupRoles } from '~/services/roblox.service';
import { getGuildChannels } from '~/services/discord.service';
import {
  dryRunFlow,
  resetAccumulator,
  decideFlowApproval,
} from '~/services/flows/flowEngine.service';

// ── Zod schemas mirroring the Flow types ─────────────────────────────────────

const conditionSchema = z.object({
  id: z.string(),
  field: z.string(),
  operator: z.enum([
    'equals',
    'notEquals',
    'in',
    'notIn',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'matchesRegex',
    'isEmpty',
    'isNotEmpty',
  ]),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number()])),
    ])
    .optional(),
});

// Condition groups can nest one level deep (sufficient for the v1 builder).
const conditionGroupSchema = z.object({
  combinator: z.enum(['and', 'or']),
  conditions: z.array(conditionSchema),
  groups: z
    .array(
      z.object({
        combinator: z.enum(['and', 'or']),
        conditions: z.array(conditionSchema),
      }),
    )
    .optional(),
});

const accumulatorSchema = z.object({
  countBy: z.enum(['subjectUser', 'actor', 'game', 'team', 'global']),
  threshold: z.number().int().min(1).max(1000),
  window: z.object({
    kind: z.enum(['rolling', 'calendar', 'sinceReset', 'lastNDistributions']),
    value: z.number().int().min(1).max(365),
    unit: z.enum(['hour', 'day', 'week', 'month']),
  }),
  rearm: z.enum(['resetOnFire', 'continuous']),
  escalate: z.boolean().optional(),
});

const actionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'discord.webhook',
    'discord.dm',
    'discord.channel',
    'user.addNote',
    'user.addTag',
    'user.removeTag',
    'task.create',
    'feed.post',
    'discipline.create',
    'rank.set',
    'promotionRequest.resolve',
    'game.queueAction',
  ]),
  config: z.record(z.string(), z.any()),
  runIf: conditionGroupSchema.optional(),
  tier: z.number().int().min(1).max(100).nullable().optional(),
  requireApproval: z.boolean().optional(),
});

const triggerSchema = z.object({
  type: z.enum([
    'writeup.created',
    'promotionRequest.created',
    'promotionRequest.accepted',
    'promotionRequest.declined',
    'promotionRequest.voted',
    'member.joined',
    'member.left',
    'member.promoted',
    'member.demoted',
    'distribution.started',
    'distribution.evaluated',
    'goal.met',
    'schedule',
  ]),
  config: z.record(z.string(), z.any()).optional(),
});

const flowInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  enabled: z.boolean(),
  dryRun: z.boolean(),
  trigger: triggerSchema,
  filters: conditionGroupSchema.optional(),
  accumulator: accumulatorSchema.nullable().optional(),
  subjectSource: z.enum([
    'eventSubject',
    'eventActor',
    'eventTeam',
    'eventGame',
  ]),
  actions: z.array(actionSchema).max(25),
  maxFiresPerHour: z.number().int().min(1).max(1000),
});

function requireAdmin(ctx: { department: any }) {
  if (!ctx.department?.permissions?.admin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You must be a workspace admin to manage Flows.',
    });
  }
}

function actorId(ctx: { user?: any }): string {
  return (
    ctx.user?.dbUser?.robloxId?.toString() ||
    ctx.user?.roblox?.id?.toString() ||
    ''
  );
}

export const workspaceFlowsRouter = router({
  // Catalog for the builder UI: triggers, actions, tags, roblox roles and
  // discord channels (so condition values and action configs can offer smart
  // pickers instead of raw text inputs).
  registry: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const [tags, roles, discord] = await Promise.all([
        readminCollections.workspace_tag.find({ groupId: input.groupId }).toArray(),
        getGroupRoles(input.groupId).catch(() => undefined),
        readminCollections.discord_bots.findOne({ groupId: input.groupId }),
      ]);
      const departments = await readminCollections.department
        .find({ groupId: input.groupId })
        .toArray();
      const goals = await readminCollections.activity_requirements
        .find({ groupId: input.groupId })
        .toArray();
      let channels: { id: string; name: string }[] = [];
      if (discord?.guildId) {
        try {
          const guildChannels = await getGuildChannels(discord.guildId);
          channels = guildChannels
            // 0 = text, 5 = announcement, 15 = forum — message-capable channels.
            .filter((c) => [0, 5, 15].includes(c.type as number))
            .map((c) => ({ id: c.id, name: c.name || c.id }));
        } catch {
          channels = [];
        }
      }
      return {
        triggers: FLOW_TRIGGERS,
        actions: FLOW_ACTIONS,
        tags: tags.map((t) => ({ id: t._id?.toString() || '', name: t.name })),
        goals: goals.map((g) => ({
          id: g._id?.toString() || '',
          name: g.name || g._id?.toString() || '',
        })),
        roles: (roles || [])
          .slice()
          .sort((a, b) => b.rank - a.rank)
          .map((r) => ({ id: r.id.toString(), name: `${r.name} (${r.rank})` })),
        channels,
        departments: departments.map((d) => ({
          id: d._id?.toString() || '',
          name: d.name,
        })),
      };
    }),

  list: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const flows = await readminCollections.flow
        .find({ groupId: input.groupId })
        .sort({ updated: -1 })
        .toArray();
      return flows.map((f) => ({ ...f, _id: f._id?.toString() }));
    }),

  get: workspaceProcedure
    .input(z.object({ groupId: z.string(), flowId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const flow = await readminCollections.flow.findOne({
        groupId: input.groupId,
        _id: new ObjectId(input.flowId),
      });
      if (!flow)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Flow not found' });
      return { ...flow, _id: flow._id?.toString() };
    }),

  create: workspaceProcedure
    .input(z.object({ groupId: z.string(), flow: flowInputSchema }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const now = new Date();
      const me = actorId(ctx);
      const doc: Flow = {
        groupId: input.groupId,
        name: input.flow.name,
        description: input.flow.description,
        enabled: input.flow.enabled,
        dryRun: input.flow.dryRun,
        trigger: input.flow.trigger,
        filters: input.flow.filters,
        accumulator: input.flow.accumulator ?? null,
        subjectSource: input.flow.subjectSource,
        actions: input.flow.actions,
        ownerUserId: me,
        maxFiresPerHour: input.flow.maxFiresPerHour,
        pausedReason: null,
        fireCount: 0,
        lastFiredAt: null,
        createdBy: me,
        created: now,
        updated: now,
      };
      const res = await readminCollections.flow.insertOne(doc);
      return { flowId: res.insertedId.toString() };
    }),

  update: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        flowId: z.string(),
        flow: flowInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const res = await readminCollections.flow.updateOne(
        { groupId: input.groupId, _id: new ObjectId(input.flowId) },
        {
          $set: {
            name: input.flow.name,
            description: input.flow.description,
            enabled: input.flow.enabled,
            dryRun: input.flow.dryRun,
            trigger: input.flow.trigger,
            filters: input.flow.filters,
            accumulator: input.flow.accumulator ?? null,
            subjectSource: input.flow.subjectSource,
            actions: input.flow.actions,
            maxFiresPerHour: input.flow.maxFiresPerHour,
            // Re-enabling clears any auto-pause reason.
            ...(input.flow.enabled ? { pausedReason: null } : {}),
            updated: new Date(),
          },
        },
      );
      if (!res.matchedCount)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Flow not found' });
      return { success: true };
    }),

  setEnabled: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        flowId: z.string(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      await readminCollections.flow.updateOne(
        { groupId: input.groupId, _id: new ObjectId(input.flowId) },
        {
          $set: {
            enabled: input.enabled,
            ...(input.enabled ? { pausedReason: null } : {}),
            updated: new Date(),
          },
        },
      );
      return { success: true };
    }),

  delete: workspaceProcedure
    .input(z.object({ groupId: z.string(), flowId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const _id = new ObjectId(input.flowId);
      await readminCollections.flow.deleteOne({ groupId: input.groupId, _id });
      await readminCollections.flow_counter.deleteMany({ flowId: _id });
      await readminCollections.flow_run.deleteMany({ flowId: _id });
      return { success: true };
    }),

  resetCounters: workspaceProcedure
    .input(z.object({ groupId: z.string(), flowId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      await resetAccumulator(new ObjectId(input.flowId));
      return { success: true };
    }),

  // Recent execution history for the timeline.
  runs: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        flowId: z.string(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const runs = await readminCollections.flow_run
        .find({ groupId: input.groupId, flowId: new ObjectId(input.flowId) })
        .sort({ created: -1 })
        .limit(input.limit)
        .toArray();
      return runs.map((r) => ({ ...r, _id: r._id?.toString() }));
    }),

  // Dry-run a saved flow against a sample subject without executing actions.
  test: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        flowId: z.string(),
        subjectUserId: z.string().optional(),
        actorUserId: z.string().optional(),
        event: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const flow = await readminCollections.flow.findOne({
        groupId: input.groupId,
        _id: new ObjectId(input.flowId),
      });
      if (!flow)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Flow not found' });
      return dryRunFlow(flow as Flow, {
        groupId: input.groupId,
        type: flow.trigger.type,
        subjectUserId: input.subjectUserId,
        actorUserId: input.actorUserId,
        event: input.event,
      });
    }),

  // Pending approval-gated actions awaiting a human decision.
  approvals: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        status: z.enum(['pending', 'approved', 'denied']).default('pending'),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const items = await readminCollections.flow_approval
        .find({ groupId: input.groupId, status: input.status })
        .sort({ created: -1 })
        .limit(input.limit)
        .toArray();
      return items.map((a) => ({
        ...a,
        _id: a._id?.toString(),
        flowId: a.flowId?.toString(),
      }));
    }),

  decideApproval: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        approvalId: z.string(),
        approve: z.boolean(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      return decideFlowApproval({
        approvalId: new ObjectId(input.approvalId),
        groupId: input.groupId,
        decidedBy: actorId(ctx),
        approve: input.approve,
        note: input.note,
      });
    }),
});