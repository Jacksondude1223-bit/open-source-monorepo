/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { ReactElement, useMemo, useState } from 'react';
import { useUser } from '~/components/contexts/user';
import { PostingsPublicLayout } from '~/components/page_components/PostingsPublicLayout';
import { JOB_POSTING_TAGS } from '~/services/NewMongoTypes/JobPosting.type';
import { trpc } from '~/utils/trpc';

function formatRelative(d: Date | string): string {
  const date = new Date(d);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function CompensationBadge({ comp }: { comp?: { type: string; amount?: string; period?: string } }) {
  if (!comp || comp.type === 'unpaid') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">Volunteer</span>;
  }
  const symbol = comp.type === 'robux' ? 'R$' : comp.type === 'usd' ? '$' : '';
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
      {symbol}
      {comp.amount || 'Paid'}
      {comp.period ? ` · ${comp.period}` : ''}
    </span>
  );
}

export default function PostingsBoardPage() {
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [compensationType, setCompensationType] = useState<string>('');

  const query = trpc.postings.public.getAll.useInfiniteQuery(
    {
      search: search || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      compensationType: (compensationType || undefined) as 'robux' | 'usd' | 'unpaid' | 'other' | undefined,
    },
    { getNextPageParam: (last) => last.nextCursor || undefined },
  );

  const user = useUser();
  const isLoggedIn = 'loggedIn' in user && user.loggedIn === true;
  const appliedQuery = trpc.postings.myActiveAppliedJobIds.useQuery(undefined, {
    enabled: isLoggedIn,
  });
  const appliedSet = useMemo(
    () => new Set(appliedQuery.data || []),
    [appliedQuery.data],
  );

  const items = query.data?.pages.flatMap((p) => p.items) || [];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
      {/* Filters */}
      <aside className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Search</h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search postings..."
            className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Compensation</h3>
          <select
            value={compensationType}
            onChange={(e) => setCompensationType(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
          >
            <option value="">Any</option>
            <option value="robux">Robux</option>
            <option value="usd">USD</option>
            <option value="unpaid">Volunteer</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {JOB_POSTING_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2 py-1 rounded-full border transition ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Cards */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Job Postings</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">{items.length} listed</span>
        </div>

        {query.isLoading ? (
          <div className="text-gray-500 text-center py-12">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-gray-500 text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            No postings match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((p) => {
              const id = p._id?.toString() || '';
              const applied = appliedSet.has(id);
              return (
              <Link
                key={id}
                href={`/postings/${p.groupId}/${id}`}
                className="block rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition"
              >
                <div className="flex items-center gap-3 mb-3">
                  {p.groupIconUrl ? (
                    <img src={p.groupIconUrl} alt="" className="h-8 w-8 rounded-full bg-gray-200" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">{p?.groupName}</div>
                  {applied && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                      ✓ Applied
                    </span>
                  )}
                </div>
                <h2 className="font-semibold text-base mb-1 line-clamp-2">{p.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{p.shortSummary}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <CompensationBadge comp={p.compensation} />
                  {p.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <span>{formatRelative(p.createdAt)}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">View →</span>
                </div>
              </Link>
              );
            })}
          </div>
        )}

        {query.hasNextPage && (
          <div className="text-center mt-6">
            <button
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 rounded-md transition disabled:opacity-60"
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

PostingsBoardPage.getLayout = (page: ReactElement) => (
  <PostingsPublicLayout
    seo={{
      title: 'Roblox Job Board — ReAdmin Postings',
      description:
        'Browse open Roblox staff and developer roles on the ReAdmin job board. Filter postings by tag, compensation, and keyword, then apply to communities in one place.',
      canonicalPath: '/postings',
    }}
  >
    {page}
  </PostingsPublicLayout>
);
