/* eslint-disable @next/next/no-img-element */
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import { ClockIcon, PencilSquareIcon } from '@heroicons/react/24/solid';
import LoadingPage from '~/components/layouts/LoadingPage';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import WorkspaceUserSidebarLayout from '~/components/page_components/workspaces/users/user/WorkspaceUserSidebarLayout';
import StatCard from '~/components/ui/StatCard';
import Card from '~/components/ui/Card';
import Button from '~/components/forms/Button';
import Modal from '~/components/ui/Modal';
import TextLabel from '~/components/forms/TextLabel';
import TextArea from '~/components/forms/TextArea';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { formatDurationMinutes, formatEntryTime, toDatetimeLocalValue } from '~/utils/formatDuration';
import { BRAND_NAME } from '~/utils/brand';

type Entry = {
  _id?: any;
  status: string;
  source: string;
  clockIn: string | Date;
  clockOut?: string | Date | null;
  durationMinutes?: number;
  forcedOut?: boolean;
  needsReview?: boolean;
  note?: string;
  adjustments?: { by: string; at: string | Date; action: string; reason: string }[];
};

export default function UserTimeclockPage() {
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } = router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  const { data: userInfo } = trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery({ groupId, userId });
  const { data, isPending } = trpc.workspaces.workspace.timeclock.getUserEntries.useQuery(
    { groupId, userId },
    { enabled: !!groupId && !!userId },
  );
  const editMutation = trpc.workspaces.workspace.timeclock.editEntry.useMutation();

  const refresh = () => context.workspaces.workspace.timeclock.getUserEntries.invalidate({ groupId, userId });

  if (!workspace) return <LoadingPage />;

  if (!workspace.department.permissions.activity.view) {
    router.push(`/workspaces/${groupId}`);
    return <></>;
  }

  if (!workspace.timeclockSettings?.enabled) {
    return (
      <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
        <p className="font-semibold text-gray-900 dark:text-gray-100">Timeclock is disabled</p>
        <Small>Enable the timeclock in workspace settings to track attendance.</Small>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{workspace?.premium?.is ? '' : `${BRAND_NAME} `}{workspace?.groupName || ''} {userInfo?.robloxInfo?.name || ''} Timeclock</title>
      </Head>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard accent="blue" icon={ClockIcon} label="This Period" loading={!data} value={formatDurationMinutes(data?.periodMinutes || 0)} hint="time tracked" />
          <StatCard accent="violet" icon={ClockIcon} label="Entries" loading={!data} value={data?.periodEntryCount || 0} hint="this period" />
          <StatCard accent="green" icon={ClockIcon} label="Total Shown" loading={!data} value={data?.entries.length || 0} hint="recent" />
        </div>

        <div>
          <Header fontSize="sm">Clock History</Header>
          <div className="mt-2 flex flex-col gap-2">
            {!data && <LoadingAnimation />}
            {data && data.entries.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-gray-100">No clock entries yet</p>
                <Small>This user has not clocked any time.</Small>
              </div>
            )}
            {(data?.entries as Entry[] | undefined)?.map((entry) => (
              <Card key={entry._id?.toString()} className={entry.needsReview ? 'border-amber-200 dark:border-amber-700/50' : ''}>
                <div className="flex flex-row items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatEntryTime(entry.clockIn)} → {entry.status === 'active' ? <span className="text-emerald-600 dark:text-emerald-400">active now</span> : formatEntryTime(entry.clockOut)}
                    </p>
                    <Small>
                      {entry.status === 'active' ? (
                        <>started <ReactTimeago date={new Date(entry.clockIn)} /></>
                      ) : (
                        <>{formatDurationMinutes(entry.durationMinutes || 0)}</>
                      )}
                      {entry.source === 'manual' && ' · manual'}
                      {entry.forcedOut && ' · forced out'}
                      {entry.needsReview && ' · ⚠ needs review'}
                      {entry.note ? ` · "${entry.note}"` : ''}
                    </Small>
                  </div>
                  {(data?.canEdit) && (
                    <Button variant="discrete" size="small" icon={PencilSquareIcon} onClick={() => setEditEntry(entry)} />
                  )}
                </div>

                {entry.adjustments && entry.adjustments.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-700/60">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Audit Trail</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {entry.adjustments.map((adj, i) => (
                        <li key={i} className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{adj.action.replace('_', ' ')}</span>
                          {' · '}<ReactTimeago date={new Date(adj.at)} />{' · '}{adj.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

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
    </>
  );
}

UserTimeclockPage.getLayout = (page: ReactElement) => (
  <WorkspaceUserSidebarLayout>{page}</WorkspaceUserSidebarLayout>
);
