/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactElement, useMemo } from 'react';
import { useUser } from '~/components/contexts/user';
import { PostingsPublicLayout } from '~/components/page_components/PostingsPublicLayout';
import { trpc } from '~/utils/trpc';

export default function GroupPostingsPage() {
  const router = useRouter();
  const groupId = (router.query.groupId as string) || '';

  const { data, isLoading } = trpc.postings.public.getByGroup.useQuery(
    { groupId },
    { enabled: !!groupId },
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

  if (!groupId || isLoading) {
    return (
      <PostingsPublicLayout>
        <div className="text-gray-500 py-12 text-center">Loading…</div>
      </PostingsPublicLayout>
    );
  }
  if (!data) return null;

  return (
    <PostingsPublicLayout
      title={data.group.name}
      seo={{
        title: `${data.group.name} — Jobs & Open Positions on ReAdmin`,
        description: data.group.description
          ? data.group.description.slice(0, 200)
          : `Open positions at ${data.group.name}. Browse and apply to roles on the ReAdmin job board.`,
        canonicalPath: `/postings/${groupId}`,
        image: data.group.icon || undefined,
      }}
      branding={{
        logoUrl: data.branding?.logoUrl ?? null,
        brandColor: data.branding?.brandColor ?? null,
        groupName: data.group.name,
        href: `/postings/${groupId}`,
      }}
    >
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {data.group.icon ? (
          <img src={data.group.icon} alt="" className="h-16 w-16 rounded-full bg-gray-200" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{data.group.name}</h1>
          {data.group.memberCount !== undefined && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data.group.memberCount.toLocaleString()} members
            </p>
          )}
        </div>
      </div>

      {data.group.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-w-3xl">
          {data.group.description}
        </p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Open Positions ({data.items.length})</h2>
        {data.items.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            This group does not have any open postings right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.items.map((p) => {
              const id = p._id?.toString() || '';
              const applied = appliedSet.has(id);
              return (
              <Link
                key={id}
                href={`/postings/${p.groupId}/${id}`}
                className="block rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold">{p.title}</h3>
                  {applied && (
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                      ✓ Applied
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{p.shortSummary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </PostingsPublicLayout>
  );
}

GroupPostingsPage.getLayout = (page: ReactElement) => page;
