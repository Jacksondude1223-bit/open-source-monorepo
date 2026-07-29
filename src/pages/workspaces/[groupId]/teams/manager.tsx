'use client';

import { useRouter } from 'next/router';
import { JSX, ReactElement, useState, Fragment } from 'react';
import toast from 'react-hot-toast';
import {
  UsersIcon, ChatBubbleLeftIcon, ChevronDownIcon, ChevronRightIcon,
} from '@heroicons/react/20/solid';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import Button from '~/components/forms/Button';
import { useWorkspace } from '~/components/contexts/workspace';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { teamsTabs } from '~/components/page_components/teamsTabs';
import HeadshotForUserId from '~/components/ui/HeadshotForUserId';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import Link from 'next/link';
import ReactTimeago from 'react-timeago';

function FeedbackBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    commendation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    poor_performance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    strike: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    demotion_recommendation: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  const labels: Record<string, string> = {
    commendation: 'Commendation',
    poor_performance: 'Poor Performance',
    strike: 'Strike',
    demotion_recommendation: 'Demotion Rec.',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[type] ?? type}
    </span>
  );
}

function ReportCard({
  userId,
  teamId,
  depth,
  groupId,
  brandColor,
  teamMap,
}: {
  userId: string;
  teamId: string;
  depth: number;
  groupId: string;
  brandColor: string;
  teamMap: Map<string|undefined, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: subReports } = trpc.workspaces.workspace.teams.hierarchy.getDirectReports.useQuery(
    { groupId, userId },
    { enabled: expanded },
  );
  const { data: feedback } = trpc.workspaces.workspace.teams.feedback.getForUser.useQuery(
    { groupId, userId },
    { enabled: showFeedback },
  );

  const indentClass = depth > 0 ? 'ml-6 border-l border-gray-200 dark:border-gray-700 pl-4' : '';

  return (
    <div className={indentClass}>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-2">
        <div className="flex items-center gap-3">
          <HeadshotForUserId userId={userId} size={40} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              <TextReturnForUserId userId={userId} />
            </p>
            <p className="text-xs text-gray-400">{teamMap.get(teamId) ?? 'Unknown Team'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="discrete"
              size="small"
              icon={ChatBubbleLeftIcon}
              onClick={() => setShowFeedback(!showFeedback)}
            >
              Feedback
            </Button>
            <Link
              href={`/workspaces/${groupId}/teams/feedback/${userId}`}
              className={`text-xs text-${brandColor}-600 hover:underline`}
            >
              History →
            </Link>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition flex items-center gap-1"
            >
              Reports {expanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {showFeedback && (
          <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
            {!feedback ? (
              <p className="text-xs text-gray-400">Loading feedback...</p>
            ) : feedback.length === 0 ? (
              <p className="text-xs text-gray-400">No feedback on record.</p>
            ) : (
              feedback.slice(0, 5).map((fb: any) => (
                <div key={fb._id?.toString()} className="flex items-start gap-2">
                  <FeedbackBadge type={fb.type} />
                  <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">{fb.note}</p>
                  <span className="text-xs text-gray-400 shrink-0">
                    <ReactTimeago date={new Date(fb.created)} />
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {expanded && subReports && (
        <div>
          {subReports.length === 0 ? (
            <p className="ml-4 text-xs text-gray-400 mb-2">No further reports.</p>
          ) : (
            subReports.map((r: any) => (
              <ReportCard
                key={`${r.userId}-${r.teamId}`}
                userId={r.userId}
                teamId={r.teamId}
                depth={depth + 1}
                groupId={groupId}
                brandColor={brandColor}
                teamMap={teamMap}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { groupId, userId: queryUserId }: { groupId: string; userId?: string } = router.query as any;
  const workspace = useWorkspace();
  const user = useUser();

  // When a userId is supplied via the query string we're viewing someone else's
  // reports (e.g. linked from their profile) rather than the signed-in manager's.
  const selfRobloxId = 'user' in user ? user.user?.dbUser?.robloxId?.toString() : undefined;
  const viewUserId = queryUserId && queryUserId !== selfRobloxId ? queryUserId : undefined;
  const isSelf = !viewUserId;

  const [reportPage, setReportPage] = useState(0);

  const { data: viewUserInfo } = trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery(
    { groupId, userId: viewUserId as string },
    { enabled: !!groupId && !!viewUserId },
  );

  const { data: directReports } = trpc.workspaces.workspace.teams.hierarchy.getDirectReports.useQuery(
    { groupId, userId: viewUserId },
    { enabled: !!groupId },
  );
  const { data: allTeams } = trpc.workspaces.workspace.teams.teams.getAll.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const teamMap = new Map(allTeams?.map((t) => [t._id?.toString(), t.name]) ?? []);
  // Pending approval queues are always the signed-in user's, so only fetch them
  // when looking at our own dashboard.
  const { data: pendingTimeOff } = trpc.workspaces.workspace.teams.timeOff.getPendingApprovals.useQuery(
    { groupId },
    { enabled: !!groupId && isSelf },
  );
  const { data: pendingExpenses } = trpc.workspaces.workspace.teams.expenses.getPendingApprovals.useQuery(
    { groupId },
    { enabled: !!groupId && isSelf },
  );

  const { data: managerChain } = trpc.workspaces.workspace.teams.hierarchy.getManagerChain.useQuery(
    { groupId, userId: viewUserId },
    { enabled: !!groupId },
  );

  if (!workspace || !('user' in user)) return <LoadingPage />;

  const totalPending = (pendingTimeOff?.length ?? 0) + (pendingExpenses?.length ?? 0);

  // Paginate the top-level reports so we never fire hundreds of headshot/username
  // requests at once. Nested sub-reports + feedback are already lazy (loaded on expand).
  const REPORTS_PER_PAGE = 25;
  const reports = directReports ?? [];
  const reportPageCount = Math.max(1, Math.ceil(reports.length / REPORTS_PER_PAGE));
  const safeReportPage = Math.min(reportPage, reportPageCount - 1);
  const pagedReports = reports.slice(
    safeReportPage * REPORTS_PER_PAGE,
    safeReportPage * REPORTS_PER_PAGE + REPORTS_PER_PAGE,
  );
  // Count reports per team and whether the user leads more than one team, so we
  // can group reports under team headings for multi-team leads.
  const reportTeamCounts = new Map<string, number>();
  for (const r of reports as any[]) reportTeamCounts.set(r.teamId, (reportTeamCounts.get(r.teamId) ?? 0) + 1);
  const leadsMultipleTeams = reportTeamCounts.size > 1;

  const viewName = viewUserInfo?.robloxInfo?.name;

  return (
    <>
      <PageHeading
        title={isSelf ? 'My Reports' : viewName ? `${viewName}'s Reports` : 'Reports'}
        description={
          isSelf
            ? 'View your direct reports, their feedback history, and your chain of command.'
            : "View this user's direct reports, their feedback history, and chain of command."
        }
        backUrl={isSelf ? undefined : `/workspaces/${groupId}/users/${viewUserId}`}
      />
      <div className="px-6 pb-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500">Direct Reports</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {directReports?.length ?? '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500">Teams I Lead</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {directReports ? reportTeamCounts.size : '—'}
            </p>
          </div>
        </div>

        {/* Cross-link to the approval queue (lives on the Requests page) */}
        {totalPending > 0 && (
          <Link
            href={`/workspaces/${groupId}/teams/requests`}
            className={`flex items-center justify-between rounded-xl bg-${workspace.brandColor}-50 dark:bg-${workspace.brandColor}-900/20 border border-${workspace.brandColor}-200 dark:border-${workspace.brandColor}-800 px-4 py-3 hover:border-${workspace.brandColor}-300 dark:hover:border-${workspace.brandColor}-700 transition`}
          >
            <p className={`text-sm font-medium text-${workspace.brandColor}-700 dark:text-${workspace.brandColor}-300`}>
              {totalPending} pending approval{totalPending !== 1 ? 's' : ''} awaiting your review
            </p>
            <span className={`text-sm font-medium text-${workspace.brandColor}-600`}>Review in Requests →</span>
          </Link>
        )}

        {/* My chain of command */}
        {managerChain && managerChain.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {isSelf ? 'My Chain of Command' : 'Chain of Command'}
            </h3>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                {managerChain.map((m: any, i: number) => (
                  <div key={`${m.userId}-${m.teamId}`} className="flex items-center gap-2">
                    {i > 0 && <ChevronRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />}
                    <Link
                      href={`/workspaces/${groupId}/teams/feedback/${m.userId}`}
                      className="flex items-center gap-2 rounded-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 pl-1 pr-3 py-1 hover:border-gray-300 dark:hover:border-gray-500 transition"
                    >
                      <HeadshotForUserId userId={m.userId} size={26} />
                      <div className="leading-tight">
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          <TextReturnForUserId userId={m.userId} />
                        </p>
                        <p className="text-[10px] text-gray-400">{teamMap.get(m.teamId) ?? 'Team'}{i === 0 ? ' · Direct manager' : ''}</p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Direct reports tree */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Direct Reports
          </h3>
          {!directReports ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : directReports.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
              <UsersIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">
                {isSelf
                  ? 'You have no direct reports. Assign yourself a lead role in a team to see your reports here.'
                  : 'This user has no direct reports.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {pagedReports.map((r: any, idx: number) => {
                const prev = idx > 0 ? (pagedReports[idx - 1] as any) : null;
                const showTeamHeader = leadsMultipleTeams && (!prev || prev.teamId !== r.teamId);
                return (
                  <Fragment key={`${r.userId}-${r.teamId}`}>
                    {showTeamHeader && (
                      <div className="flex items-center gap-2 pt-4 first:pt-0 pb-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          {teamMap.get(r.teamId) ?? 'Unknown Team'}
                        </h4>
                        <span className="text-xs text-gray-400">({reportTeamCounts.get(r.teamId)})</span>
                      </div>
                    )}
                    <ReportCard
                      userId={r.userId}
                      teamId={r.teamId}
                      depth={0}
                      groupId={groupId}
                      brandColor={workspace.brandColor || 'blue'}
                      teamMap={teamMap}
                    />
                  </Fragment>
                );
              })}
              {reports.length > REPORTS_PER_PAGE && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {safeReportPage * REPORTS_PER_PAGE + 1}–{Math.min((safeReportPage + 1) * REPORTS_PER_PAGE, reports.length)} of {reports.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="discrete"
                      size="small"
                      disabled={safeReportPage <= 0}
                      onClick={() => setReportPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {safeReportPage + 1} of {reportPageCount}
                    </span>
                    <Button
                      variant="discrete"
                      size="small"
                      disabled={safeReportPage >= reportPageCount - 1}
                      onClick={() => setReportPage((p) => Math.min(reportPageCount - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

ManagerDashboardPage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout title="My Reports" tabs={teamsTabs(groupId)}>
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
