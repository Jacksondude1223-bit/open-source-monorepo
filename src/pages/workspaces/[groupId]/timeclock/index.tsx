import { ReactElement, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ClockIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  StopIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import ReactTimeago from 'react-timeago';
import Head from 'next/head';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import PageHeading from '~/components/layouts/PageHeading';
import LoadingPage from '~/components/layouts/LoadingPage';
import StatCard from '~/components/ui/StatCard';
import Card from '~/components/ui/Card';
import Button from '~/components/forms/Button';
import Modal from '~/components/ui/Modal';
import TextLabel from '~/components/forms/TextLabel';
import TextArea from '~/components/forms/TextArea';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import TimeclockTimeline from '~/components/page_components/workspace/TimeclockTimeline';
import DistributionSelector from '~/components/forms/DistributionSelector';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { formatDurationMinutes, formatEntryTime, toDatetimeLocalValue } from '~/utils/formatDuration';

type OverviewEntry = {
  _id?: any;
  userId: string;
  status: string;
  source: string;
  clockIn: string | Date;
  clockOut?: string | Date | null;
  durationMinutes?: number;
  forcedOut?: boolean;
  needsReview?: boolean;
  user?: { name?: string; displayName?: string; thumbnail?: string };
};

function UserCell({ entry }: { entry: OverviewEntry }) {
  return (
    <div className="flex flex-row items-center gap-2 min-w-0">
      {entry.user?.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.user.thumbnail} alt="" className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700" />
      )}
      <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
        {entry.user?.name || entry.userId}
      </span>
    </div>
  );
}

export default function TimeclockManagerPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const [editEntry, setEditEntry] = useState<OverviewEntry | null>(null);
  const [forceEntry, setForceEntry] = useState<OverviewEntry | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState<string>('');
  // Period selector — undefined = current distribution.
  const [distribution, setDistribution] = useState<number | undefined>(undefined);
  // Week navigation for the timeline (ISO string), undefined = server default.
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);

  const { data, isPending } = trpc.workspaces.workspace.timeclock.getManagerOverview.useQuery(
    { groupId, distribution },
    { enabled: !!groupId },
  );

  const { data: timeline, isFetching: timelineLoading } = trpc.workspaces.workspace.timeclock.getTimeline.useQuery(
    { groupId, distribution, weekStart },
    { enabled: !!groupId },
  );

  const editMutation = trpc.workspaces.workspace.timeclock.editEntry.useMutation();
  const forceMutation = trpc.workspaces.workspace.timeclock.forceClockOut.useMutation();
  const manualMutation = trpc.workspaces.workspace.timeclock.addManualEntry.useMutation();

  const refresh = () => {
    context.workspaces.workspace.timeclock.getManagerOverview.invalidate({ groupId });
    context.workspaces.workspace.timeclock.getTimeline.invalidate({ groupId });
  };

  // Shift the timeline window by ±7 days from whatever week is shown.
  const shiftWeek = (deltaDays: number) => {
    const base = timeline?.weekStart ? new Date(timeline.weekStart) : new Date();
    base.setDate(base.getDate() + deltaDays);
    setWeekStart(base.toISOString());
  };
  const canGoNextWeek = timeline ? new Date(timeline.weekEnd).getTime() < Date.now() : false;

  const perms = workspace?.department?.permissions;
  const canView = perms?.admin || perms?.timeclock?.view || perms?.timeclock?.manage || perms?.timeclock?.edit;

  const reviewIds = useMemo(
    () => new Set((data?.needsReview ?? []).map((e: any) => e._id?.toString())),
    [data],
  );

  if (!workspace) return <LoadingPage />;

  if (!canView) {
    return (
      <>
        <PageHeading title="Timeclock" disableDivide />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Insufficient Permissions</p>
          <Small>You do not have permission to view timeclock records.</Small>
        </div>
      </>
    );
  }

  if (!workspace.timeclockSettings?.enabled) {
    return (
      <>
        <PageHeading title="Timeclock" disableDivide />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Timeclock is disabled</p>
          <Small>Enable the timeclock in workspace settings to start tracking staff attendance.</Small>
          {perms?.admin && (
            <div className="mt-4 flex justify-center">
              <Button variant="primary" size="medium" href={`/workspaces/${groupId}/settings/timeclock`}>
                Open Settings
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (isPending || !data) return <LoadingPage />;

  return (
    <>
      <Head>
        <title>{workspace?.groupName || ''} Timeclock</title>
      </Head>

      <PageHeading title="Timeclock" description={data.isCurrent ? 'Staff attendance for the current period' : `Viewing distribution #${data.distribution}`}>
        {data.allowManualEntries && (data.canManage || data.canEdit) && (
          <Button variant="primary" size="medium" icon={PlusIcon} onClick={() => setManualOpen(true)}>
            Add Manual Entry
          </Button>
        )}
      </PageHeading>

      <DistributionSelector
        distributions={data.distributions as any}
        value={distribution ?? data.currentDistribution}
        onChange={(num) => {
          setDistribution(num === data.currentDistribution ? undefined : num ?? undefined);
          setWeekStart(undefined);
        }}
        className="mt-4"
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard accent="green" icon={UsersIcon} label="Clocked In" value={data.clockedInCount} hint={data.isCurrent ? 'right now' : 'live only'} />
        <StatCard accent="blue" icon={ClockIcon} label="Period Total" value={formatDurationMinutes(data.periodTotalMinutes)} hint="all staff" />
        <StatCard accent="violet" icon={UsersIcon} label="Staff Tracked" value={data.userTotals.length} hint="this period" />
        <StatCard accent="amber" icon={ExclamationTriangleIcon} label="Needs Review" value={data.needsReview.length} hint="flagged" />
      </div>

      {/* Week timeline */}
      <div className="mt-6">
        <Header fontSize="sm">Week Timeline</Header>
        <div className="mt-2">
          <TimeclockTimeline
            data={timeline as any}
            loading={timelineLoading}
            onPrevWeek={() => shiftWeek(-7)}
            onNextWeek={() => shiftWeek(7)}
            canGoNext={canGoNextWeek}
          />
        </div>
      </div>

      {/* Currently clocked in */}
      <div className="mt-6">
        <Header fontSize="sm">Currently Clocked In</Header>
        <div className="mt-2">
          {data.currentlyClockedIn.length === 0 ? (
            <Card><Small>No staff are clocked in right now.</Small></Card>
          ) : (
            <div className="flex flex-col gap-2">
              {(data.currentlyClockedIn as OverviewEntry[]).map((entry) => (
                <Card key={entry._id?.toString()} className="flex flex-row items-center justify-between gap-3">
                  <UserCell entry={entry} />
                  <div className="flex flex-row items-center gap-3">
                    <Small>since <ReactTimeago date={new Date(entry.clockIn)} /></Small>
                    {data.canManage && (
                      <Button variant="light_danger" size="small" icon={StopIcon} onClick={() => setForceEntry(entry)}>
                        Force Out
                      </Button>
                    )}
                    {data.canEdit && (
                      <Button variant="discrete" size="small" icon={PencilSquareIcon} onClick={() => setEditEntry(entry)} />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Needs review */}
      {data.needsReview.length > 0 && (
        <div className="mt-6">
          <Header fontSize="sm">Needs Review</Header>
          <div className="mt-2 flex flex-col gap-2">
            {(data.needsReview as OverviewEntry[]).map((entry) => (
              <Card key={entry._id?.toString()} className="flex flex-row items-center justify-between gap-3 border-amber-200 dark:border-amber-700/50">
                <UserCell entry={entry} />
                <div className="flex flex-row items-center gap-3">
                  <Small>
                    {formatEntryTime(entry.clockIn)} → {formatEntryTime(entry.clockOut)} · {formatDurationMinutes(entry.durationMinutes || 0)}
                  </Small>
                  {data.canEdit && (
                    <Button variant="warning" size="small" icon={PencilSquareIcon} onClick={() => setEditEntry(entry)}>
                      Review
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* User totals */}
      <div className="mt-6">
        <Header fontSize="sm">User Totals (This Period)</Header>
        <div className="mt-2">
          {data.userTotals.length === 0 ? (
            <Card><Small>No time tracked this period yet.</Small></Card>
          ) : (
            <Card className="px-0! py-0! overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/60 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2 font-medium">Staff</th>
                    <th className="px-4 py-2 font-medium">Entries</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {(data.userTotals as any[]).map((total) => (
                    <tr key={total.userId} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                      <td className="px-4 py-2">
                        <UserCell entry={{ userId: total.userId, status: '', source: '', clockIn: total.lastClockIn, user: total.user }} />
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{total.entryCount}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{formatDurationMinutes(total.totalMinutes)}</td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/workspaces/${groupId}/users/${total.userId}/timeclock`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>

      {/* Recent entries */}
      <div className="mt-6 mb-10">
        <Header fontSize="sm">Recent Entries</Header>
        <div className="mt-2 flex flex-col gap-2">
          {(data.recent as OverviewEntry[]).map((entry) => (
            <Card key={entry._id?.toString()} className="flex flex-row items-center justify-between gap-3">
              <UserCell entry={entry} />
              <div className="flex flex-row items-center gap-3">
                <Small>
                  {formatEntryTime(entry.clockIn)} → {entry.status === 'active' ? 'active' : formatEntryTime(entry.clockOut)}
                  {entry.status !== 'active' && ` · ${formatDurationMinutes(entry.durationMinutes || 0)}`}
                  {entry.source === 'manual' && ' · manual'}
                  {entry.forcedOut && ' · forced'}
                  {reviewIds.has(entry._id?.toString()) && ' · ⚠ review'}
                </Small>
                {data.canEdit && (
                  <Button variant="discrete" size="small" icon={PencilSquareIcon} onClick={() => setEditEntry(entry)} />
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editEntry && (
        <Modal open={!!editEntry} setOpen={() => setEditEntry(null)} sizeOverride="lg">
          <Header>Edit Time Entry</Header>
          <Small>Corrections are recorded in the entry&apos;s audit trail.</Small>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as any;
              const clockInVal = form.clockIn.value as string;
              const clockOutVal = form.clockOut.value as string;
              const reason = form.reason.value as string;
              toast.promise(
                editMutation.mutateAsync({
                  groupId,
                  entryId: editEntry._id!.toString(),
                  reason,
                  clockIn: clockInVal ? new Date(clockInVal).toISOString() : undefined,
                  clockOut: clockOutVal ? new Date(clockOutVal).toISOString() : undefined,
                }),
                { loading: 'Saving…', success: 'Entry updated.', error: (err) => err?.message || 'Failed to update.' },
              ).then(() => { refresh(); setEditEntry(null); });
            }}
          >
            <TextLabel label="Clock In" id="clockIn" type="datetime-local" defaultValue={toDatetimeLocalValue(editEntry.clockIn)} required />
            <TextLabel label="Clock Out (leave blank to keep active)" id="clockOut" type="datetime-local" defaultValue={toDatetimeLocalValue(editEntry.clockOut)} required={false} />
            <TextArea label="Reason" id="reason" rows={3} placeholder="Why is this being corrected?" required />
            <div className="flex flex-row justify-end gap-2 mt-2">
              <Button type="button" variant="discrete" size="medium" onClick={() => setEditEntry(null)}>Cancel</Button>
              <Button type="submit" variant="primary" size="medium">Save Changes</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Force clock out modal */}
      {forceEntry && (
        <Modal open={!!forceEntry} setOpen={() => setForceEntry(null)} sizeOverride="md">
          <Header>Force Clock Out</Header>
          <Small>{forceEntry.user?.name || forceEntry.userId} will be clocked out now.</Small>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const reason = (e.currentTarget as any).reason.value as string;
              toast.promise(
                forceMutation.mutateAsync({ groupId, entryId: forceEntry._id!.toString(), reason }),
                { loading: 'Clocking out…', success: 'User clocked out.', error: (err) => err?.message || 'Failed.' },
              ).then(() => { refresh(); setForceEntry(null); });
            }}
          >
            <TextArea label="Reason" id="reason" rows={3} placeholder="Reason for forcing clock out" required />
            <div className="flex flex-row justify-end gap-2 mt-2">
              <Button type="button" variant="discrete" size="medium" onClick={() => setForceEntry(null)}>Cancel</Button>
              <Button type="submit" variant="danger" size="medium">Force Clock Out</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manual entry modal */}
      {manualOpen && (
        <Modal open={manualOpen} setOpen={(o: boolean) => { setManualOpen(o); if (!o) setManualUserId(''); }} sizeOverride="lg">
          <Header>Add Manual Entry</Header>
          <Small>Record time worked on a staff member&apos;s behalf. This is added to the audit trail.</Small>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as any;
              const clockIn = form.clockIn.value as string;
              const clockOut = form.clockOut.value as string;
              const reason = form.reason.value as string;
              if (!manualUserId) {
                toast.error('Select a staff member first.');
                return;
              }
              toast.promise(
                manualMutation.mutateAsync({
                  groupId,
                  userId: manualUserId,
                  clockIn: new Date(clockIn).toISOString(),
                  clockOut: new Date(clockOut).toISOString(),
                  reason,
                }),
                { loading: 'Adding…', success: 'Manual entry added.', error: (err) => err?.message || 'Failed to add.' },
              ).then(() => { refresh(); setManualOpen(false); setManualUserId(''); });
            }}
          >
            <RobloxUserSearch
              label="Staff Member"
              groupId={groupId}
              color={workspace?.brandColor || 'blue'}
              placeholder="Search by username…"
              onSelectUser={(userId) => setManualUserId(userId)}
            />
            <TextLabel label="Clock In" id="clockIn" type="datetime-local" required />
            <TextLabel label="Clock Out" id="clockOut" type="datetime-local" required />
            <TextArea label="Reason" id="reason" rows={3} placeholder="Why is this being added?" required />
            <div className="flex flex-row justify-end gap-2 mt-2">
              <Button type="button" variant="discrete" size="medium" onClick={() => { setManualOpen(false); setManualUserId(''); }}>Cancel</Button>
              <Button type="submit" variant="primary" size="medium">Add Entry</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

TimeclockManagerPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
