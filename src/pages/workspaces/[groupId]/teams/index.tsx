'use client';

import { UserGroupIcon, PlusIcon, UsersIcon, ChevronRightIcon, MagnifyingGlassIcon, Squares2X2Icon, RectangleStackIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JSX, ReactElement, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import Modal from '~/components/ui/Modal';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import OrgChartView from '~/components/ui/OrgChartView';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { teamsTabs } from '~/components/page_components/teamsTabs';

function CreateTeamModal({
  open,
  setOpen,
  groupId,
  teams,
  onCreated,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  teams: { _id?: any; name: string }[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentTeamId, setParentTeamId] = useState('');
  const createTeam = trpc.workspaces.workspace.teams.teams.create.useMutation();

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error('Team name is required.');
    await toast.promise(
      createTeam.mutateAsync({
        groupId,
        name: name.trim(),
        description: description.trim() || undefined,
        parentTeamId: parentTeamId || undefined,
      }),
      {
        loading: 'Creating team...',
        success: 'Team created!',
        error: (e) => e?.message ?? 'Failed to create team.',
      },
    );
    setName('');
    setDescription('');
    setParentTeamId('');
    setOpen(false);
    onCreated();
  };

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="lg">
      <div className="px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Create Team</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing, Engineering, HR"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this team do?"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Parent Team (optional)
            </label>
            <select
              value={parentTeamId}
              onChange={(e) => setParentTeamId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None (top-level team)</option>
              {teams.map((t) => (
                <option key={t._id.toString()} value={t._id.toString()}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="discrete" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createTeam.isPending}>
            Create Team
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function TeamsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'roles'>('name');
  const [view, setView] = useState<'grid' | 'org'>('grid');

  // Allow deep-linking to the org-chart view (e.g. from the old /org-chart route).
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.view === 'org') setView('org');
  }, [router.isReady, router.query.view]);

  const { data: teams, refetch, isLoading } = trpc.workspaces.workspace.teams.teams.getAll.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  const filteredTeams = useMemo(() => {
    const list = teams ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.description ?? '').toLowerCase().includes(q),
        )
      : list;
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'members') return ((b as any).memberCount ?? 0) - ((a as any).memberCount ?? 0);
      if (sortBy === 'roles') return b.roles.length - a.roles.length;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [teams, search, sortBy]);

  if (!workspace) {
    return <LoadingPage />;
  }

  // The teams list only exposes creation controls; creating a team needs "manage all teams".
  const canManage = workspace.department.permissions.admin || workspace.department.permissions.teams?.manageAll;
  const totalMembers = (teams ?? []).reduce((sum, t) => sum + ((t as any).memberCount ?? 0), 0);
  const topLevelTeams = (teams ?? []).filter((t) => !t.parentTeamId).length;

  const setViewAndUrl = (next: 'grid' | 'org') => {
    setView(next);
    // Reflect in the URL so the view survives refresh / can be shared, without a full nav.
    router.replace(
      { pathname: router.pathname, query: { ...router.query, view: next === 'org' ? 'org' : undefined } },
      undefined,
      { shallow: true },
    );
  };

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Teams`}
        description="Manage your organizational structure, team leads, and member hierarchies."
      >
        {canManage && (
          <Button variant="primary" icon={PlusIcon} onClick={() => setCreateOpen(true)}>
            New Team
          </Button>
        )}
      </PageHeading>

      <div className="px-6 pb-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Teams', value: (teams ?? []).length },
            { label: 'Members', value: totalMembers },
            { label: 'Top-level', value: topLevelTeams },
            { label: 'Sub-teams', value: Math.max(0, (teams ?? []).length - topLevelTeams) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '—' : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Toolbar: view toggle + search/sort */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-fit shrink-0">
            <button
              onClick={() => setViewAndUrl('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                view === 'grid'
                  ? `bg-${workspace.brandColor}-500 text-white`
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Squares2X2Icon className="w-4 h-4" /> Grid
            </button>
            <button
              onClick={() => setViewAndUrl('org')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                view === 'org'
                  ? `bg-${workspace.brandColor}-500 text-white`
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <RectangleStackIcon className="w-4 h-4" /> Org Chart
            </button>
          </div>

          {view === 'grid' && (
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teams..."
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'members' | 'roles')}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Sort: Name</option>
                <option value="members">Sort: Members</option>
                <option value="roles">Sort: Roles</option>
              </select>
            </div>
          )}
        </div>

        {/* Org chart view */}
        {view === 'org' ? (
          <OrgChartView groupId={groupId} brandColor={workspace.brandColor || 'blue'} />
        ) : (
        /* Teams grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <>
              {filteredTeams.map((team) => {
                const parentName = team.parentTeamId
                  ? (teams ?? []).find((t) => t._id?.toString() === team.parentTeamId?.toString())?.name
                  : null;
                const memberCount = (team as any).memberCount ?? 0;
                return (
                  <Link
                    key={team._id?.toString()}
                    href={`/workspaces/${groupId}/teams/${team._id?.toString()}`}
                    className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md rounded-xl shadow-sm transition-all flex"
                  >
                    <div className="flex w-full flex-row items-center justify-between p-5 space-x-4">
                      <div className={`h-10 w-10 shrink-0 rounded-full bg-${workspace.brandColor}-500 flex items-center justify-center`}>
                        <UserGroupIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{team.name}</p>
                        {parentName && (
                          <p className="text-xs text-gray-400 truncate">Under: {parentName}</p>
                        )}
                        {team.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{team.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                            <UsersIcon className="w-3.5 h-3.5 text-gray-400" />
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-xs text-gray-400">{team.roles.length} role{team.roles.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition" />
                    </div>
                  </Link>
                );
              })}

              {search.trim() && filteredTeams.length === 0 && (
                <div className="col-span-full rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
                  <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No teams match &ldquo;{search}&rdquo;.</p>
                </div>
              )}

              {canManage && !search.trim() && (
                <EmptyCardCreateState
                  icon={PlusIcon}
                  buttonText="Create New Team"
                  cbFunction={() => setCreateOpen(true)}
                />
              )}
            </>
          )}
        </div>
        )}
      </div>

      {canManage && (
        <CreateTeamModal
          open={createOpen}
          setOpen={setCreateOpen}
          groupId={groupId}
          teams={teams ?? []}
          onCreated={refetch}
        />
      )}
    </>
  );
}

TeamsPage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout title="Teams" tabs={teamsTabs(groupId)}>
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
