'use client';

import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import Badge from '~/components/ui/Badge';
import { useConfirm } from '~/components/ui/ConfirmModal';
import {
  PlusIcon,
  BoltIcon,
  ShieldExclamationIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserPlusIcon,
  UserMinusIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  CheckIcon,
  XMarkIcon,
  FireIcon,
} from '@heroicons/react/24/outline';

// Trigger presentation metadata — label, icon and accent for the card chips.
const TRIGGER_META: Record<
  string,
  { label: string; icon: any; accent: string }
> = {
  'writeup.created': { label: 'Write-up created', icon: ShieldExclamationIcon, accent: 'text-rose-500' },
  'promotionRequest.created': { label: 'Promotion requested', icon: ArrowTrendingUpIcon, accent: 'text-indigo-500' },
  'promotionRequest.accepted': { label: 'Promotion accepted', icon: ArrowTrendingUpIcon, accent: 'text-emerald-500' },
  'promotionRequest.declined': { label: 'Promotion declined', icon: ArrowTrendingUpIcon, accent: 'text-amber-500' },
  'promotionRequest.voted': { label: 'Promotion vote cast', icon: CheckIcon, accent: 'text-indigo-500' },
  'member.joined': { label: 'Member joined', icon: UserPlusIcon, accent: 'text-emerald-500' },
  'member.left': { label: 'Member left', icon: UserMinusIcon, accent: 'text-rose-500' },
  'member.promoted': { label: 'Member promoted', icon: ArrowTrendingUpIcon, accent: 'text-emerald-500' },
  'member.demoted': { label: 'Member demoted', icon: ArrowTrendingDownIcon, accent: 'text-amber-500' },
  'distribution.evaluated': { label: 'Activity goal evaluated', icon: ChartBarIcon, accent: 'text-sky-500' },
  'goal.met': { label: 'Goal met', icon: CheckIcon, accent: 'text-emerald-500' },
  'distribution.started': { label: 'New distribution started', icon: CalendarDaysIcon, accent: 'text-sky-500' },
  schedule: { label: 'On a schedule', icon: ClockIcon, accent: 'text-violet-500' },
};

function relativeTime(date?: Date | string | null): string {
  if (!date) return 'never';
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function FlowsListPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const utils = trpc.useUtils();
  const [confirm, ConfirmDialog] = useConfirm();
  const [tab, setTab] = useState<'flows' | 'approvals'>('flows');

  const flowsQuery = trpc.workspaces.workspace.flows.list.useQuery({ groupId });
  const approvalsQuery = trpc.workspaces.workspace.flows.approvals.useQuery({
    groupId,
    status: 'pending',
  });

  const setEnabled = trpc.workspaces.workspace.flows.setEnabled.useMutation({
    onSuccess: () => utils.workspaces.workspace.flows.list.invalidate({ groupId }),
  });
  const decide = trpc.workspaces.workspace.flows.decideApproval.useMutation({
    onSuccess: () => utils.workspaces.workspace.flows.approvals.invalidate({ groupId }),
  });

  const flows = flowsQuery.data || [];
  const approvals = approvalsQuery.data || [];
  const enabledCount = flows.filter((f) => f.enabled).length;

  async function onDecide(approvalId: string, approve: boolean) {
    if (
      approve &&
      !(await confirm({
        title: 'Approve and run these actions?',
        body: 'The held actions will execute immediately against the subject.',
        confirmText: 'Approve & run',
        confirmVariant: 'primary',
      }))
    )
      return;
    if (
      !approve &&
      !(await confirm({
        title: 'Deny this request?',
        body: 'The held actions will be discarded and never run.',
        confirmText: 'Deny',
        confirmVariant: 'danger',
        destructive: true,
      }))
    )
      return;
    await decide.mutateAsync({ groupId, approvalId, approve });
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Flows`}
        description="Automate the busywork. When something happens — optionally after it repeats — run actions on a member."
        disableDivide
      >
        <Button
          variant="primary"
          icon={PlusIcon}
          onClick={() => router.push(`/workspaces/${groupId}/flows/new`)}
        >
          New flow
        </Button>
      </PageHeading>

      {/* Segmented tabs */}
      <div className="mb-4 flex w-fit items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/40">
        <button
          onClick={() => setTab('flows')}
          className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === 'flows'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <BoltIcon className="h-4 w-4" />
          Flows
          <span className="rounded-full bg-gray-200 px-1.5 text-xs dark:bg-gray-600">
            {flows.length}
          </span>
        </button>
        <button
          onClick={() => setTab('approvals')}
          className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === 'approvals'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <CheckIcon className="h-4 w-4" />
          Approvals
          {approvals.length > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white">
              {approvals.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'flows' && (
        <>
          {flows.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatChip label="Total flows" value={flows.length} icon={BoltIcon} />
              <StatChip label="Active" value={enabledCount} icon={CheckIcon} accent="text-emerald-500" />
              <StatChip
                label="Total fires"
                value={flows.reduce((a, f) => a + (f.fireCount || 0), 0)}
                icon={FireIcon}
                accent="text-orange-500"
              />
              <StatChip label="Pending approvals" value={approvals.length} icon={ClockIcon} accent="text-amber-500" />
            </div>
          )}

          {flowsQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading flows…</p>
          ) : flows.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
              <BoltIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                No flows yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                Build your first automation — e.g. &ldquo;at distribution, if a member missed
                their minutes and had no time off → write them up.&rdquo;
              </p>
              <div className="mt-5">
                <Button
                  variant="primary"
                  icon={PlusIcon}
                  onClick={() => router.push(`/workspaces/${groupId}/flows/new`)}
                >
                  Create a flow
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {flows.map((flow) => {
                const meta = TRIGGER_META[flow.trigger?.type] || {
                  label: flow.trigger?.type,
                  icon: BoltIcon,
                  accent: 'text-gray-400',
                };
                const Icon = meta.icon;
                return (
                  <div
                    key={flow._id}
                    className="group relative flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="flex flex-1 items-start gap-3 text-left"
                        onClick={() => router.push(`/workspaces/${groupId}/flows/${flow._id}`)}
                      >
                        <div className={`mt-0.5 rounded-xl bg-gray-100 p-2 dark:bg-gray-700/50 ${meta.accent}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                              {flow.name}
                            </span>
                            {flow.dryRun && <Badge color="yellow">Dry run</Badge>}
                            {flow.pausedReason && <Badge color="red">Auto-paused</Badge>}
                          </div>
                          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            {meta.label}
                            {flow.accumulator
                              ? ` · ${flow.accumulator.threshold}× / ${flow.accumulator.window.value} ${flow.accumulator.window.unit}`
                              : ''}
                          </p>
                          {flow.description && (
                            <p className="mt-1 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">
                              {flow.description}
                            </p>
                          )}
                        </div>
                      </button>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Toggle
                          value={flow.enabled}
                          onChange={(v) =>
                            setEnabled.mutate({ groupId, flowId: flow._id!, enabled: v })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <BoltIcon className="h-3.5 w-3.5" />
                        {flow.actions?.length || 0} action{flow.actions?.length === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FireIcon className="h-3.5 w-3.5" />
                        {flow.fireCount || 0} fired
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {relativeTime(flow.lastFiredAt)}
                      </span>
                    </div>

                    {flow.pausedReason && (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
                        {flow.pausedReason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'approvals' && (
        <>
          {approvalsQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading approvals…</p>
          ) : approvals.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
              <CheckIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                Nothing waiting on you
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Approval-gated flow actions will show up here for a human to sign off.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {approvals.map((a: any) => (
                <div
                  key={a._id}
                  className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-900/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{a.flowName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Subject {a.subjectId || '—'} · requested {relativeTime(a.created)}
                      </p>
                    </div>
                    <Badge color="yellow">Pending</Badge>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
                    {(a.summary || []).map((line: string, i: number) => (
                      <div key={i} className="font-mono">
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="light_danger"
                      size="small"
                      icon={XMarkIcon}
                      onClick={() => onDecide(a._id, false)}
                      disabled={decide.isPending}
                    >
                      Deny
                    </Button>
                    <Button
                      variant="success"
                      size="small"
                      icon={CheckIcon}
                      onClick={() => onDecide(a._id, true)}
                      disabled={decide.isPending}
                    >
                      Approve &amp; run
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {ConfirmDialog}
    </>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  accent = 'text-gray-400',
}: {
  label: string;
  value: number;
  icon: any;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
      <Icon className={`h-5 w-5 ${accent}`} />
      <div>
        <p className="text-lg font-semibold leading-none text-gray-900 dark:text-gray-100">
          {value}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

FlowsListPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
