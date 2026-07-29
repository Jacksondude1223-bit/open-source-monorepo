'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { JSX, ReactElement } from 'react';
import { UserGroupIcon, UsersIcon, ChartBarIcon, ClockIcon, TrashIcon } from '@heroicons/react/20/solid';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import Button from '~/components/forms/Button';
import { useWorkspace } from '~/components/contexts/workspace';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { teamsTabs } from '~/components/page_components/teamsTabs';
import { useConfirm } from '~/components/ui/ConfirmModal';
import Headshot from '~/components/NextGenStyles/Headshot';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
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
    demotion_recommendation: 'Demotion Recommendation',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[type] ?? type}
    </span>
  );
}

export default function UserFeedbackPage() {
  const router = useRouter();
  const { groupId, userId } = router.query as { groupId: string; userId: string };
  const workspace = useWorkspace();
  const user = useUser();

  const { data: feedback, refetch } = trpc.workspaces.workspace.teams.feedback.getForUser.useQuery(
    { groupId, userId },
    { enabled: !!groupId && !!userId },
  );
  const deleteFeedback = trpc.workspaces.workspace.teams.feedback.delete.useMutation();
  const [confirm, ConfirmDialog] = useConfirm();

  if (!workspace || !('user' in user) || !feedback) return <LoadingPage />;

  // Deleting feedback is gated on the workspace-wide "manage all teams" capability.
  const canManage = workspace.department.permissions.admin || workspace.department.permissions.teams?.manageAll;
  const isOwnFeedback = user.user?.dbUser?.robloxId === userId;

  const handleDelete = async (feedbackId: string) => {
    if (!(await confirm({ title: 'Delete feedback', body: 'Delete this feedback entry? This cannot be undone.', confirmText: 'Delete', destructive: true }))) return;
    await toast.promise(
      deleteFeedback.mutateAsync({ groupId, feedbackId }),
      { loading: 'Deleting...', success: 'Deleted.', error: (e) => e?.message ?? 'Failed.' },
    );
    refetch();
  };

  // Disciplinary actions (strikes / demotions) live in staff history now, so this
  // view only summarizes the advisory feedback kinds that are stored as notes.
  const counts = {
    commendation: feedback.filter((f: any) => f.type === 'commendation').length,
    poor_performance: feedback.filter((f: any) => f.type === 'poor_performance').length,
  };

  return (
    <>
      <PageHeading
        title={
          isOwnFeedback ? 'My Feedback' : <span><TextReturnForUserId userId={userId} />'s Feedback</span> as any
        }
        description="Advisory feedback (commendations & performance notes). Formal disciplinary actions live in staff history."
      />
      <div className="px-6 pb-6 space-y-6">
        {/* Deep links to this user's own records */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/workspaces/${groupId}/users/${userId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            View profile
          </Link>
          <Link
            href={`/workspaces/${groupId}/users/${userId}/notes`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Notes
          </Link>
          {canManage && (
            <Link
              href={`/workspaces/${groupId}/users/${userId}/logging`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Staff history
            </Link>
          )}
        </div>
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(counts).map(([type, count]) => {
            const labelMap: Record<string, string> = {
              commendation: 'Commendations',
              poor_performance: 'Poor Performance',
              strike: 'Strikes',
              demotion_recommendation: 'Demotion Recs.',
            };
            const colorMap: Record<string, string> = {
              commendation: 'text-green-600',
              poor_performance: 'text-yellow-600',
              strike: 'text-orange-600',
              demotion_recommendation: 'text-red-600',
            };
            return (
              <div key={type} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${colorMap[type]}`}>{count}</p>
                <p className="text-xs text-gray-500 mt-1">{labelMap[type]}</p>
              </div>
            );
          })}
        </div>

        {/* Feed */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            History ({feedback.length})
          </h3>
          {feedback.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-sm text-gray-500">No feedback on record.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedback.map((fb: any) => (
                <div key={fb._id?.toString()}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FeedbackBadge type={fb.type} />
                      <span className="text-xs text-gray-400">
                        from <TextReturnForUserId userId={fb.fromUserId} />
                      </span>
                      <span className="text-xs text-gray-400">
                        · <ReactTimeago date={new Date(fb.created)} />
                      </span>
                    </div>
                    {canManage && (
                      <Button
                        variant="light_danger"
                        size="small"
                        icon={TrashIcon}
                        onClick={() => handleDelete(fb._id.toString())}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{fb.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {ConfirmDialog}
    </>
  );
}

UserFeedbackPage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout title="Feedback" tabs={teamsTabs(groupId)}>
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
