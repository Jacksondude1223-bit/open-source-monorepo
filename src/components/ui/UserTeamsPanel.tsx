'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  UserGroupIcon,
  ChevronRightIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  StarIcon,
} from '@heroicons/react/20/solid';
import { trpc } from '~/utils/trpc';
import HeadshotForUserId from '~/components/ui/HeadshotForUserId';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';

/**
 * Self-contained "Teams & Reporting" panel for a user's profile.
 *
 * Surfaces the three things that were previously invisible on /users/[userId]:
 *  - which teams the user belongs to (and their role on each)
 *  - who they report to (manager chain)
 *  - who reports to them (direct reports)
 *
 * Every entity links straight to the relevant page so the profile becomes a
 * hub instead of a dead-end. Render only when the viewer can view teams.
 */
export default function UserTeamsPanel({
  groupId,
  userId,
  brandColor = 'blue',
}: {
  groupId: string;
  userId: string;
  brandColor?: string;
}) {
  const enabled = !!groupId && !!userId;

  const { data: teams, isLoading: teamsLoading } =
    trpc.workspaces.workspace.teams.teams.getTeamsForUser.useQuery(
      { groupId, userId },
      { enabled, retry: false, staleTime: 60 * 1000 },
    );

  const { data: managerChain, isLoading: chainLoading } =
    trpc.workspaces.workspace.teams.hierarchy.getManagerChain.useQuery(
      { groupId, userId },
      { enabled, retry: false, staleTime: 60 * 1000 },
    );

  const { data: directReports, isLoading: reportsLoading } =
    trpc.workspaces.workspace.teams.hierarchy.getDirectReports.useQuery(
      { groupId, userId },
      { enabled, retry: false, staleTime: 60 * 1000 },
    );

  const { data: allTeams } = trpc.workspaces.workspace.teams.teams.getAll.useQuery(
    { groupId },
    { enabled, retry: false, staleTime: 60 * 1000 },
  );

  const teamNameById = useMemo(
    () => new Map((allTeams ?? []).map((t) => [t._id?.toString(), t.name])),
    [allTeams],
  );

  const loading = teamsLoading || chainLoading || reportsLoading;

  const teamList = teams ?? [];
  const chain = managerChain ?? [];
  const reports = directReports ?? [];

  // Hide the whole panel if the user isn't part of any team structure — keeps
  // the profile clean for members who aren't in the teams feature at all.
  const hasAnything = loading || teamList.length > 0 || chain.length > 0 || reports.length > 0;
  if (!hasAnything) return null;

  const accent = brandColor || 'blue';
  const reportsPreview = reports.slice(0, 8);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <UserGroupIcon className="h-4 w-4" /> Teams &amp; Reporting
        </h3>
        <Link
          href={`/workspaces/${groupId}/teams`}
          className={`text-xs font-medium text-${accent}-600 hover:underline dark:text-${accent}-400`}
        >
          All teams →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/80 dark:bg-gray-800/80"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* ── Teams ─────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-800/80">
            <div className="mb-3 flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-${accent}-100 text-${accent}-600 dark:bg-${accent}-500/15 dark:text-${accent}-400`}>
                <UserGroupIcon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Teams
                <span className="ml-1.5 text-xs font-normal text-gray-400">{teamList.length}</span>
              </p>
            </div>
            {teamList.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Not a member of any team.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {teamList.map((m: any) => {
                  const team = m.team;
                  const role = team?.roles?.find((r: any) => r.id === m.roleId);
                  const teamId = m.teamId?.toString();
                  return (
                    <Link
                      key={teamId}
                      href={`/workspaces/${groupId}/teams/${teamId}`}
                      className="group flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-700/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {team?.name ?? 'Unknown team'}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {role && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                                role.isLead
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {role.isLead && <StarIcon className="h-2.5 w-2.5" />}
                              {role.name}
                            </span>
                          )}
                          {m.via && m.via !== 'direct' && (
                            <span className="text-[10px] uppercase tracking-wide text-gray-400">
                              linked
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-gray-500 dark:text-gray-600" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Reports to ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-800/80">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
                <ArrowTrendingUpIcon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reports To</p>
            </div>
            {chain.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Top of the chain — no manager above.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {chain.map((m: any, i: number) => (
                  <Link
                    key={`${m.userId}-${m.teamId}`}
                    href={`/workspaces/${groupId}/users/${m.userId}`}
                    className="group flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-700/40"
                  >
                    <HeadshotForUserId userId={m.userId} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        <TextReturnForUserId userId={m.userId} />
                      </p>
                      <p className="truncate text-[11px] text-gray-400">
                        Manager
                        {teamNameById.get(m.teamId) ? ` · ${teamNameById.get(m.teamId)}` : ''}
                      </p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-gray-500 dark:text-gray-600" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── Direct reports ────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-800/80">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <UsersIcon className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Direct Reports
                  <span className="ml-1.5 text-xs font-normal text-gray-400">{reports.length}</span>
                </p>
              </div>
            </div>
            {reports.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No direct reports.</p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {reportsPreview.map((r: any) => (
                    <Link
                      key={`${r.userId}-${r.teamId}`}
                      href={`/workspaces/${groupId}/users/${r.userId}`}
                      className="group flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-700/40"
                    >
                      <HeadshotForUserId userId={r.userId} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          <TextReturnForUserId userId={r.userId} />
                        </p>
                        <p className="truncate text-[11px] text-gray-400">
                          {teamNameById.get(r.teamId) ?? 'Team'}
                        </p>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-gray-500 dark:text-gray-600" />
                    </Link>
                  ))}
                </div>
                {reports.length > reportsPreview.length && (
                  <Link
                    href={`/workspaces/${groupId}/teams/manager?userId=${userId}`}
                    className={`mt-2 inline-block text-xs font-medium text-${accent}-600 hover:underline dark:text-${accent}-400`}
                  >
                    +{reports.length - reportsPreview.length} more · view all reports →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
