'use client';

import { useRouter } from 'next/router';
import { JSX, ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  UsersIcon,
  ChartBarIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import { useWorkspace } from '~/components/contexts/workspace';
import { RouterOutput, trpc } from '~/utils/trpc';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { teamsTabs } from '~/components/page_components/teamsTabs';
import { useConfirm } from '~/components/ui/ConfirmModal';
import Link from 'next/link';

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Inline role editor row ───────────────────────────────────────────────────
function RoleRow({
  role,
  groupId,
  teamId,
  onDone,
}: {
  role: { id: string; name: string; isLead: boolean };
  groupId: string;
  teamId: string;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [isLead, setIsLead] = useState(role.isLead);
  const [confirm, ConfirmDialog] = useConfirm();
  const updateRole = trpc.workspaces.workspace.teams.teams.updateRole.useMutation();
  const removeRole = trpc.workspaces.workspace.teams.teams.removeRole.useMutation();

  const handleSave = async () => {
    await toast.promise(
      updateRole.mutateAsync({ groupId, teamId, roleId: role.id, name, isLead }),
      { loading: 'Saving...', success: 'Role updated!', error: (e) => e?.message ?? 'Failed.' },
    );
    setEditing(false);
    onDone();
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: `Delete “${role.name}” role?`, body: 'Members with this role will need to be reassigned.', confirmText: 'Delete Role', destructive: true }))) return;
    await toast.promise(
      removeRole.mutateAsync({ groupId, teamId, roleId: role.id }),
      { loading: 'Deleting...', success: 'Role deleted.', error: (e) => e?.message ?? 'Failed.' },
    );
    onDone();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={() => setIsLead(!isLead)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            isLead
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border border-gray-300 dark:border-gray-600'
          }`}
        >
          {isLead ? '★ Lead' : 'Member'}
        </button>
        <Button variant="primary" size="small" icon={CheckIcon} onClick={handleSave} disabled={updateRole.isPending}>
          Save
        </Button>
        <Button variant="discrete" size="small" icon={XMarkIcon} onClick={() => { setEditing(false); setName(role.name); setIsLead(role.isLead); }}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{role.name}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          role.isLead
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        {role.isLead ? '★ Lead' : 'Member'}
      </span>
      <Button variant="discrete" size="small" icon={PencilIcon} onClick={() => setEditing(true)} />
      <Button variant="light_danger" size="small" icon={TrashIcon} onClick={handleDelete} disabled={removeRole.isPending} />
      {ConfirmDialog}
    </div>
  );
}

// ── Add role form ────────────────────────────────────────────────────────────
function AddRoleForm({ groupId, teamId, onDone }: { groupId: string; teamId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isLead, setIsLead] = useState(false);
  const addRole = trpc.workspaces.workspace.teams.teams.addRole.useMutation();

  const handleAdd = async () => {
    if (!name.trim()) return toast.error('Role name is required.');
    await toast.promise(
      addRole.mutateAsync({ groupId, teamId, name: name.trim(), isLead }),
      { loading: 'Adding role...', success: 'Role added!', error: (e) => e?.message ?? 'Failed.' },
    );
    setName('');
    setIsLead(false);
    setOpen(false);
    onDone();
  };

  if (!open) {
    return (
      <Button variant="discrete" icon={PlusIcon} onClick={() => setOpen(true)} className="w-full justify-center border border-dashed">
        Add Role
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Role name..."
        className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setOpen(false); }}
      />
      <button
        onClick={() => setIsLead(!isLead)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
          isLead
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border border-gray-300 dark:border-gray-600'
        }`}
      >
        {isLead ? '★ Lead' : 'Member'}
      </button>
      <Button variant="primary" size="small" icon={CheckIcon} onClick={handleAdd} disabled={addRole.isPending}>
        Add
      </Button>
      <Button variant="discrete" size="small" icon={XMarkIcon} onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

// ── Add department form ──────────────────────────────────────────────────────
function AddDepartmentForm({
  groupId,
  teamId,
  roles,
  onDone,
  departments,
}: {
  groupId: string;
  teamId: string;
  roles: { id: string; name: string; isLead: boolean }[];
  onDone: () => void;
  departments: Array<{ _id?: any; name: string }> | undefined;
}) {
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const [isAdding, setIsAdding] = useState(false);
  const linkDepartment = trpc.workspaces.workspace.teams.members.linkDepartment.useMutation();

  const departmentChoices = (departments || []).map((d) => ({
    name: d.name,
    id: d._id?.toString() || '',
  }));

  const handleAdd = async () => {
    if (selectedDepartments.length === 0) return toast.error('Select at least one department.');
    setIsAdding(true);
    let successCount = 0;
    for (const deptId of selectedDepartments) {
      try {
        await linkDepartment.mutateAsync({ groupId, teamId, departmentId: deptId, roleId });
        successCount++;
      } catch (e: any) {
        toast.error(`Failed to link department: ${e?.message || 'Unknown error'}`);
      }
    }
    setIsAdding(false);
    if (successCount > 0) {
      toast.success(`Linked ${successCount} department${successCount > 1 ? 's' : ''}!`);
      setSelectedDepartments([]);
      onDone();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <MultiSelectDropdown
          label="Select Departments"
          choices={departmentChoices}
          placeholder="Click to select department(s)..."
          value={selectedDepartments}
          onSelectChoice={setSelectedDepartments}
        />
        <p className="mt-2 text-xs text-gray-400">Members in selected departments will automatically be part of this team with the role below.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role for Department Members</label>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} {r.isLead ? '(Lead)' : ''}
            </option>
          ))}
        </select>
      </div>
      <Button
        variant="primary"
        icon={PlusIcon}
        onClick={handleAdd}
        disabled={isAdding || linkDepartment.isPending || selectedDepartments.length === 0}
        className="w-full justify-center"
      >
        {selectedDepartments.length === 0 ? 'Select departments first' : `Link ${selectedDepartments.length} Department${selectedDepartments.length > 1 ? 's' : ''}`}
      </Button>
    </div>
  );
}

// ── Add members by Roblox group role ─────────────────────────────────────────
function AddGroupRoleForm({
  groupId,
  teamId,
  roles,
  onDone,
}: {
  groupId: string;
  teamId: string;
  roles: { id: string; name: string; isLead: boolean }[];
  onDone: () => void;
}) {
  const [robloxRoleId, setRobloxRoleId] = useState<number | null>(null);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const { data: groupRoles, isLoading: loadingGroupRoles } = trpc.workspaces.workspace.teams.members.getGroupRoles.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const linkGroupRole = trpc.workspaces.workspace.teams.members.linkGroupRole.useMutation();

  const handleAdd = async () => {
    if (!robloxRoleId) return toast.error('Select a Roblox group role.');
    if (!roleId) return toast.error('Select a team role.');
    await toast.promise(
      linkGroupRole.mutateAsync({ groupId, teamId, robloxRoleId, roleId }),
      {
        loading: 'Linking group role...',
        success: 'Role linked! Members will be resolved automatically.',
        error: (e) => e?.message ?? 'Failed.',
      },
    );
    setRobloxRoleId(null);
    onDone();
  };

  if (loadingGroupRoles) {
    return <p className="text-sm text-gray-400">Loading Roblox group roles...</p>;
  }

  if (!groupRoles || groupRoles.length === 0) {
    return <p className="text-sm text-gray-500">No roles found in the Roblox group.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Roblox Group Role</label>
        <select
          value={robloxRoleId ?? ''}
          onChange={(e) => setRobloxRoleId(parseInt(e.target.value) || null)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Pick a role —</option>
          {groupRoles.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name} {r.memberCount != null ? `(${r.memberCount} members)` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-gray-400">Members in this Roblox group role will automatically be part of the team.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Team Role</label>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} {r.isLead ? '(Lead)' : ''}
            </option>
          ))}
        </select>
      </div>
      <Button
        variant="primary"
        icon={PlusIcon}
        onClick={handleAdd}
        disabled={linkGroupRole.isPending || !robloxRoleId}
        className="w-full justify-center"
      >
        {robloxRoleId ? 'Link Role' : 'Select a role first'}
      </Button>
    </div>
  );
}

// ── Linked sources (list + remove existing role links) ───────────────────────
function LinkedSourcesSection({
  groupId,
  teamId,
  roles,
  departments,
}: {
  groupId: string;
  teamId: string;
  roles: { id: string; name: string; isLead: boolean }[];
  departments: Array<{ _id?: any; name: string }> | undefined;
}) {
  const [confirm, ConfirmDialog] = useConfirm();
  const { data: links, refetch } = trpc.workspaces.workspace.teams.members.getRoleLinks.useQuery(
    { groupId, teamId },
    { enabled: !!groupId && !!teamId },
  );
  const { data: groupRoles } = trpc.workspaces.workspace.teams.members.getGroupRoles.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const removeRoleLink = trpc.workspaces.workspace.teams.members.removeRoleLink.useMutation();

  const handleRemove = async (linkId: string, label: string) => {
    if (!(await confirm({
      title: 'Remove linked source?',
      body: `Members from ${label} will no longer be auto-added to this team. Directly-added members are unaffected.`,
      confirmText: 'Remove Link',
      destructive: true,
    }))) return;
    await toast.promise(
      removeRoleLink.mutateAsync({ groupId, linkId }),
      { loading: 'Removing link...', success: 'Link removed.', error: (e) => e?.message ?? 'Failed.' },
    );
    refetch();
  };

  const roleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? 'Unknown role';

  const sourceLabel = (link: any): string => {
    if (link.sourceType === 'department') {
      const dept = (departments ?? []).find((d) => d._id?.toString() === link.departmentId?.toString());
      return `Department: ${dept?.name ?? 'Unknown'}`;
    }
    const gr = (groupRoles ?? []).find((r: any) => r.id === link.robloxRoleId);
    return `Roblox role: ${gr?.name ?? `#${link.robloxRoleId}`}`;
  };

  if (!links || links.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No linked sources yet. Use “Bulk Add Members” below to link a department or Roblox role so its members are kept in sync automatically.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((link: any) => (
        <div
          key={link._id?.toString()}
          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{sourceLabel(link)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Assigned as: {roleName(link.roleId)}</p>
          </div>
          <Button
            variant="light_danger"
            icon={TrashIcon}
            size="small"
            onClick={() => handleRemove(link._id!.toString(), sourceLabel(link))}
            className="shrink-0"
          >
            Remove
          </Button>
        </div>
      ))}
      {ConfirmDialog}
    </div>
  );
}

// ── Bulk add members (tabbed) ─────────────────────────────────────────────────
function BulkAddMembersSection({
  groupId,
  teamId,
  roles,
  onDone,
  departments,
}: {
  groupId: string;
  teamId: string;
  roles: { id: string; name: string; isLead: boolean }[];
  onDone: () => void;
  departments: Array<{ _id?: any; name: string }> | undefined;
}) {
  const [tab, setTab] = useState<'department' | 'group-role'>('department');

  return (
    <div>
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-fit mb-4">
        <button
          onClick={() => setTab('department')}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === 'department' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          By Department
        </button>
        <button
          onClick={() => setTab('group-role')}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === 'group-role' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          By Roblox Role
        </button>
      </div>
      {tab === 'department' ? (
        <AddDepartmentForm groupId={groupId} teamId={teamId} roles={roles} onDone={onDone} departments={departments} />
      ) : (
        <AddGroupRoleForm groupId={groupId} teamId={teamId} roles={roles} onDone={onDone} />
      )}
    </div>
  );
}

export default function TeamSettingsPage() {
  const router = useRouter();
  const { groupId, teamId } = router.query as { groupId: string; teamId: string };
  const workspace = useWorkspace();

  // Form state
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [parentTeamId, setParentTeamId] = useState<string | undefined | null>(undefined);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [confirm, ConfirmDialog] = useConfirm();

  const { data: team, refetch } = trpc.workspaces.workspace.teams.teams.getById.useQuery(
    { groupId, teamId },
    {
      enabled: !!groupId && !!teamId,
      onSuccess: (data: RouterOutput['workspaces']['workspace']['teams']['teams']['getById']) => {
        if (name === null) setName(data?.name ?? '');
        if (description === null) setDescription(data?.description ?? '');
        if (parentTeamId === undefined) setParentTeamId(data?.parentTeamId?.toString() ?? '');
      },
    } as any,
  );

  const { data: allTeams } = trpc.workspaces.workspace.teams.teams.getAll.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  const { data: departments } = trpc.workspaces.workspace.settings.departments.getDepartments.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  const updateTeam = trpc.workspaces.workspace.teams.teams.update.useMutation();
  const deleteTeamMutation = trpc.workspaces.workspace.teams.teams.delete.useMutation();

  // Sync form state once team loads
  const displayName = name ?? team?.name ?? '';
  const displayDescription = description ?? team?.description ?? '';
  const displayParentTeamId = parentTeamId === undefined ? (team?.parentTeamId?.toString() ?? '') : (parentTeamId ?? '');

  if (!workspace || !team) return <LoadingPage />;

  // Only a lead of this team (or admin / manage-all) may open team settings.
  const canManage = !!team.viewerCanManage;
  if (!canManage) {
    router.replace(`/workspaces/${groupId}/teams/${teamId}`);
    return <LoadingPage />;
  }

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await toast.promise(
        updateTeam.mutateAsync({
          groupId,
          teamId,
          name: displayName || undefined,
          description: displayDescription || undefined,
          parentTeamId: displayParentTeamId || null,
        }),
        { loading: 'Saving...', success: 'Team updated!', error: (e) => e?.message ?? 'Failed.' },
      );
      refetch();
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!(await confirm({ title: `Permanently delete “${team.name}”?`, body: 'All members will be removed and sub-teams will become top-level. This cannot be undone.', confirmText: 'Delete Team', destructive: true }))) return;
    await toast.promise(
      deleteTeamMutation.mutateAsync({ groupId, teamId }),
      { loading: 'Deleting team...', success: 'Team deleted.', error: (e) => e?.message ?? 'Failed.' },
    );
    router.push(`/workspaces/${groupId}/teams`);
  };

  const otherTeams = (allTeams ?? []).filter((t) => t._id?.toString() !== teamId);

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/workspaces/${groupId}/teams/${teamId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to {team.name}
        </Link>
      </div>

      <PageHeading title="Team Settings" description={`Configure ${team.name}`} />

      <div className="px-6 pb-6 space-y-6">
        {/* General */}
        <Section title="General" description="Basic team information">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Team name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={displayDescription}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe this team's purpose..."
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={handleSaveGeneral} disabled={savingGeneral}>
              Save Changes
            </Button>
          </div>
        </Section>

        {/* Hierarchy */}
        <Section title="Hierarchy" description="Set which team this team reports to">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent Team</label>
            <select
              value={displayParentTeamId}
              onChange={(e) => setParentTeamId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No parent (top-level team) —</option>
              {otherTeams.map((t) => (
                <option key={t._id?.toString()} value={t._id?.toString()}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-400">Changing this moves the team in the org chart.</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={handleSaveGeneral} disabled={savingGeneral}>
              Save Hierarchy
            </Button>
          </div>
        </Section>

        {/* Roles */}
        <Section title="Roles" description="Define the roles members of this team can hold">
          <div className="space-y-2">
            {team.roles.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No roles yet. Add a role to get started.
              </p>
            )}
            {team.roles.map((role) => (
              <RoleRow key={role.id} role={role} groupId={groupId} teamId={teamId} onDone={refetch} />
            ))}
            <AddRoleForm groupId={groupId} teamId={teamId} onDone={refetch} />
          </div>
        </Section>

        {/* Bulk Add Members */}
        <Section title="Bulk Add Members" description="Quickly add all members from a department or Roblox group role">
          {team.roles.length === 0 ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Create roles first</p>
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">You must define at least one role before adding members in bulk.</p>
            </div>
          ) : (
            <BulkAddMembersSection groupId={groupId} teamId={teamId} roles={team.roles} onDone={refetch} departments={departments} />
          )}
        </Section>

        {/* Linked Sources */}
        <Section title="Linked Sources" description="Departments and Roblox roles whose members are automatically synced into this team">
          <LinkedSourcesSection groupId={groupId} teamId={teamId} roles={team.roles} departments={departments} />
        </Section>

        {/* Danger Zone */}
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-200 dark:border-red-800">
            <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
          </div>
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Delete this team</p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Permanently removes the team and all its members. Sub-teams become top-level. This action cannot be undone.
              </p>
            </div>
            <Button variant="danger" icon={TrashIcon} onClick={handleDeleteTeam} disabled={deleteTeamMutation.isPending} className="shrink-0 ml-6">
              Delete Team
            </Button>
          </div>
        </div>
      </div>
      {ConfirmDialog}
    </>
  );
}

TeamSettingsPage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout title="Teams" tabs={teamsTabs(groupId)}>
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
