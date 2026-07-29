'use client';

import { useRouter } from 'next/router';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { v4 } from 'uuid';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { trpc } from '~/utils/trpc';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import TextLabel from '~/components/forms/TextLabel';
import TextArea from '~/components/forms/TextArea';
import Dropdown from '~/components/forms/Dropdown';
import Badge from '~/components/ui/Badge';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import { useConfirm } from '~/components/ui/ConfirmModal';
import {
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  BeakerIcon,
  BoltIcon,
  FunnelIcon,
  CalculatorIcon,
  PlayIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

// ── Local draft types (mirror the server Flow shape) ─────────────────────────

type Condition = { id: string; field: string; operator: string; value?: any };
type ConditionGroup = { combinator: 'and' | 'or'; conditions: Condition[] };
type Action = {
  id: string;
  type: string;
  config: Record<string, any>;
  tier?: number | null;
  requireApproval?: boolean;
};
type Draft = {
  name: string;
  description: string;
  enabled: boolean;
  dryRun: boolean;
  trigger: { type: string; config: Record<string, any> };
  filters: ConditionGroup;
  accumulatorEnabled: boolean;
  accumulator: {
    countBy: string;
    threshold: number;
    window: { kind: string; value: number; unit: string };
    rearm: string;
    escalate: boolean;
  };
  subjectSource: string;
  actions: Action[];
  maxFiresPerHour: number;
};

const OPERATORS = [
  { id: 'equals', name: 'equals' },
  { id: 'notEquals', name: 'does not equal' },
  { id: 'in', name: 'is one of (comma list)' },
  { id: 'notIn', name: 'is not one of (comma list)' },
  { id: 'gt', name: 'greater than' },
  { id: 'gte', name: 'greater than or equal' },
  { id: 'lt', name: 'less than' },
  { id: 'lte', name: 'less than or equal' },
  { id: 'contains', name: 'contains' },
  { id: 'matchesRegex', name: 'matches regex' },
  { id: 'isEmpty', name: 'is empty' },
  { id: 'isNotEmpty', name: 'is not empty' },
];

const SUBJECT_SOURCES = [
  { id: 'eventSubject', name: 'The user the event is about' },
  { id: 'eventActor', name: 'The user who caused the event' },
  { id: 'eventTeam', name: 'The related team' },
  { id: 'eventGame', name: 'The related game' },
];

// Plain-language labels for the "only act after it repeats" controls.
const COUNT_BY = [
  { id: 'subjectUser', name: 'the same member' },
  { id: 'actor', name: 'the same person who did it' },
  { id: 'game', name: 'the same game' },
  { id: 'team', name: 'the same team' },
  { id: 'global', name: 'anyone in the group' },
];
const WINDOW_KINDS = [
  { id: 'rolling', name: 'In a rolling time window' },
  { id: 'calendar', name: 'Within each calendar period' },
  { id: 'sinceReset', name: 'Since the count last reset (never expires)' },
];
// Only offered when the trigger is a distribution evaluation.
const DISTRIBUTION_WINDOW_KIND = {
  id: 'lastNDistributions',
  name: 'Over the last N distributions',
};
const WINDOW_UNITS = [
  { id: 'hour', name: 'hours' },
  { id: 'day', name: 'days' },
  { id: 'week', name: 'weeks' },
  { id: 'month', name: 'months' },
];

// Singularised unit word for the live preview sentence.
function unitWord(unit: string, n: number): string {
  const singular = unit;
  return n === 1 ? singular : `${singular}s`;
}

function emptyDraft(): Draft {
  return {
    name: '',
    description: '',
    enabled: false,
    dryRun: true,
    trigger: { type: 'distribution.evaluated', config: {} },
    filters: { combinator: 'and', conditions: [] },
    accumulatorEnabled: false,
    accumulator: {
      countBy: 'subjectUser',
      threshold: 3,
      window: { kind: 'rolling', value: 30, unit: 'day' },
      rearm: 'resetOnFire',
      escalate: false,
    },
    subjectSource: 'eventSubject',
    actions: [],
    maxFiresPerHour: 60,
  };
}

// Numbered step header used by each section card.
function StepHeader({
  n,
  icon: Icon,
  title,
  subtitle,
  accent,
  action,
}: {
  n: number;
  icon: any;
  title: string;
  subtitle?: string;
  accent: string;
  action?: ReactElement;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            <span className="mr-1 text-gray-400">{n}.</span>
            {title}
          </h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function FlowBuilderPage() {
  const router = useRouter();
  const { groupId, flowId } = router.query as { groupId: string; flowId: string };
  const isNew = flowId === 'new';
  const utils = trpc.useUtils();
  const [confirm, ConfirmDialog] = useConfirm();

  const registryQuery = trpc.workspaces.workspace.flows.registry.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const existingQuery = trpc.workspaces.workspace.flows.get.useQuery(
    { groupId, flowId },
    { enabled: !!groupId && !isNew },
  );

  const createMut = trpc.workspaces.workspace.flows.create.useMutation();
  const updateMut = trpc.workspaces.workspace.flows.update.useMutation();
  const deleteMut = trpc.workspaces.workspace.flows.delete.useMutation();
  const testMut = trpc.workspaces.workspace.flows.test.useMutation();

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [loaded, setLoaded] = useState(isNew);
  const [testSubject, setTestSubject] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (isNew || !existingQuery.data || loaded) return;
    const f: any = existingQuery.data;
    setDraft({
      name: f.name || '',
      description: f.description || '',
      enabled: !!f.enabled,
      dryRun: !!f.dryRun,
      trigger: { type: f.trigger?.type || 'distribution.evaluated', config: f.trigger?.config || {} },
      filters: f.filters || { combinator: 'and', conditions: [] },
      accumulatorEnabled: !!f.accumulator,
      accumulator: f.accumulator
        ? { ...emptyDraft().accumulator, ...f.accumulator }
        : emptyDraft().accumulator,
      subjectSource: f.subjectSource || 'eventSubject',
      actions: (f.actions || []).map((a: any) => ({
        id: a.id || v4(),
        type: a.type,
        config: a.config || {},
        tier: a.tier ?? null,
        requireApproval: !!a.requireApproval,
      })),
      maxFiresPerHour: f.maxFiresPerHour || 60,
    });
    setLoaded(true);
  }, [existingQuery.data, isNew, loaded]);

  const triggers = registryQuery.data?.triggers || [];
  const actionDefs = registryQuery.data?.actions || [];
  const tags = registryQuery.data?.tags || [];
  const roles = registryQuery.data?.roles || [];
  const channels = registryQuery.data?.channels || [];
  const departments = registryQuery.data?.departments || [];
  const goals = (registryQuery.data as any)?.goals || [];

  const currentTrigger = useMemo(
    () => triggers.find((t: any) => t.type === draft.trigger.type),
    [triggers, draft.trigger.type],
  );

  // Lookup of a trigger field's value type + enum options, keyed by token path.
  const fieldMeta = useMemo(() => {
    const map: Record<string, { valueType?: string; options?: any[] }> = {};
    for (const f of currentTrigger?.contextFields || []) {
      map[f.path] = { valueType: f.valueType, options: f.options };
    }
    return map;
  }, [currentTrigger]);

  // Tokens the user can drop into any templated text field for this trigger.
  const availableTokens = useMemo(() => {
    const base = (currentTrigger?.contextFields || []).map((f: any) => ({
      token: `{{${f.path}}}`,
      label: f.label,
    }));
    base.push({ token: '{{flow.name}}', label: 'This flow name' });
    if (currentTrigger?.supportsAccumulator)
      base.push({ token: '{{accumulator.count}}', label: 'Times matched so far' });
    return base;
  }, [currentTrigger]);

  // Render the right-hand value input for a condition based on its field type.
  function renderConditionValue(c: Condition) {
    if (c.operator === 'isEmpty' || c.operator === 'isNotEmpty') return null;
    const meta = fieldMeta[c.field];
    const vt = meta?.valueType;
    if (vt === 'boolean') {
      return (
        <Dropdown
          label="Value"
          id={`val-${c.id}`}
          defaultValue={c.value === true || c.value === 'true' ? 'true' : 'false'}
          choices={[
            { id: 'true', name: 'True' },
            { id: 'false', name: 'False' },
          ]}
          onChange={(id) => updateCondition(c.id, { value: id === 'true' })}
        />
      );
    }
    if (vt === 'role') {
      return (
        <Dropdown
          label="Role"
          id={`val-${c.id}`}
          defaultValue={c.value ?? roles[0]?.id}
          choices={roles.length ? roles : [{ id: '', name: 'No roles' }]}
          onChange={(id) => updateCondition(c.id, { value: id })}
        />
      );
    }
    if (vt === 'channel') {
      return (
        <Dropdown
          label="Channel"
          id={`val-${c.id}`}
          defaultValue={c.value ?? channels[0]?.id}
          choices={channels.length ? channels : [{ id: '', name: 'No channels' }]}
          onChange={(id) => updateCondition(c.id, { value: id })}
        />
      );
    }
    if (vt === 'department') {
      return (
        <Dropdown
          label="Department"
          id={`val-${c.id}`}
          defaultValue={c.value ?? departments[0]?.id}
          choices={departments.length ? departments : [{ id: '', name: 'No departments' }]}
          onChange={(id) => updateCondition(c.id, { value: id })}
        />
      );
    }
    if (vt === 'goal') {
      return (
        <Dropdown
          label="Goal"
          id={`val-${c.id}`}
          defaultValue={c.value ?? goals[0]?.id}
          choices={goals.length ? goals : [{ id: '', name: 'No goals' }]}
          onChange={(id) => updateCondition(c.id, { value: id })}
        />
      );
    }
    if (vt === 'enum' && meta?.options?.length) {
      return (
        <Dropdown
          label="Value"
          id={`val-${c.id}`}
          defaultValue={c.value ?? meta.options[0]?.value}
          choices={meta.options.map((o: any) => ({ id: o.value, name: o.label }))}
          onChange={(id) => updateCondition(c.id, { value: id })}
        />
      );
    }
    return (
      <TextLabel
        label="Value"
        id={`val-${c.id}`}
        type={vt === 'number' ? 'number' : 'text'}
        value={c.value ?? ''}
        onChange={(v) => updateCondition(c.id, { value: vt === 'number' ? Number(v) : v })}
        required={false}
      />
    );
  }

  const fieldChoices = useMemo(() => {
    const fields = currentTrigger?.contextFields || [];
    return fields.map((f: any) => ({ id: f.path, name: `${f.label}` }));
  }, [currentTrigger]);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  // ── Conditions ──
  function addCondition() {
    patch({
      filters: {
        ...draft.filters,
        conditions: [
          ...draft.filters.conditions,
          { id: v4(), field: fieldChoices[0]?.id || '', operator: 'equals', value: '' },
        ],
      },
    });
  }
  function updateCondition(id: string, p: Partial<Condition>) {
    patch({
      filters: {
        ...draft.filters,
        conditions: draft.filters.conditions.map((c) => (c.id === id ? { ...c, ...p } : c)),
      },
    });
  }
  function removeCondition(id: string) {
    patch({
      filters: {
        ...draft.filters,
        conditions: draft.filters.conditions.filter((c) => c.id !== id),
      },
    });
  }

  // ── Actions ──
  function addAction() {
    const type = actionDefs[0]?.type || 'discord.webhook';
    patch({ actions: [...draft.actions, { id: v4(), type, config: {}, requireApproval: false }] });
  }
  function updateAction(id: string, p: Partial<Action>) {
    patch({ actions: draft.actions.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  }
  function updateActionConfig(id: string, key: string, value: any) {
    patch({
      actions: draft.actions.map((a) =>
        a.id === id ? { ...a, config: { ...a.config, [key]: value } } : a,
      ),
    });
  }
  function removeAction(id: string) {
    patch({ actions: draft.actions.filter((a) => a.id !== id) });
  }
  function moveAction(idx: number, dir: -1 | 1) {
    const next = [...draft.actions];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[idx];
    const b = next[target];
    if (!a || !b) return;
    next[idx] = b;
    next[target] = a;
    patch({ actions: next });
  }

  // ── Build the server payload ──
  function buildPayload() {
    const conditions = draft.filters.conditions.map((c) => {
      let value: any = c.value;
      if ((c.operator === 'in' || c.operator === 'notIn') && typeof value === 'string') {
        value = value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return { id: c.id, field: c.field, operator: c.operator as any, value };
    });
    return {
      name: draft.name,
      description: draft.description,
      enabled: draft.enabled,
      dryRun: draft.dryRun,
      trigger: { type: draft.trigger.type as any, config: draft.trigger.config },
      filters: { combinator: draft.filters.combinator, conditions },
      accumulator: draft.accumulatorEnabled
        ? {
            countBy: draft.accumulator.countBy as any,
            threshold: Number(draft.accumulator.threshold),
            window: {
              kind: draft.accumulator.window.kind as any,
              value: Number(draft.accumulator.window.value),
              unit: draft.accumulator.window.unit as any,
            },
            rearm: draft.accumulator.rearm as any,
            escalate: !!draft.accumulator.escalate,
          }
        : null,
      subjectSource: draft.subjectSource as any,
      actions: draft.actions.map((a) => ({
        id: a.id,
        type: a.type as any,
        config: a.config,
        tier:
          draft.accumulatorEnabled &&
          draft.accumulator.escalate &&
          a.tier != null
            ? Number(a.tier)
            : null,
        requireApproval: !!a.requireApproval,
      })),
      maxFiresPerHour: Number(draft.maxFiresPerHour),
    };
  }

  async function save() {
    const payload = buildPayload();
    if (!payload.name.trim()) {
      await confirm({ title: 'Name required', body: 'Please give your flow a name.', confirmText: 'OK' });
      return;
    }
    if (isNew) {
      const res = await createMut.mutateAsync({ groupId, flow: payload });
      await utils.workspaces.workspace.flows.list.invalidate({ groupId });
      router.replace(`/workspaces/${groupId}/flows/${res.flowId}`);
    } else {
      await updateMut.mutateAsync({ groupId, flowId, flow: payload });
      await utils.workspaces.workspace.flows.get.invalidate({ groupId, flowId });
      await utils.workspaces.workspace.flows.list.invalidate({ groupId });
    }
  }

  async function remove() {
    if (
      !(await confirm({
        title: 'Delete this flow?',
        body: 'This cannot be undone. Its run history and counters are removed too.',
        confirmText: 'Delete',
        confirmVariant: 'danger',
        destructive: true,
      }))
    )
      return;
    await deleteMut.mutateAsync({ groupId, flowId });
    await utils.workspaces.workspace.flows.list.invalidate({ groupId });
    router.replace(`/workspaces/${groupId}/flows`);
  }

  async function runTest() {
    if (isNew) {
      await confirm({ title: 'Save first', body: 'Save the flow before testing it.', confirmText: 'OK' });
      return;
    }
    const res = await testMut.mutateAsync({
      groupId,
      flowId,
      subjectUserId: testSubject || undefined,
      actorUserId: testSubject || undefined,
    });
    setTestResult(res);
  }

  if (!loaded && !isNew) {
    return <p className="text-sm text-gray-500">Loading flow…</p>;
  }

  const actionLabel = (type: string) =>
    actionDefs.find((a: any) => a.type === type)?.label || type;

  return (
    <>
      <PageHeading
        title={isNew ? 'New flow' : draft.name || 'Edit flow'}
        description="When the trigger fires and conditions match, run actions on the subject."
        backUrl={`/workspaces/${groupId}/flows`}
        disableDivide
      />

      {/* Live recipe summary */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-violet-500">WHEN</span>{' '}
          {currentTrigger?.label || draft.trigger.type}
          {draft.filters.conditions.length > 0 && (
            <>
              {' '}
              <span className="font-semibold text-sky-500">IF</span>{' '}
              {draft.filters.conditions.length} condition
              {draft.filters.conditions.length === 1 ? '' : 's'} ({draft.filters.combinator.toUpperCase()})
            </>
          )}
          {draft.accumulatorEnabled && (
            <>
              {' '}
              <span className="font-semibold text-amber-500">AFTER</span> {draft.accumulator.threshold}× in{' '}
              {draft.accumulator.window.value} {draft.accumulator.window.unit}
            </>
          )}
          {draft.actions.length > 0 ? (
            <>
              {' '}
              <span className="font-semibold text-emerald-500">THEN</span>{' '}
              {draft.actions.map((a) => actionLabel(a.type)).join(', ')}
            </>
          ) : (
            <>
              {' '}
              <span className="font-semibold text-emerald-500">THEN</span>{' '}
              <span className="text-gray-400">add an action…</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Basics */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/60">
          <div className="flex flex-col gap-3">
            <TextLabel
              label="Name"
              id="name"
              value={draft.name}
              onChange={(v) => patch({ name: v })}
              placeholder="At distribution: missed minutes & no time off → write-up"
            />
            <TextArea
              label="Description"
              id="description"
              defaultValue={draft.description}
              onBlur={(v) => patch({ description: v })}
              placeholder="What this flow does and why."
              required={false}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Toggle
                title="Enabled"
                description="Off keeps the flow from running."
                value={draft.enabled}
                onChange={(v) => patch({ enabled: v })}
              />
              <Toggle
                title="Dry run"
                description="Log what would happen without performing actions."
                value={draft.dryRun}
                onChange={(v) => patch({ dryRun: v })}
              />
            </div>
            <TextLabel
              label="Max fires per hour (circuit breaker)"
              id="maxFires"
              type="number"
              value={String(draft.maxFiresPerHour)}
              onChange={(v) => patch({ maxFiresPerHour: Number(v) || 1 })}
            />
          </div>
        </section>

        {/* Trigger */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/60">
          <StepHeader
            n={1}
            icon={BoltIcon}
            title="Trigger"
            subtitle="The event that starts this flow."
            accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
          />
          <div className="mt-4 flex flex-col gap-3">
            <Dropdown
              label="When this happens"
              id="trigger"
              defaultValue={draft.trigger.type}
              choices={triggers.map((t: any) => ({ id: t.type, name: t.label }))}
              onChange={(id) => patch({ trigger: { type: id, config: {} } })}
            />
            {currentTrigger?.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{currentTrigger.description}</p>
            )}
            {(currentTrigger?.config || []).map((field: any) => (
              <TextLabel
                key={field.key}
                label={field.label}
                id={`trigger-${field.key}`}
                value={draft.trigger.config[field.key] || ''}
                placeholder={field.placeholder}
                onChange={(v) =>
                  patch({
                    trigger: { ...draft.trigger, config: { ...draft.trigger.config, [field.key]: v } },
                  })
                }
              />
            ))}
            <Dropdown
              label="Run actions on"
              id="subjectSource"
              defaultValue={draft.subjectSource}
              choices={SUBJECT_SOURCES}
              onChange={(id) => patch({ subjectSource: id })}
            />
          </div>
        </section>

        {/* Conditions */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/60">
          <StepHeader
            n={2}
            icon={FunnelIcon}
            title="Conditions"
            subtitle="Only continue when these match."
            accent="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300"
            action={
              <Button variant="discrete" size="small" icon={PlusIcon} onClick={addCondition}>
                Add
              </Button>
            }
          />
          <div className="mt-4 flex flex-col gap-3">
            {draft.filters.conditions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No conditions — runs on every {currentTrigger?.label || 'event'}.
              </p>
            ) : (
              <>
                <Dropdown
                  label="Match"
                  id="combinator"
                  defaultValue={draft.filters.combinator}
                  choices={[
                    { id: 'and', name: 'ALL conditions (AND)' },
                    { id: 'or', name: 'ANY condition (OR)' },
                  ]}
                  onChange={(id) => patch({ filters: { ...draft.filters, combinator: id as any } })}
                />
                <div className="flex flex-col gap-2">
                  {draft.filters.conditions.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 sm:flex-row sm:items-end"
                    >
                      <div className="flex-1">
                        <Dropdown
                          label="Field"
                          id={`field-${c.id}`}
                          defaultValue={c.field}
                          choices={fieldChoices.length ? fieldChoices : [{ id: c.field || '', name: c.field || '—' }]}
                          onChange={(id) => updateCondition(c.id, { field: id, value: '' })}
                        />
                      </div>
                      <div className="flex-1">
                        <Dropdown
                          label="Operator"
                          id={`op-${c.id}`}
                          defaultValue={c.operator}
                          choices={OPERATORS}
                          onChange={(id) => updateCondition(c.id, { operator: id })}
                        />
                      </div>
                      {c.operator !== 'isEmpty' && c.operator !== 'isNotEmpty' && (
                        <div className="flex-1" key={`${c.field}-${c.operator}`}>
                          {renderConditionValue(c)}
                        </div>
                      )}
                      <Button
                        variant="light_danger"
                        size="small"
                        icon={TrashIcon}
                        onClick={() => removeCondition(c.id)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Accumulator */}
        {currentTrigger?.supportsAccumulator && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/60">
            <StepHeader
              n={3}
              icon={CalculatorIcon}
              title="Only act after it repeats"
              subtitle="Optional. Keep a running tally and wait until the trigger happens several times before the actions run."
              accent="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
              action={
                <Toggle
                  value={draft.accumulatorEnabled}
                  onChange={(v) => patch({ accumulatorEnabled: v })}
                />
              }
            />

            {!draft.accumulatorEnabled ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Off — the actions run <span className="font-medium">every time</span> the trigger
                matches. Turn this on for things like &ldquo;after 4 write-ups, terminate.&rdquo;
              </p>
            ) : (
              (() => {
                const acc = draft.accumulator;
                const isDistTrigger = draft.trigger.type === 'distribution.evaluated';
                const windowKindChoices = isDistTrigger
                  ? [...WINDOW_KINDS, DISTRIBUTION_WINDOW_KIND]
                  : WINDOW_KINDS;
                const who =
                  COUNT_BY.find((c) => c.id === acc.countBy)?.name || 'the same member';
                let when = '';
                if (acc.window.kind === 'rolling') {
                  when = `within the last ${acc.window.value} ${unitWord(acc.window.unit, acc.window.value)}`;
                } else if (acc.window.kind === 'calendar') {
                  when = `within each ${acc.window.unit}`;
                } else if (acc.window.kind === 'lastNDistributions') {
                  when = `within the last ${acc.window.value} distribution${acc.window.value === 1 ? '' : 's'}`;
                } else {
                  when = `at any time (the count never expires on its own)`;
                }
                const after =
                  acc.rearm === 'resetOnFire'
                    ? 'then the count starts over.'
                    : 'and it keeps counting after.';
                return (
                  <div className="mt-4 flex flex-col gap-4">
                    {/* Live plain-English preview */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                      {acc.escalate ? (
                        <>
                          Each time <span className="font-semibold">{who}</span> triggers this{' '}
                          <span className="font-semibold">{when}</span>, escalate one step and run the
                          actions tagged for that step (1st, 2nd, 3rd…).
                        </>
                      ) : (
                        <>
                          Wait until <span className="font-semibold">{who}</span> triggers this{' '}
                          <span className="font-semibold">{acc.threshold} time{acc.threshold === 1 ? '' : 's'}</span>{' '}
                          <span className="font-semibold">{when}</span>, then run the actions — {after}
                        </>
                      )}
                    </div>

                    {/* Step 1 — how many times */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {acc.escalate ? 'Highest step (stop escalating after)' : 'How many times before acting?'}
                      </label>
                      <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {acc.escalate
                          ? 'The final step. With “start over” below, the count resets once it reaches this number.'
                          : 'The actions stay quiet until the trigger has matched this many times.'}
                      </p>
                      <div className="w-40">
                        <TextLabel
                          id="threshold"
                          type="number"
                          value={String(acc.threshold)}
                          onChange={(v) =>
                            patch({ accumulator: { ...acc, threshold: Math.max(1, Number(v) || 1) } })
                          }
                        />
                      </div>
                    </div>

                    {/* Step 2 — counting who */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Keep a separate count for…
                      </label>
                      <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                        e.g. &ldquo;the same member&rdquo; tallies each person on their own, so one
                        member hitting the number doesn&rsquo;t fire it for everyone.
                      </p>
                      <Dropdown
                        id="countBy"
                        defaultValue={acc.countBy}
                        choices={COUNT_BY}
                        onChange={(id) => patch({ accumulator: { ...acc, countBy: id } })}
                      />
                    </div>

                    {/* Step 3 — over what period */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Over what time period?
                      </label>
                      <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                        How far back the tally looks. Older matches stop counting once they fall
                        outside this window.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <Dropdown
                            id="windowKind"
                            defaultValue={acc.window.kind}
                            choices={windowKindChoices}
                            onChange={(id) =>
                              patch({ accumulator: { ...acc, window: { ...acc.window, kind: id } } })
                            }
                          />
                        </div>
                        {acc.window.kind === 'rolling' && (
                          <>
                            <span className="hidden pb-2.5 text-sm text-gray-500 sm:inline">
                              of the last
                            </span>
                            <div className="w-24">
                              <TextLabel
                                id="windowValue"
                                type="number"
                                value={String(acc.window.value)}
                                onChange={(v) =>
                                  patch({
                                    accumulator: {
                                      ...acc,
                                      window: { ...acc.window, value: Math.max(1, Number(v) || 1) },
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="w-32">
                              <Dropdown
                                id="windowUnit"
                                defaultValue={acc.window.unit}
                                choices={WINDOW_UNITS}
                                onChange={(id) =>
                                  patch({ accumulator: { ...acc, window: { ...acc.window, unit: id } } })
                                }
                              />
                            </div>
                          </>
                        )}
                        {acc.window.kind === 'lastNDistributions' && (
                          <>
                            <span className="hidden pb-2.5 text-sm text-gray-500 sm:inline">
                              of the last
                            </span>
                            <div className="w-24">
                              <TextLabel
                                id="windowValue"
                                type="number"
                                value={String(acc.window.value)}
                                onChange={(v) =>
                                  patch({
                                    accumulator: {
                                      ...acc,
                                      window: { ...acc.window, value: Math.max(1, Number(v) || 1) },
                                    },
                                  })
                                }
                              />
                            </div>
                            <span className="hidden pb-2.5 text-sm text-gray-500 sm:inline">
                              distributions
                            </span>
                          </>
                        )}
                        {acc.window.kind === 'calendar' && (
                          <div className="w-40">
                            <Dropdown
                              id="windowUnit"
                              defaultValue={acc.window.unit}
                              choices={WINDOW_UNITS}
                              onChange={(id) =>
                                patch({ accumulator: { ...acc, window: { ...acc.window, unit: id } } })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 4 — after it fires */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        After the actions run…
                      </label>
                      <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                        Reset for a clean slate (recommended), or keep counting so it fires again on
                        every additional match.
                      </p>
                      <Dropdown
                        id="rearm"
                        defaultValue={acc.rearm}
                        choices={[
                          { id: 'resetOnFire', name: 'Start the count over (recommended)' },
                          { id: 'continuous', name: 'Keep counting' },
                        ]}
                        onChange={(id) => patch({ accumulator: { ...acc, rearm: id } })}
                      />
                    </div>

                    {/* Step 5 — escalation */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                      <Toggle
                        title="Escalate — do different things each step"
                        description="Instead of one set of actions at the end, run different actions at each step (e.g. 1st miss → warn, 2nd → suspend, 3rd → terminate). Tag each action with its step below."
                        value={!!acc.escalate}
                        onChange={(v) => patch({ accumulator: { ...acc, escalate: v } })}
                      />
                    </div>
                  </div>
                );
              })()
            )}
          </section>
        )}

        {/* Actions */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/60">
          <StepHeader
            n={currentTrigger?.supportsAccumulator ? 4 : 3}
            icon={PlayIcon}
            title="Actions"
            subtitle="What to do, in order, when the flow fires."
            accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
            action={
              <Button variant="discrete" size="small" icon={PlusIcon} onClick={addAction}>
                Add
              </Button>
            }
          />
          <div className="mt-4 flex flex-col gap-3">
            {draft.actions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No actions yet — add at least one.</p>
            )}
            {draft.actions.map((action, idx) => {
              const def: any = actionDefs.find((a: any) => a.type === action.type);
              return (
                <div
                  key={action.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                        {idx + 1}
                      </span>
                      <div className="w-64 max-w-full">
                        <Dropdown
                          id={`action-${action.id}`}
                          defaultValue={action.type}
                          choices={actionDefs.map((a: any) => ({ id: a.type, name: a.label }))}
                          onChange={(id) => updateAction(action.id, { type: id, config: {} })}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="discrete" size="small" icon={ArrowUpIcon} onClick={() => moveAction(idx, -1)} />
                      <Button variant="discrete" size="small" icon={ArrowDownIcon} onClick={() => moveAction(idx, 1)} />
                      <Button
                        variant="light_danger"
                        size="small"
                        icon={TrashIcon}
                        onClick={() => removeAction(action.id)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {draft.accumulatorEnabled && draft.accumulator.escalate && (
                      <Badge color="blue">
                        {action.tier != null
                          ? `Step ${action.tier}`
                          : 'Every step'}
                      </Badge>
                    )}
                    {def?.destructive && (
                      <Badge color="red">
                        <ExclamationTriangleIcon className="h-3 w-3" /> Destructive
                      </Badge>
                    )}
                    {action.requireApproval && (
                      <Badge color="yellow">
                        <ShieldCheckIcon className="h-3 w-3" /> Needs approval
                      </Badge>
                    )}
                  </div>

                  {def?.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{def.description}</p>
                  )}

                  {(def?.config || []).map((field: any) => {
                    // Respect conditional visibility (e.g. relative-rank steps only
                    // show when mode is up/down).
                    if (field.showIf) {
                      const refDef = (def?.config || []).find(
                        (f: any) => f.key === field.showIf.key,
                      );
                      const current =
                        action.config[field.showIf.key] ?? refDef?.default ?? '';
                      const allowed = Array.isArray(field.showIf.equals)
                        ? field.showIf.equals
                        : [field.showIf.equals];
                      if (!allowed.map(String).includes(String(current))) return null;
                    }
                    const value = action.config[field.key];
                    if (field.type === 'boolean') {
                      return (
                        <Toggle
                          key={field.key}
                          title={field.label}
                          value={!!value}
                          onChange={(v) => updateActionConfig(action.id, field.key, v)}
                        />
                      );
                    }
                    if (field.type === 'select') {
                      const options =
                        field.key === 'tagId'
                          ? tags.map((t: any) => ({ id: t.id, name: t.name }))
                          : (field.options || []).map((o: any) => ({ id: o.value, name: o.label }));
                      return (
                        <Dropdown
                          key={field.key}
                          label={field.label}
                          id={`${action.id}-${field.key}`}
                          defaultValue={value ?? field.default ?? options[0]?.id}
                          choices={options.length ? options : [{ id: '', name: 'No options' }]}
                          onChange={(id) => updateActionConfig(action.id, field.key, id)}
                        />
                      );
                    }
                    if (field.type === 'role') {
                      return (
                        <Dropdown
                          key={field.key}
                          label={field.label}
                          id={`${action.id}-${field.key}`}
                          defaultValue={value ?? roles[0]?.id}
                          choices={roles.length ? roles : [{ id: '', name: 'No roles found' }]}
                          onChange={(id) => updateActionConfig(action.id, field.key, id)}
                        />
                      );
                    }
                    if (field.type === 'channel') {
                      return (
                        <Dropdown
                          key={field.key}
                          label={field.label}
                          id={`${action.id}-${field.key}`}
                          defaultValue={value ?? channels[0]?.id}
                          choices={channels.length ? channels : [{ id: '', name: 'Link a Discord server first' }]}
                          onChange={(id) => updateActionConfig(action.id, field.key, id)}
                        />
                      );
                    }
                    return (
                      <TextLabel
                        key={field.key}
                        label={field.label}
                        id={`${action.id}-${field.key}`}
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={value ?? ''}
                        placeholder={field.placeholder}
                        onChange={(v) => updateActionConfig(action.id, field.key, v)}
                        required={false}
                      />
                    );
                  })}

                  <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                    {draft.accumulatorEnabled && draft.accumulator.escalate && (
                      <div className="mb-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          When does this action run?
                        </label>
                        <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Pick a specific step to run this only on that count (e.g. step 5 = the 5th
                          time), or run it on every step.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <Dropdown
                              id={`${action.id}-tier-mode`}
                              defaultValue={action.tier != null ? 'specific' : 'every'}
                              choices={[
                                { id: 'every', name: 'Every step' },
                                { id: 'specific', name: 'Only on a specific step…' },
                              ]}
                              onChange={(id) =>
                                updateAction(action.id, {
                                  tier: id === 'every' ? null : Number(action.tier) || 1,
                                })
                              }
                            />
                          </div>
                          {action.tier != null && (
                            <div className="flex items-end gap-2">
                              <span className="hidden pb-2.5 text-sm text-gray-500 sm:inline">
                                run on step
                              </span>
                              <div className="w-24">
                                <TextLabel
                                  id={`${action.id}-tier`}
                                  type="number"
                                  value={String(action.tier)}
                                  onChange={(v) =>
                                    updateAction(action.id, {
                                      tier: Math.max(1, Math.min(100, Number(v) || 1)),
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <Toggle
                      title="Require approval before running"
                      description="Park this action for a human to approve in the Approvals tab."
                      value={!!action.requireApproval}
                      onChange={(v) => updateAction(action.id, { requireApproval: v })}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Available template variables for the selected trigger */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
            <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Variables you can use in text fields
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableTokens.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  title={`${t.label} — click to copy`}
                  onClick={() => navigator.clipboard?.writeText(t.token)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-blue-400"
                >
                  {t.token}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
              Click a token to copy it, then paste it into any title/message field.
            </p>
          </div>
        </section>

        {/* Test */}
        {!isNew && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/60">
            <StepHeader
              n={0}
              icon={BeakerIcon}
              title="Test (dry run)"
              subtitle="Simulate against a sample user — no actions are performed."
              accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
            />
            <div className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <RobloxUserSearch
                  label="Sample subject"
                  id="testSubject"
                  groupId={groupId}
                  defaultUser={testSubject || '0'}
                  placeholder="Search for a user…"
                  onSelectUser={(userId) => setTestSubject(userId)}
                />
              </div>
              <Button variant="blue" icon={BeakerIcon} onClick={runTest} disabled={testMut.isPending}>
                {testMut.isPending ? 'Running…' : 'Run test'}
              </Button>
            </div>
            {testResult && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
                <p className="font-medium">
                  {testResult.matched ? 'Would fire ✅' : 'Would not fire'}
                  {testResult.reason ? ` — ${testResult.reason}` : ''}
                </p>
                {(testResult.results || []).map((r: any) => (
                  <div key={r.actionId} className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-mono">{r.type}</span>: {r.status} — {r.message}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Save / Delete — footer actions */}
      <div className="mt-4 flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={save}
          disabled={createMut.isPending || updateMut.isPending}
          width="full"
        >
          {createMut.isPending || updateMut.isPending ? 'Saving…' : 'Save flow'}
        </Button>
        {!isNew && (
          <Button
            variant="light_danger"
            icon={TrashIcon}
            onClick={remove}
            width="full"
          >
            Delete flow
          </Button>
        )}
      </div>
      {ConfirmDialog}
    </>
  );
}

FlowBuilderPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
