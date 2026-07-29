/* eslint-disable @next/next/no-img-element */
import { ReactElement, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

type StepType = 'manager' | 'team' | 'user';

type EditStep = {
  id: string;
  type: StepType;
  managerLevel?: number;
  teamId?: string;
  userId?: string;
  label?: string;
};

type EditChain = {
  mode: 'hierarchy' | 'custom';
  hierarchyLevels: number;
  steps: EditStep[];
};

type TeamOption = { _id: string; name: string };

const newId = () => Math.random().toString(36).slice(2, 10);

const defaultChain = (): EditChain => ({ mode: 'hierarchy', hierarchyLevels: 1, steps: [] });

const inputClass =
  'rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

function ChainEditor({
  title,
  description,
  chain,
  setChain,
  teams,
}: {
  title: string;
  description: string;
  chain: EditChain;
  setChain: (c: EditChain) => void;
  teams: TeamOption[];
}) {
  const update = (patch: Partial<EditChain>) => setChain({ ...chain, ...patch });

  const updateStep = (id: string, patch: Partial<EditStep>) =>
    update({ steps: chain.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const addStep = () =>
    update({ steps: [...chain.steps, { id: newId(), type: 'manager', managerLevel: 1 }] });

  const removeStep = (id: string) => update({ steps: chain.steps.filter((s) => s.id !== id) });

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= chain.steps.length) return;
    const next = [...chain.steps];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    update({ steps: next });
  };

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <Header fontSize="sm">{title}</Header>
        <Small>{description}</Small>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Routing mode</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ mode: 'hierarchy' })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              chain.mode === 'hierarchy'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            Manager hierarchy
          </button>
          <button
            type="button"
            onClick={() => update({ mode: 'custom' })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              chain.mode === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            Custom routing
          </button>
        </div>
      </div>

      {chain.mode === 'hierarchy' ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Escalation levels
          </label>
          <Small>
            How many managers up the chain must approve. 1 means just the requester&apos;s direct
            manager; 2 escalates to their manager&apos;s manager, and so on.
          </Small>
          <input
            type="number"
            min={1}
            max={20}
            value={chain.hierarchyLevels}
            onChange={(e) => update({ hierarchyLevels: Math.max(1, Number(e.target.value) || 1) })}
            className={`${inputClass} mt-1 w-24`}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Small>
            Each step is approved in order. A step can route to the requester&apos;s manager at a
            given level, the leads of any team (to skip to another department), or a specific person.
          </Small>
          {chain.steps.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center dark:border-gray-700">
              <Small>No steps yet. Add one to build your routing.</Small>
            </div>
          )}
          {chain.steps.map((step, index) => (
            <div
              key={step.id}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Step {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === chain.steps.length - 1}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                  >
                    <ArrowDownIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={step.type}
                  onChange={(e) =>
                    updateStep(step.id, {
                      type: e.target.value as StepType,
                      managerLevel: e.target.value === 'manager' ? step.managerLevel ?? 1 : undefined,
                      teamId: e.target.value === 'team' ? step.teamId : undefined,
                      userId: e.target.value === 'user' ? step.userId : undefined,
                    })
                  }
                  className={inputClass}
                >
                  <option value="manager">Manager (by level)</option>
                  <option value="team">Team leads</option>
                  <option value="user">Specific person</option>
                </select>

                {step.type === 'manager' && (
                  <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Level
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={step.managerLevel ?? 1}
                      onChange={(e) =>
                        updateStep(step.id, {
                          managerLevel: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className={`${inputClass} w-20`}
                    />
                  </label>
                )}

                {step.type === 'team' && (
                  <select
                    value={step.teamId ?? ''}
                    onChange={(e) => updateStep(step.id, { teamId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select a team…</option>
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}

                {step.type === 'user' && (
                  <input
                    type="text"
                    placeholder="Roblox user ID"
                    value={step.userId ?? ''}
                    onChange={(e) => updateStep(step.id, { userId: e.target.value.trim() })}
                    className={`${inputClass} w-40`}
                  />
                )}
              </div>

              <input
                type="text"
                placeholder="Optional label (e.g. Finance review)"
                value={step.label ?? ''}
                onChange={(e) => updateStep(step.id, { label: e.target.value })}
                className={`${inputClass} w-full`}
              />
            </div>
          ))}
          <div>
            <Button variant="discrete" size="small" onClick={addStep}>
              <span className="flex items-center gap-1">
                <PlusIcon className="h-4 w-4" /> Add step
              </span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function TeamsSettingsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const { data: settings, isPending } = trpc.workspaces.workspace.settings.teams.getSettings.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const updateMutation = trpc.workspaces.workspace.settings.teams.updateSettings.useMutation();

  const [enabled, setEnabled] = useState(true);
  const [allowMemberExpenseRequests, setAllowMemberExpenseRequests] = useState(true);
  const [timeOff, setTimeOff] = useState<EditChain>(defaultChain());
  const [expenses, setExpenses] = useState<EditChain>(defaultChain());

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.enabled);
    setAllowMemberExpenseRequests(settings.allowMemberExpenseRequests !== false);
    setTimeOff({
      mode: settings.timeOff.mode,
      hierarchyLevels: settings.timeOff.hierarchyLevels ?? 1,
      steps: (settings.timeOff.steps ?? []).map((s) => ({ ...s, id: s.id || newId() })),
    });
    setExpenses({
      mode: settings.expenses.mode,
      hierarchyLevels: settings.expenses.hierarchyLevels ?? 1,
      steps: (settings.expenses.steps ?? []).map((s) => ({ ...s, id: s.id || newId() })),
    });
  }, [settings]);

  if (!workspace) return <LoadingPage />;

  if (!workspace.department.permissions.admin) {
    return (
      <>
        <PageHeading title="Teams" disableDivide />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Admins only</p>
          <Small>You must be a workspace admin to manage Teams settings.</Small>
        </div>
      </>
    );
  }

  if (isPending) return <LoadingPage />;

  const validateChain = (chain: EditChain, label: string): boolean => {
    if (chain.mode === 'custom') {
      for (const step of chain.steps) {
        if (step.type === 'team' && !step.teamId) {
          toast.error(`${label}: a team step is missing its team.`);
          return false;
        }
        if (step.type === 'user' && !step.userId) {
          toast.error(`${label}: a person step is missing a Roblox user ID.`);
          return false;
        }
      }
    }
    return true;
  };

  const serializeChain = (chain: EditChain) =>
    chain.mode === 'hierarchy'
      ? { mode: 'hierarchy' as const, hierarchyLevels: chain.hierarchyLevels }
      : {
          mode: 'custom' as const,
          steps: chain.steps.map((s) => ({
            id: s.id,
            type: s.type,
            managerLevel: s.type === 'manager' ? s.managerLevel ?? 1 : undefined,
            teamId: s.type === 'team' ? s.teamId : undefined,
            userId: s.type === 'user' ? s.userId : undefined,
            label: s.label?.trim() || undefined,
          })),
        };

  const save = () => {
    if (!validateChain(timeOff, 'Time off') || !validateChain(expenses, 'Expenses')) return;
    toast
      .promise(
        updateMutation.mutateAsync({
          groupId,
          enabled,
          allowMemberExpenseRequests,
          timeOff: serializeChain(timeOff),
          expenses: serializeChain(expenses),
        }),
        { loading: 'Saving…', success: 'Teams settings saved.', error: (err) => err?.message || 'Failed to save.' },
      )
      .then(() => {
        context.workspaces.workspace.getWorkspace.invalidate({ groupId });
        context.workspaces.workspace.settings.teams.getSettings.invalidate({ groupId });
      });
  };

  const teams = settings?.teams ?? [];

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Teams`}
        description="Enable Teams and configure how time-off and expense approvals are routed"
      />

      <div className="mt-4 flex flex-col gap-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gray-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-gray-100">New here?</span>{' '}
          Set up your{' '}
          <Link
            href={`/workspaces/${groupId}/settings/departments`}
            className="font-medium text-blue-600 underline dark:text-blue-400"
          >
            Departments
          </Link>{' '}
          first — they control what your staff can access. Teams build on top of that to manage
          direct reports and route time-off / expense approvals.
        </div>
        <Card>
          <Toggle
            id="enabled"
            title="Enable Teams"
            description="Show Teams in the navigation and on staff profiles. When off, Teams is hidden everywhere and new requests are blocked."
            value={enabled}
            onChange={setEnabled}
          />
        </Card>

        {enabled && (
          <>
            <Card>
              <Toggle
                id="allowMemberExpenseRequests"
                title="Let members request expenses"
                description="When on, any member can submit an expense request. When off, only managers and approvers can."
                value={allowMemberExpenseRequests}
                onChange={setAllowMemberExpenseRequests}
              />
            </Card>
            <ChainEditor
              title="Time off approvals"
              description="Who signs off when a staff member requests time off."
              chain={timeOff}
              setChain={setTimeOff}
              teams={teams}
            />
            <ChainEditor
              title="Expense approvals"
              description="Who signs off on expense reports. Use custom routing to skip a direct report and send to another team or department."
              chain={expenses}
              setChain={setExpenses}
              teams={teams}
            />
          </>
        )}

        <div className="flex flex-row justify-end">
          <Button variant="primary" size="medium" onClick={save} disabled={updateMutation.isPending}>
            Save Settings
          </Button>
        </div>
      </div>
    </>
  );
}

TeamsSettingsPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
