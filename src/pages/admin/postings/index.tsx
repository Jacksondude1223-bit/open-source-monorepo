'use client';
/* eslint-disable @next/next/no-img-element */
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import PageHeading from '~/components/layouts/PageHeading';
import { AdminLayout } from '~/components/page_components/AdminLayout';
import Badge from '~/components/ui/Badge';
import { trpc } from '~/utils/trpc';

export default function AdminPostingsPage() {
  const [search, setSearch] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'paused' | 'closed'>('');

  const utils = trpc.useUtils();
  const query = trpc.admin.moderation.postings.getAll.useInfiniteQuery(
    {
      search: search || undefined,
      flaggedOnly: flaggedOnly || undefined,
      status: statusFilter || undefined,
    },
    { getNextPageParam: (last) => last.nextCursor || undefined },
  );

  const forceStatus = trpc.admin.moderation.postings.forceStatus.useMutation({
    onSuccess: () => {
      toast.success('Status updated');
      utils.admin.moderation.postings.getAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setFlagged = trpc.admin.moderation.postings.setFlagged.useMutation({
    onSuccess: () => utils.admin.moderation.postings.getAll.invalidate(),
  });
  const del = trpc.admin.moderation.postings.delete.useMutation({
    onSuccess: () => {
      toast.success('Deleted');
      utils.admin.moderation.postings.getAll.invalidate();
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) || [];

  return (
    <>
      <PageHeading
        title="Postings Moderation"
        description="Monitor job postings for spam, abuse, or rule violations."
      />

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <input
          type="text"
          placeholder="Search title/summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'active' | 'paused' | 'closed' | '')}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((p) => (
          <div
            key={p._id?.toString()}
            className={`rounded-lg border p-4 bg-white dark:bg-gray-900 ${
              p.adminFlagged
                ? 'border-red-300 dark:border-red-800'
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    href={`/postings/${p.groupId}/${p._id?.toString()}`}
                    target="_blank"
                    className="font-semibold hover:underline"
                  >
                    {p.title}
                  </Link>
                  <Badge color={p.status === 'active' ? 'green' : p.status === 'closed' ? 'light' : 'yellow'}>
                    {p.status}
                  </Badge>
                  {p.visibility !== 'public' && <Badge color="light">{p.visibility}</Badge>}
                  {p.adminFlagged && <Badge color="red">Flagged</Badge>}
                  {(p.openReportCount ?? 0) > 0 && (
                    <Badge color="red">{p.openReportCount} open reports</Badge>
                  )}
                  {p.forcedClosedByAdmin && <Badge color="red">Force-closed</Badge>}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{p.shortSummary}</p>
                <div className="text-xs text-gray-500 mt-1">
                  Group: {p.groupId} · Applicants: {p.applicantCount} · Created{' '}
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <select
                  value={p.status}
                  onChange={(e) =>
                    forceStatus.mutate({
                      jobId: p._id!.toString(),
                      status: e.target.value as 'active' | 'paused' | 'closed',
                    })
                  }
                  className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="closed">closed</option>
                </select>
                <button
                  onClick={() =>
                    setFlagged.mutate({ jobId: p._id!.toString(), flagged: !p.adminFlagged })
                  }
                  className={`text-xs px-2 py-1 rounded-md ${
                    p.adminFlagged
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {p.adminFlagged ? 'Unflag' : 'Flag'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete posting "${p.title}"? This is permanent.`)) {
                      del.mutate({ jobId: p._id!.toString() });
                    }
                  }}
                  className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {query.hasNextPage && (
        <div className="text-center mt-4">
          <button
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm px-4 py-2 rounded-md"
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}

AdminPostingsPage.getLayout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>;
