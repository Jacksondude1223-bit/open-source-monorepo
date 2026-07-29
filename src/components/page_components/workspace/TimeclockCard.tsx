import { useState } from 'react';
import { ClockIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import ReactTimeago from 'react-timeago';
import Button from '~/components/forms/Button';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { trpc } from '~/utils/trpc';
import { formatDurationMinutes } from '~/utils/formatDuration';

/**
 * Compact clock-in / clock-out widget for the workspace dashboard. Renders
 * nothing when the timeclock feature is disabled or the viewer lacks the clock
 * permission, so it can be dropped onto the home page unconditionally.
 */
export default function TimeclockCard({ groupId }: { groupId: string }) {
  const context = trpc.useUtils();
  const { data: status } = trpc.workspaces.workspace.timeclock.getStatus.useQuery({ groupId });
  const [busy, setBusy] = useState(false);

  const clockIn = trpc.workspaces.workspace.timeclock.clockIn.useMutation();
  const clockOut = trpc.workspaces.workspace.timeclock.clockOut.useMutation();

  if (!status || !status.enabled || !status.canClock) {
    return null;
  }

  const active = status.activeEntry;

  const refresh = () => context.workspaces.workspace.timeclock.getStatus.invalidate({ groupId });

  const handleClockIn = () => {
    setBusy(true);
    toast.promise(clockIn.mutateAsync({ groupId }), {
      loading: 'Clocking in…',
      success: 'You are now clocked in.',
      error: (e) => e?.message || 'Failed to clock in.',
    }).then(refresh).finally(() => setBusy(false));
  };

  const handleClockOut = () => {
    setBusy(true);
    toast.promise(clockOut.mutateAsync({ groupId }), {
      loading: 'Clocking out…',
      success: 'You have been clocked out.',
      error: (e) => e?.message || 'Failed to clock out.',
    }).then(refresh).finally(() => setBusy(false));
  };

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-row items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}>
          <ClockIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <Header fontSize="sm">Timeclock</Header>
          {active ? (
            <Small>
              Clocked in <ReactTimeago date={new Date(active.clockIn)} /> · {formatDurationMinutes(status.periodMinutes)} this period
            </Small>
          ) : (
            <Small>You are clocked out · {formatDurationMinutes(status.periodMinutes)} this period</Small>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {active ? (
          <Button variant="danger" size="medium" icon={StopIcon} disabled={busy} onClick={handleClockOut}>
            Clock Out
          </Button>
        ) : (
          <Button variant="success" size="medium" icon={PlayIcon} disabled={busy} onClick={handleClockIn}>
            Clock In
          </Button>
        )}
      </div>
    </Card>
  );
}
