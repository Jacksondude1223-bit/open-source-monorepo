"use client";

import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactElement, useEffect, useState } from 'react';
import { Cog6ToothIcon } from '@heroicons/react/24/solid';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import DistributionSelector from '~/components/forms/DistributionSelector';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import Card from '~/components/ui/Card';
import type { AttendanceStatus } from '~/server/routers/workspaces/workspace/sessions/attendance';

// Status -> cell colours + the legend label. Mirrors the source spreadsheet key.
const STATUS_META: Record<
  AttendanceStatus,
  { label: string; className: string }
> = {
  H: { label: 'Hosted', className: 'bg-yellow-300 text-yellow-900' },
  A: { label: 'Attended', className: 'bg-green-300 text-green-900' },
  N: { label: 'No Show', className: 'bg-red-300 text-red-900' },
  R: { label: 'Replaced', className: 'bg-blue-300 text-blue-900' },
  U: { label: 'Unexpected Attendance', className: 'bg-purple-300 text-purple-900' },
  C: { label: 'Cancelled', className: 'bg-orange-300 text-orange-900' },
  Leave: { label: 'On Leave', className: 'bg-gray-300 text-gray-800' },
};

function StatusCell({ status }: { status?: AttendanceStatus }) {
  if (!status) return <td className="border border-gray-200 dark:border-gray-800" />;
  const meta = STATUS_META[status];
  const text = status === 'Leave' ? 'L' : status;
  return (
    <td className="border border-gray-200 dark:border-gray-800 p-0.5">
      <div
        className={`${meta.className} h-6 w-full rounded flex items-center justify-center text-xs font-bold`}
        title={meta.label}
      >
        {text}
      </div>
    </td>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const [distributionNumber, setDistributionNumber] = useState<number | undefined>(
    undefined,
  );

  const distributionsQuery =
    trpc.workspaces.workspace.sessions.attendance.listDistributions.useQuery(
      { groupId },
      { refetchOnWindowFocus: false, enabled: !!groupId },
    );

  const gridQuery =
    trpc.workspaces.workspace.sessions.attendance.getAttendanceGrid.useQuery(
      { groupId, distributionNumber },
      { refetchOnWindowFocus: false, enabled: !!groupId },
    );
  
    useEffect(() => {
      if (distributionNumber === undefined && distributionsQuery.data?.length) {
        // Default to the most recent distribution if not set
        if (distributionsQuery.data){
          setDistributionNumber(distributionsQuery.data[0]?.num||undefined);
        }
      }
    }, [distributionNumber, distributionsQuery.data])

  if (!workspace) return <LoadingPage />;

  const grid = gridQuery.data;

  return (
    <>
      <PageHeading
        title="Session Attendance"
        description="Per-session attendance for every user, grouped by department."
      >
        <Link
          href={`/workspaces/${groupId}/sessions/attendance/settings`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <Cog6ToothIcon className="h-5 w-5" />
          Settings
        </Link>
      </PageHeading>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-row items-end gap-4">
          <DistributionSelector
            distributions={distributionsQuery.data ?? []}
            value={distributionNumber ?? grid?.distribution.num ?? null}
            onChange={(num) => setDistributionNumber(num ?? undefined)}
          />
        </div>

        {/* Legend */}
        <Card className="flex flex-row flex-wrap gap-3">
          {(Object.keys(STATUS_META) as AttendanceStatus[]).map((status) => (
            <div key={status} className="flex flex-row items-center gap-1.5">
              <span
                className={`${STATUS_META[status].className} h-5 w-5 rounded flex items-center justify-center text-xs font-bold`}
              >
                {status === 'Leave' ? 'L' : status}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {STATUS_META[status].label}
              </span>
            </div>
          ))}
        </Card>

        {gridQuery.isLoading || !grid ? (
          <div className="flex justify-center py-12">
            <LoadingAnimation />
          </div>
        ) : grid.sessions.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              No sessions ran during this distribution.
            </p>
          </Card>
        ) : grid.departments.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">
              No departments are visible. Choose which departments to show in{' '}
              <Link
                href={`/workspaces/${groupId}/sessions/attendance/settings`}
                className="underline"
              >
                Attendance settings
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="overflow-auto border border-gray-200 dark:border-gray-800 rounded-lg">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 text-left min-w-[240px] align-bottom">
                    <div className="flex flex-col">
                      <span className="font-semibold">User</span>
                      <span className="text-[10px] font-normal text-gray-500">
                        {grid.sessions.length} session
                        {grid.sessions.length === 1 ? '' : 's'} this distribution
                      </span>
                    </div>
                  </th>
                  {grid.sessions.map((session) => (
                    <th
                      key={session.id}
                      className={`border border-gray-200 dark:border-gray-800 p-0 font-medium whitespace-nowrap align-bottom ${
                        session.cancelled ? 'bg-orange-100 dark:bg-orange-950' : ''
                      }`}
                      title={`${session.name} — ${new Date(
                        session.date,
                      ).toLocaleString()}`}
                    >
                      <Link
                        href={`/workspaces/${groupId}/sessions/session/${session.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-0.5 w-20 px-1 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-900 transition"
                      >
                        <span className="truncate w-[72px] text-center font-semibold">
                          {session.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(session.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-[10px] font-normal text-gray-400">
                          {new Date(session.date).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        {session.cancelled && (
                          <span className="text-[9px] font-bold text-orange-600 uppercase">
                            Cancelled
                          </span>
                        )}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.departments.map((dept) => (
                  <DepartmentRows
                    key={dept.id}
                    groupId={groupId}
                    dept={dept}
                    sessions={grid.sessions}
                    userInfo={grid.userInfo}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// Order chips most-actionable first; only non-zero ones render.
const COUNT_ORDER: AttendanceStatus[] = ['H', 'A', 'N', 'U', 'R', 'C', 'Leave'];

function tally(cells: Record<string, AttendanceStatus>) {
  const t: Record<AttendanceStatus, number> = {
    H: 0,
    A: 0,
    N: 0,
    R: 0,
    U: 0,
    C: 0,
    Leave: 0,
  };
  for (const s of Object.values(cells)) t[s] += 1;
  return t;
}

function UserSummary({ cells }: { cells: Record<string, AttendanceStatus> }) {
  const t = tally(cells);
  // Sessions they were responsible for, and how many they actually showed to.
  const expected = t.H + t.A + t.N + t.C;
  const present = t.H + t.A;
  const rate = expected > 0 ? Math.round((present / expected) * 100) : null;
  const chips = COUNT_ORDER.filter((s) => t[s] > 0);

  if (chips.length === 0) {
    return (
      <span className="text-[10px] text-gray-400 pl-8">No sessions</span>
    );
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-1 pl-8">
      {chips.map((s) => (
        <span
          key={s}
          title={STATUS_META[s].label}
          className={`${STATUS_META[s].className} px-1 rounded text-[10px] font-bold leading-4`}
        >
          {(s === 'Leave' ? 'L' : s)}
          {t[s]}
        </span>
      ))}
      {rate !== null && (
        <span
          title="Sessions attended ÷ sessions responsible for (Hosted + Attended + No-show + Cancelled)"
          className={`ml-0.5 text-[10px] font-semibold ${
            rate >= 80
              ? 'text-green-600 dark:text-green-400'
              : rate >= 50
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
          }`}
        >
          {present}/{expected} · {rate}%
        </span>
      )}
    </div>
  );
}

function DepartmentRows({
  groupId,
  dept,
  sessions,
  userInfo,
}: {
  groupId: string;
  dept: {
    id: string;
    name: string;
    users: { userId: string; cells: Record<string, AttendanceStatus> }[];
  };
  sessions: { id: string }[];
  userInfo: Record<string, { name: string; thumbnail: string }>;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={sessions.length + 1}
          className="sticky left-0 z-10 bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300"
        >
          {dept.name}
          <span className="ml-2 font-normal lowercase text-gray-400">
            {dept.users.length} member{dept.users.length === 1 ? '' : 's'}
          </span>
        </th>
      </tr>
      {dept.users.map((user) => {
        const info = userInfo[user.userId];
        return (
          <tr
            key={user.userId}
            className="group hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            <td className="sticky left-0 z-10 bg-white dark:bg-black group-hover:bg-gray-50 dark:group-hover:bg-gray-900 border border-gray-200 dark:border-gray-800 p-0 whitespace-nowrap align-middle">
              <div className="flex flex-col gap-0.5 px-3 py-1.5">
                <Link
                  href={`/workspaces/${groupId}/users/${user.userId}/activity`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  {info?.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={info.thumbnail}
                      alt={info?.name ?? user.userId}
                      className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"
                    />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                  )}
                  <span className="truncate font-medium">
                    {info?.name ?? user.userId}
                  </span>
                </Link>
                <UserSummary cells={user.cells} />
              </div>
            </td>
            {sessions.map((session) => (
              <StatusCell key={session.id} status={user.cells[session.id]} />
            ))}
          </tr>
        );
      })}
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSidebarNavigationLayout>
    {page}
  </WorkspaceSessionsSidebarNavigationLayout>
);
