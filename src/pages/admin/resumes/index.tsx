'use client';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import PageHeading from '~/components/layouts/PageHeading';
import { AdminLayout } from '~/components/page_components/AdminLayout';
import Badge from '~/components/ui/Badge';
import { trpc } from '~/utils/trpc';

export default function AdminResumesPage() {
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [publicOnly, setPublicOnly] = useState(false);
  const [hasSlug, setHasSlug] = useState(false);
  const [robloxId, setRobloxId] = useState('');

  const utils = trpc.useUtils();
  const query = trpc.admin.moderation.resumes.getAll.useInfiniteQuery(
    {
      flaggedOnly: flaggedOnly || undefined,
      publicOnly: publicOnly || undefined,
      hasSlug: hasSlug || undefined,
      robloxId: robloxId || undefined,
    },
    { getNextPageParam: (last) => last.nextCursor || undefined },
  );

  const forcePrivate = trpc.admin.moderation.resumes.forcePrivate.useMutation({
    onSuccess: () => {
      toast.success('Forced private');
      utils.admin.moderation.resumes.getAll.invalidate();
    },
  });
  const revokeSlug = trpc.admin.moderation.resumes.revokeSlug.useMutation({
    onSuccess: () => {
      toast.success('Slug revoked');
      utils.admin.moderation.resumes.getAll.invalidate();
    },
  });
  const setFlagged = trpc.admin.moderation.resumes.setFlagged.useMutation({
    onSuccess: () => utils.admin.moderation.resumes.getAll.invalidate(),
  });
  const del = trpc.admin.moderation.resumes.delete.useMutation({
    onSuccess: () => {
      toast.success('Deleted');
      utils.admin.moderation.resumes.getAll.invalidate();
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) || [];

  return (
    <>
      <PageHeading
        title="Resumes Moderation"
        description="Monitor ReAdmin Resumes for abuse, impersonation, or rule violations."
      />

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <input
          type="text"
          placeholder="Filter by Roblox ID"
          value={robloxId}
          onChange={(e) => setRobloxId(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publicOnly} onChange={(e) => setPublicOnly(e.target.checked)} />
          Public
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasSlug} onChange={(e) => setHasSlug(e.target.checked)} />
          Has slug
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((r) => (
          <div
            key={r._id?.toString()}
            className={`rounded-lg border p-4 bg-white dark:bg-gray-900 ${
              r.adminFlagged ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Roblox ID: {r.robloxId}</span>
                  {r.isPublic ? (
                    <Badge color="green">Public</Badge>
                  ) : (
                    <Badge color="light">Private</Badge>
                  )}
                  {r.slug && <Badge color="blue">/{r.slug}</Badge>}
                  {r.adminFlagged && <Badge color="red">Flagged</Badge>}
                  {(r.openReportCount ?? 0) > 0 && (
                    <Badge color="red">{r.openReportCount} open reports</Badge>
                  )}
                  {r.forcedPrivateByAdmin && <Badge color="red">Force-private</Badge>}
                </div>
                {r.headline && <p className="text-sm font-medium">{r.headline}</p>}
                {r.bio && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{r.bio}</p>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {r.workHistory?.length || 0} work entries · Updated{' '}
                  {new Date(r.updatedAt).toLocaleDateString()}
                </div>
                {r.isPublic && (
                  <Link
                    href={`/resume/${r.slug || r.robloxId}`}
                    target="_blank"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    View public page →
                  </Link>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end">
                {r.isPublic && (
                  <button
                    onClick={() => forcePrivate.mutate({ resumeId: r._id!.toString() })}
                    className="text-xs px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  >
                    Force private
                  </button>
                )}
                {r.slug && (
                  <button
                    onClick={() => revokeSlug.mutate({ resumeId: r._id!.toString() })}
                    className="text-xs px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  >
                    Revoke slug
                  </button>
                )}
                <button
                  onClick={() =>
                    setFlagged.mutate({ resumeId: r._id!.toString(), flagged: !r.adminFlagged })
                  }
                  className={`text-xs px-2 py-1 rounded-md ${
                    r.adminFlagged
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {r.adminFlagged ? 'Unflag' : 'Flag'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this resume? This is permanent.')) {
                      del.mutate({ resumeId: r._id!.toString() });
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

AdminResumesPage.getLayout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>;
