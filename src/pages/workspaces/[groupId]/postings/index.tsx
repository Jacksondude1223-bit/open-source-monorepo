'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Badge from '~/components/ui/Badge';
import { PencilSquareIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
};

export default function WorkspacePostingsPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const utils = trpc.useUtils();

  const canManage = !!(workspace?.department?.permissions?.admin || workspace?.department?.permissions?.postings?.canManage);
  const canViewApplicants = !!(workspace?.department?.permissions?.admin || workspace?.department?.permissions?.postings?.canViewApplicants);

  const { data, isLoading } = trpc.postings.workspace.list.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  const updateStatus = trpc.postings.workspace.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Status updated');
      utils.postings.workspace.list.invalidate({ groupId });
    },
    onError: (e) => toast.error(e.message),
  });

  const del = trpc.postings.workspace.delete.useMutation({
    onSuccess: () => {
      toast.success('Posting deleted');
      utils.postings.workspace.list.invalidate({ groupId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <LoadingPage />;

  return (
    <>
      <PageHeading
        title="Job Postings"
        description="Recruit staff via the public ReAdmin board."
      >
        {canManage && (
          <Link
            href={`/workspaces/${groupId}/postings/create`}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            + New posting
          </Link>
        )}
      </PageHeading>

      {!data || data.length === 0 ? (
        <div className="mt-6 text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <p className="text-gray-500 mb-3">No postings yet.</p>
          {canManage && (
            <Link
              href={`/workspaces/${groupId}/postings/create`}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              Create your first posting
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {data.map((p) => (
            <div
              key={p._id?.toString()}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{p.title}</h3>
                    <Badge color={p.status === 'active' ? 'green' : p.status === 'closed' ? 'light' : 'yellow'}>
                      {STATUS_LABELS[p.status] || p.status}
                    </Badge>
                    {p.visibility !== 'public' && (
                      <Badge color="light">{p.visibility === 'unlisted' ? 'Unlisted' : 'Hidden'}</Badge>
                    )}
                    {p.adminFlagged && <Badge color="red">Flagged</Badge>}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                    {p.shortSummary}
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <UserGroupIcon className="h-3.5 w-3.5" />
                      {p.applicantCount} applicants
                    </span>
                    <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {canManage && (
                    <select
                      value={p.status}
                      onChange={(e) =>
                        updateStatus.mutate({
                          groupId,
                          jobId: p._id!.toString(),
                          status: e.target.value as 'active' | 'paused' | 'closed',
                        })
                      }
                      className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="closed">Closed</option>
                    </select>
                  )}
                  {canViewApplicants && (
                    <Link
                      href={`/workspaces/${groupId}/postings/${p._id?.toString()}`}
                      className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs px-3 py-1.5 rounded-md font-medium"
                    >
                      Applicants
                    </Link>
                  )}
                  {canManage && (
                    <>
                      <Link
                        href={`/workspaces/${groupId}/postings/${p._id?.toString()}`}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Delete posting "${p.title}"? This will also remove all applications.`)) {
                            del.mutate({ groupId, jobId: p._id!.toString() });
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

WorkspacePostingsPage.getLayout = (page: ReactElement) => <WorkspaceLayout>{page}</WorkspaceLayout>;
