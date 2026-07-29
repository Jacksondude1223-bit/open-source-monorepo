/* eslint-disable @next/next/no-img-element */
import { NextRouter, useRouter } from 'next/router';
import { useState, useMemo, useEffect, ReactElement } from 'react';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { RouterOutput, trpc } from '~/utils/trpc';
import TimeAgo from 'react-timeago';
import { MemberResponse } from '~/server/routers/workspaces/workspace/activity/staff';
import OwnerStarBadge, { useIsWorkspaceOwner } from '~/components/ui/OwnerStarBadge';
import DepartmentBadge from '~/components/ui/DepartmentBadge';
import NoSSR from '~/components/NoSSR';
import Spinner from '~/components/ui/Spinner';
import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  UsersIcon,
  ClockIcon,
} from '@heroicons/react/20/solid';

type Workspace = RouterOutput['workspaces']['workspace']['getWorkspace'];
type Role = Workspace['roles'][number];
type ViewMode = 'grid' | 'list';
type SortKey = 'recent' | 'oldest' | 'name' | 'name-desc';

function GlobalUserSearch({
  router,
  workspace,
}: {
  router: NextRouter;
  workspace: Workspace;
}) {
  return (
    <RobloxUserSearch
      color="gray"
      size="small"
      placeholder="Search anyone by username…"
      onSelectUser={(userId) => {
        router.push(`/workspaces/${workspace.groupId}/users/${userId}`);
      }}
      groupId={workspace.groupId}
    />
  );
}

function RoleSidebar({
  roles,
  searchRole,
  onSelectRole,
  workspace,
  nextSync,
}: {
  roles: Role[];
  searchRole: Role | null;
  onSelectRole: (role: Role) => void;
  workspace: Workspace;
  nextSync: Date;
}) {
  const brand = workspace?.brandColor || 'blue';
  const [roleQuery, setRoleQuery] = useState('');

  const visibleRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    return roles
      .filter((a) => a.rank >= workspace.minSyncRole)
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .sort((a, b) => a.rank - b.rank);
  }, [roles, roleQuery, workspace.minSyncRole]);

  const totalMembers = useMemo(
    () =>
      roles
        .filter((a) => a.rank >= workspace.minSyncRole)
        .reduce((acc, r) => acc + (r.memberCount || 0), 0),
    [roles, workspace.minSyncRole],
  );

  return (
    <aside className="flex flex-col gap-3 col-span-6 lg:col-span-2 xl:col-span-1 lg:sticky lg:top-4 self-start lg:max-h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Roles
        </p>
        <span className="text-[11px] font-medium text-gray-400">
          {totalMembers.toLocaleString()} members
        </span>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={roleQuery}
          onChange={(e) => setRoleQuery(e.target.value)}
          placeholder="Filter roles"
          className={`w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-8 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-${brand}-500/50 focus:border-${brand}-500 transition`}
        />
        {roleQuery && (
          <button
            onClick={() => setRoleQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 -mr-1">
        {visibleRoles.length === 0 && (
          <p className="text-xs text-gray-400 px-1 py-2">
            No roles match “{roleQuery}”.
          </p>
        )}
        {visibleRoles.map((role) => {
          const isActive = searchRole?.id === role.id;
          return (
            <button
              onClick={() => onSelectRole(role)}
              key={!role?._id ? role.id : role._id.toString()}
              className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition ${
                isActive
                  ? `bg-${brand}-50 dark:bg-${brand}-500/10 border-${brand}-500 shadow-sm`
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span
                className={`text-sm font-medium truncate ${
                  isActive
                    ? `text-${brand}-700 dark:text-${brand}-400`
                    : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                {role.name}
              </span>
              <span
                className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                  isActive
                    ? `bg-${brand}-500 text-white`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
                }`}
              >
                {role.memberCount.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-1 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-1 px-1">
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <ClockIcon className="w-3.5 h-3.5" />
          Last synced:{' '}
          {workspace?.lastSynced ? (
            <TimeAgo date={workspace?.lastSynced || new Date()} />
          ) : (
            'never'
          )}
        </span>
        <span className="text-[11px] text-gray-400 pl-5">
          Next sync <TimeAgo date={nextSync} />
        </span>
      </div>
    </aside>
  );
}

function MemberItem({
  member,
  view,
}: {
  member: MemberResponse;
  view: ViewMode;
}) {
  const workspace = useWorkspace();
  const brand = workspace?.brandColor || 'blue';
  const subtitle = member?.department?.name || member?.rankName;
  const isOwner = useIsWorkspaceOwner(member?.userId?.toString());

  if (view === 'list') {
    return (
      <Link
        key={member.userId.toString()}
        id={member.userId.toString()}
        href={`/workspaces/${workspace.groupId}/users/${member.userId}`}
        className="fade-in animate-in slide-in-from-left group flex items-center gap-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 transition"
      >
        <div className="relative shrink-0">
          <img
            className={`rounded-full w-9 h-9 border border-${brand}-300 bg-${brand}-100`}
            src={member?.thumbnail}
            alt={`${member?.name} headshot`}
          />
          {isOwner && <OwnerStarBadge size={15} />}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {member.name}
            {member.displayName && member.displayName !== member.name && (
              <span className="text-gray-400 font-normal ml-1">
                ({member.displayName})
              </span>
            )}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {member?.department ? (
              <DepartmentBadge name={member.department.name} color={member.department.color} />
            ) : (
              subtitle
            )}
          </span>
        </div>
        {member?.created && (
          <span className="hidden sm:block text-[11px] text-gray-400 shrink-0">
            <TimeAgo date={member.created} />
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      key={member.userId.toString()}
      id={member.userId.toString()}
      href={`/workspaces/${workspace.groupId}/users/${member.userId}`}
      className="fade-in animate-in slide-in-from-left group flex items-center gap-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition"
    >
      <div className="relative shrink-0 group-hover:scale-105 transition">
        <img
          className={`rounded-full w-12 h-12 border border-${brand}-300 bg-${brand}-100`}
          src={member?.thumbnail}
          alt={`${member?.name} headshot`}
        />
        {isOwner && <OwnerStarBadge size={18} />}
      </div>
      <div className="flex flex-col min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {member.name}
          {member.displayName && member.displayName !== member.name && (
            <span className="text-gray-400 font-normal ml-1">
              ({member.displayName})
            </span>
          )}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
          {member?.department ? (
            <DepartmentBadge name={member.department.name} color={member.department.color} />
          ) : (
            subtitle
          )}
          {member?.created ? (
            <>
              {' '}
              &middot; joined <TimeAgo date={member?.created} />
            </>
          ) : (
            ''
          )}
        </p>
      </div>
    </Link>
  );
}

function MemberSkeleton({ view }: { view: ViewMode }) {
  if (view === 'list') {
    return (
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-2.5 w-1/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-2.5 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [searchRole, setSelectedRole] = useState<Role | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [view, setView] = useState<ViewMode>('grid');

  // The workspace context can be null on the first render, so pick a sensible
  // default role once it's available rather than in the initial state.
  useEffect(() => {
    if (searchRole || !workspace?.roles) return;
    const defaultRole =
      workspace.roles
        .filter((a) => a.rank >= workspace.minSyncRole && a.memberCount > 0)
        .sort((a, b) => a.rank - b.rank)[0] ?? null;
    if (defaultRole) setSelectedRole(defaultRole);
  }, [workspace, searchRole]);

  const searchQuery: {
    roleId: string;
    groupId: string;
    cursor?: string;
    sort?: 'recent' | 'oldest';
  } = {
    roleId: searchRole?.id?.toString() || '',
    groupId: groupId,
    // Name sorts are applied client-side over loaded members; the server only
    // needs the join-date direction so pagination fetches in the right order.
    sort: sort === 'oldest' ? 'oldest' : 'recent',
  };
  if (cursor !== undefined) {
    searchQuery.cursor = cursor;
  }

  const {
    data: members,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.workspaces.workspace.activity.staff.getUsersInRole.useInfiniteQuery(
    searchQuery,
    {
      enabled: !!searchRole?.id,
      // The server decides when it has run out of members; it knows whether the
      // page it just built was truncated. Deriving this on the client from the
      // role's Roblox member count never terminated, because a member with
      // several roles is only stored under their highest one.
      getNextPageParam: (lastPage: any) => lastPage?.nextCursor ?? null,
    },
  );

  const allMembers = useMemo<MemberResponse[]>(
    () =>
      ((members?.pages?.flatMap((page: any) => page?.members ?? []) ??
        []) as MemberResponse[])
        // Drop anything without a userId instead of letting it reach the render,
        // where `member.userId.toString()` is used as the React key. A cached
        // page from a previous response shape (this endpoint used to return a
        // bare array) would otherwise white-screen the whole page.
        .filter((m) => m?.userId !== undefined && m?.userId !== null),
    [members],
  );

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const list = q
      ? allMembers.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.displayName?.toLowerCase().includes(q),
        )
      : allMembers;

    const sorted = [...list];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'oldest':
        sorted.sort(
          (a, b) =>
            new Date(a.created || 0).getTime() -
            new Date(b.created || 0).getTime(),
        );
        break;
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.created || 0).getTime() -
            new Date(a.created || 0).getTime(),
        );
    }
    return sorted;
  }, [allMembers, memberQuery, sort]);

  if (typeof window == undefined) {
    return <></>;
  }

  if (
    !workspace ||
    !router.isReady ||
    'loading' in user ||
    user.loggedIn == false
  ) {
    return <LoadingPage />;
  }

  const brand = workspace?.brandColor || 'blue';

  if (!workspace.department.permissions.activity.view) {
    return (
      <div>
        <PageHeading
          title={`${workspace?.groupName} Users`}
          disableDivide={false}
        />
        <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 mt-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            You do not have permission to view other staff
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Contact a group administrator if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  let nextSync = new Date(workspace.lastSynced || new Date());
  if (workspace?.premium?.is == true) {
    // Sync occurs every 30 minutes for premium workspaces and non premium is every 12 hours. The sync tool runs every 5 minutes at 0,5,10,15,20,25,30,35,40,45,50,55 minutes after the hour
    nextSync.setMinutes(nextSync.getMinutes() + 30);
  } else {
    nextSync.setHours(nextSync.getHours() + 12);
  }
  if (!workspace.lastSynced) {
    nextSync.setMinutes(new Date().getMinutes() + 5);
  }

  const loadedCount = allMembers.length;
  // What ReAdmin actually tracks for this role. The sidebar badge shows the
  // Roblox count instead, which is higher whenever members hold several roles —
  // using it here made the list claim members it could never load.
  const totalInRole =
    (members?.pages?.[members.pages.length - 1] as any)?.total ?? loadedCount;
  const hasMore = !!hasNextPage;

  return (
    <NoSSR>
      <PageHeading
        title={`${workspace?.groupName || ''} Users`}
        description={'View and manage tracked users'}
        disableDivide={true}
      />

      <div className="mt-3">
        <GlobalUserSearch workspace={workspace} router={router} />
      </div>

      <div className="grid grid-cols-6 gap-4 mt-4">
        <RoleSidebar
          roles={workspace.roles}
          searchRole={searchRole}
          onSelectRole={(role) => {
            setSelectedRole(role);
            setCursor('');
            setMemberQuery('');
          }}
          workspace={workspace}
          nextSync={nextSync}
        />

        <div className="flex flex-col col-span-6 lg:col-span-4 xl:col-span-5 gap-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder={`Filter ${searchRole?.name || 'role'} members…`}
                className={`w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-${brand}-500/50 focus:border-${brand}-500 transition`}
              />
              {memberQuery && (
                <button
                  onClick={() => setMemberQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={`text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-${brand}-500/50 focus:border-${brand}-500 transition`}
            >
              <option value="recent">Recently joined</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
            </select>

            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
              <button
                onClick={() => setView('grid')}
                aria-label="Grid view"
                className={`p-2.5 transition ${
                  view === 'grid'
                    ? `bg-${brand}-500 text-white`
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                aria-label="List view"
                className={`p-2.5 transition ${
                  view === 'list'
                    ? `bg-${brand}-500 text-white`
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Result summary */}
          {!!members?.pages && (
            <div className="flex items-center justify-between px-0.5 -mt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {memberQuery ? (
                  <>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {visibleMembers.length.toLocaleString()}
                    </span>{' '}
                    match · {loadedCount.toLocaleString()} loaded
                  </>
                ) : (
                  <>
                    Showing{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {loadedCount.toLocaleString()}
                    </span>{' '}
                    of {totalInRole.toLocaleString()}
                  </>
                )}
              </p>
            </div>
          )}

          {/* Members */}
          <div
            className={
              view === 'grid'
                ? 'grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-2'
                : 'flex flex-col gap-1.5'
            }
          >
            {!members?.pages &&
              Array.from({ length: 6 }).map((_, i) => (
                <MemberSkeleton key={`skeleton-${i}`} view={view} />
              ))}

            {members?.pages &&
              visibleMembers.map((member) => (
                <MemberItem
                  key={member.userId.toString()}
                  member={member}
                  view={view}
                />
              ))}
          </div>

          {/* Empty states */}
          {!!members?.pages &&
            visibleMembers.length === 0 &&
            (memberQuery ? (
              <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <MagnifyingGlassIcon className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  No loaded members match “{memberQuery}”
                </p>
                {hasMore && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Try loading more members below.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <UsersIcon className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  No members in this role yet
                </p>
              </div>
            ))}

          {isFetchingNextPage && (
            <div
              className={
                view === 'grid'
                  ? 'grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-2'
                  : 'flex flex-col gap-1.5'
              }
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <MemberSkeleton key={`more-skeleton-${i}`} view={view} />
              ))}
            </div>
          )}

          {hasMore && (
            <Button
              variant="primary"
              className="w-full"
              size="medium"
              onClick={() => {
                fetchNextPage();
              }}
            >
              {isFetchingNextPage ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner align="center" /> Loading…
                </span>
              ) : (
                `Load more (${Math.max(totalInRole - loadedCount, 0).toLocaleString()} remaining)`
              )}
            </Button>
          )}
        </div>
      </div>
    </NoSSR>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
