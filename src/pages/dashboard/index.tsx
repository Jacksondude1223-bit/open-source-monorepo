"use client";

/* eslint-disable @next/next/no-img-element */
import {
  ArrowRightIcon,
  PlusIcon,
  ServerStackIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { ReactElement, useMemo } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import StatCard from '~/components/ui/StatCard';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import posthog from 'posthog-js'
import { useRouter } from 'next/router'

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { data: workspaces } = trpc.workspaces.getUsersWorkspaces.useQuery();
  const info = useUser();
  const router = useRouter();

  const displayName =
    !('loading' in info) && info.loggedIn
      ? info.user.roblox?.displayName ?? info.user.discord?.global_name ?? info.user.discord?.username
      : undefined;

  const avatar = !('loading' in info) && info.loggedIn ? info.user.thumbnail : undefined;

  const stats = useMemo(() => {
    if (!workspaces) return { totalMembers: 0, departments: 0 };
    const totalMembers = workspaces.reduce(
      (acc, ws) => acc + ws.roles.reduce((a, role) => a + role.memberCount, 0),
      0,
    );
    const departments = new Set(
      workspaces.map((ws) => ws.department?.name).filter(Boolean),
    ).size;
    return { totalMembers, departments };
  }, [workspaces]);

  if (!workspaces) {
    return <LoadingPage />;
  }

  const hasWorkspaces = workspaces.length !== 0;

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="fade-in animate-in slide-in-from-top relative overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-blue-600 via-blue-600 to-indigo-700 px-6 py-7 text-white shadow-sm dark:border-gray-700 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-indigo-400/20 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            {avatar && (
              <img
                src={avatar}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border-2 border-white/40 bg-white/20 shadow-md"
              />
            )}
            <div>
              <p className="text-sm font-medium text-blue-100">
                {getGreeting()}{displayName ? ',' : ''}
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {displayName ?? 'Welcome back'}
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                {hasWorkspaces
                  ? `You're in ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}.`
                  : 'Create your first workspace to get started.'}
              </p>
            </div>
          </div>
          <Link
            href="/workspaces/create"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition-all hover:bg-white hover:shadow-md"
          >
            <PlusIcon className="h-5 w-5" />
            New Workspace
          </Link>
        </div>
      </div>

      {/* Stats overview */}
      {hasWorkspaces && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <StatCard
            label="Workspaces"
            value={workspaces.length.toLocaleString()}
            icon={Squares2X2Icon}
            accent="blue"
          />
          <StatCard
            label="Total Members"
            value={stats.totalMembers.toLocaleString()}
            icon={UsersIcon}
            accent="green"
          />
          <StatCard
            label="Departments"
            value={stats.departments.toLocaleString()}
            icon={ServerStackIcon}
            accent="violet"
          />
        </div>
      )}

      {/* Workspaces grid */}
      <div>
        {hasWorkspaces && (
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your Workspaces
          </h2>
        )}

        <div
          role="list"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {workspaces.map((workspace) => {
            const memberCount = workspace.roles.reduce(
              (acc, role) => acc + role.memberCount,
              0,
            );
            return (
              <Link
                href={`/workspaces/${workspace.groupId}`}
                onClick={() => {
                  router.push(`/workspaces/${workspace.groupId}`);
                  try {
                    posthog.capture('view-workspace', { groupId: workspace.groupId })
                    posthog.group('workspace', workspace.groupId, { name: workspace?.groupName })
                  } catch {
                    // analytics is best-effort; never block navigation
                  }
                }}
                key={workspace.groupId}
                className="fade-in animate-in slide-in-from-bottom group relative col-span-1 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-800/80 dark:hover:border-blue-700/60"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-500 to-indigo-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100" aria-hidden="true" />
                <div className="flex items-center gap-4 p-5">
                  <img
                    className="h-14 w-14 shrink-0 rounded-xl border border-gray-200 bg-gray-100 object-cover dark:border-gray-700"
                    src={workspace?.group?.thumbnail}
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-50">
                      {workspace?.groupName}
                    </h3>
                    {workspace?.department?.name && (
                      <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                        {workspace.department.name}
                      </span>
                    )}
                  </div>
                  <ArrowRightIcon className="h-5 w-5 shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600" />
                </div>
                <div className="mt-auto flex items-center gap-1.5 border-t border-gray-100 px-5 py-3 text-sm text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                  <UsersIcon className="h-4 w-4" />
                  <span>{memberCount.toLocaleString()} members</span>
                </div>
              </Link>
            );
          })}

          <Link
            href="/workspaces/create"
            className="fade-in animate-in slide-in-from-bottom group relative flex min-h-35 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/40 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-700 dark:hover:border-blue-700/60 dark:hover:bg-blue-500/5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-gray-700/60 dark:group-hover:bg-blue-500/15 dark:group-hover:text-blue-400">
              <PlusIcon className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold text-gray-500 transition-colors group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400">
              Create Workspace
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);
