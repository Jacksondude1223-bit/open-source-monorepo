'use client';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import PageHeading from '~/components/layouts/PageHeading';
import { AdminLayout } from '~/components/page_components/AdminLayout';
import Badge from '~/components/ui/Badge';
import { trpc } from '~/utils/trpc';

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<'open' | 'reviewed' | 'dismissed'>('open');
  const [contentTypeFilter, setContentTypeFilter] = useState<'' | 'job_posting' | 'resume'>('');

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.moderation.reports.getAll.useQuery({
    status: statusFilter,
    contentType: contentTypeFilter || undefined,
  });

  const update = trpc.admin.moderation.reports.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Report updated');
      utils.admin.moderation.reports.getAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function viewLink(r: { contentType: string; contentId: string }) {
    if (r.contentType === 'job_posting') return `/admin/postings`;
    if (r.contentType === 'resume') return `/admin/resumes`;
    return '#';
  }

  return (
    <>
      <PageHeading
        title="Content Reports"
        description="Reports submitted by users for postings and resumes."
      />

      <div className="flex flex-wrap gap-2 mt-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'open' | 'reviewed' | 'dismissed')}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
        >
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={contentTypeFilter}
          onChange={(e) => setContentTypeFilter(e.target.value as 'job_posting' | 'resume' | '')}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
        >
          <option value="">All content types</option>
          <option value="job_posting">Job postings</option>
          <option value="resume">Resumes</option>
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="text-gray-500 py-8 text-center">Loading…</div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            No reports found.
          </p>
        ) : (
          data.map((r) => (
            <div
              key={r._id?.toString()}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={r.contentType === 'job_posting' ? 'blue' : 'green'}>
                      {r.contentType.replace('_', ' ')}
                    </Badge>
                    <Badge
                      color={
                        r.reason === 'spam'
                          ? 'yellow'
                          : r.reason === 'inappropriate'
                            ? 'red'
                            : 'light'
                      }
                    >
                      {r.reason}
                    </Badge>
                    <Badge
                      color={
                        r.status === 'open' ? 'yellow' : r.status === 'reviewed' ? 'green' : 'light'
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    Content ID: {r.contentId} · By: {r.reportedBy} ·{' '}
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                  {r.details && (
                    <p className="text-sm bg-gray-50 dark:bg-gray-800 rounded p-2 whitespace-pre-wrap">
                      {r.details}
                    </p>
                  )}
                  <Link
                    href={viewLink(r)}
                    className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                  >
                    View in {r.contentType === 'job_posting' ? 'Postings' : 'Resumes'} moderation →
                  </Link>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {r.status === 'open' && (
                    <>
                      <button
                        onClick={() =>
                          update.mutate({ reportId: r._id!.toString(), status: 'reviewed' })
                        }
                        className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200"
                      >
                        Mark reviewed
                      </button>
                      <button
                        onClick={() =>
                          update.mutate({ reportId: r._id!.toString(), status: 'dismissed' })
                        }
                        className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {r.status !== 'open' && (
                    <button
                      onClick={() =>
                        update.mutate({ reportId: r._id!.toString(), status: 'open' })
                      }
                      className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

AdminReportsPage.getLayout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>;
