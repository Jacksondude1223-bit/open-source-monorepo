'use client';

import { PlusCircleIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { useState, PropsWithChildren, ReactElement } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSidebarNavigationLayout';
import Card from '~/components/ui/Card';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import GroupRolesDropdown from '~/components/ui/GroupRolesDropdown';
import Modal from '~/components/ui/Modal';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { v4 } from 'uuid';
import { SessionRoles } from '~/services/NewMongoTypes';
import { SessionRole } from '~/services/NewMongoTypes/SessionRoles.type';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const [creatingRole, setCreatingRole] = useState(false);
  const { data: roles } =
    trpc.workspaces.workspace.sessions.roles.getRoles.useQuery({ groupId });
  const createRoleMutation =
    trpc.workspaces.workspace.sessions.roles.createRole.useMutation();
  const context = trpc.useUtils();

  if (!roles) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <LoadingPage />
      </>
    );
  }
  const permissions = workspace.department.permissions.sessions;

  if (!permissions.manage) {
    return (
      <>

        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">You don&apos;t have permission to manage sessions</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">If you believe this is a mistake, contact one of your group admins.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Sessions`}
        description="Define reusable role groups and their sub-roles that members can claim during sessions."
        disableDivide={true}
      />

      <div className="animate-in fade-in slide-in-from-left grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 mt-2">
        {roles.map((role) => (
          <RoleType key={role._id.toString()} role={role} groupId={groupId} />
        ))}

        <EmptyCardCreateState
          icon={PlusCircleIcon}
          buttonText="Create a new role"
          className="min-h-40 flex flex-col items-center justify-center"
          cbFunction={() => {
            setCreatingRole(true);
          }}
        />
      </div>

      <Modal open={creatingRole} setOpen={setCreatingRole}>
        <PageHeading title="Create a Role Group" />
        <form
          className="flex flex-col gap-2"
          onSubmit={async (f) => {
            f.preventDefault();
            const target = f.target as any;
            const name = target.name.value;
            createRoleMutation
              .mutateAsync({
                groupId,
                name,
              })
              .then(() => {
                context.workspaces.workspace.sessions.roles.getRoles.invalidate({ groupId });
                toast.success('Successfully created new role')
                setCreatingRole(false);
              })
              .catch((e) => {
                alert(e.reason);
              });
          }}
        >
          <TextLabel label="Name" id="name" placeholder="Type a name" />
          <Button variant="primary" className="w-full" size="medium">
            Create
          </Button>
        </form>
      </Modal>
    </>
  );
}

function CollapsableThingSettings({
  settings,
  role,
  groupId,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setSettings = () => { },
}: PropsWithChildren<{
  settings: SessionRoles;
  role: SessionRole;
  groupId: string;
  setSettings: (a: SessionRoles) => void;
}>) {

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextLabel
          onBlur={(value: string) => {
            setSettings({
              ...settings,
              roles: settings.roles.map((r) => {
                if (role.id !== r.id) {
                  return r;
                }
                return {
                  ...r,
                  maxUsers: parseInt(value || '0'),
                };
              }),
            });
          }}
          label="Max Users"
          id="maxUsers"
          type="number"
          min="0"
          placeholder="0 = unlimited"
          className="w-full"
          defaultValue={role.maxUsers.toString()}
        />
        <GroupRolesDropdown
          onChange={(value: string) => {
            const didIChange = role.minRank !== parseInt(value || '0');
            if (!didIChange) {
              return;
            }
            setSettings({
              ...settings,
              roles: settings.roles.map((r) => {
                if (role.id !== r.id) {
                  return r;
                }
                return {
                  ...r,
                  minRank: parseInt(value || '0'),
                };
              }),
            });
          }}
          label="Minimum Rank"
          groupId={groupId}
          defaultValue={role.minRank.toString()}
        />
      </div>
      <Toggle
        onChange={(value: boolean) => {
          setSettings({
            ...settings,
            roles: settings.roles.map((r) => {
              if (role.id !== r.id) {
                return r;
              }
              return {
                ...r,
                claimOnce: value,
              };
            }),
          });
        }}
        id="claimOnce"
        value={role.claimOnce == true}
        description="When on, a non-admin can only hold this role once across the session (first come, first serve)."
        title="Claim once only"
      />
    </div>
  )
}
function CollapsableThing({
  settings,
  role,
  groupId,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setSettings = () => { },
}: PropsWithChildren<{
  settings: SessionRoles;
  role: SessionRole;
  groupId: string;
  setSettings: (a: SessionRoles) => void;
}>) {
  return (
    <details className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 overflow-hidden">
      <summary className="flex justify-between items-center gap-2 px-3 py-2.5 cursor-pointer list-none hover:bg-gray-100/70 dark:hover:bg-gray-800/60 transition">
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDownIcon className="w-4 h-4 shrink-0 text-gray-400 transition group-open:rotate-180" />
          <span className="font-medium truncate dark:text-gray-100">{role.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-md bg-gray-200/70 dark:bg-gray-700 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {role.maxUsers === 0 ? '∞' : role.maxUsers} max
          </span>
          {role.claimOnce && (
            <span className="rounded-md bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              once
            </span>
          )}
          <button
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition"
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              const filtered = settings.roles.filter(r => r.id !== role.id);
              setSettings({ ...settings, roles: filtered });
            }}
            title="Delete sub-role"
          >
            <TrashIcon className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700">
        <CollapsableThingSettings settings={settings} role={role} groupId={groupId} setSettings={setSettings} />
      </div>
    </details>
  );
}

function RoleType({
  role,
  groupId,
}: PropsWithChildren<{
  role: SessionRoles;
  groupId: string;
}>) {
  const [settings, setSettings] = useState<SessionRoles>(role);
  const updateRoleMutation =
    trpc.workspaces.workspace.sessions.roles.updateRole.useMutation();
  const deleteRoleMutation =
    trpc.workspaces.workspace.sessions.roles.deleteRole.useMutation();
  const context = trpc.useUtils();

  const isDirty = JSON.stringify(settings) !== JSON.stringify(role);

  return (
    <Card className="flex flex-col gap-3 justify-between">
      <div className="flex flex-row items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
        <input
          className="grow min-w-0 text-base font-semibold bg-transparent rounded-md px-2 py-1 -ml-2 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:text-gray-100 transition"
          placeholder="Role group name"
          defaultValue={settings.name}
          onBlur={(e) => {
            setSettings({
              ...settings,
              name: e.target.value,
            });
          }}
        />
        <Button
          variant="light_danger"
          size="medium"
          icon={TrashIcon}
          onClick={async () => {
            deleteRoleMutation
              .mutateAsync({
                groupId,
                roleId: settings.id,
              })
              .then(() => {
                context.workspaces.workspace.sessions.roles.getRoles.invalidate({ groupId });
                toast.success('Successfully deleted role')
              })
              .catch((e) => {
                alert(e.message);
              });
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Sub-roles · {settings.roles.length}
        </p>
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-0.5">
          {settings.roles.length === 0 && (
            <p className="text-sm italic text-gray-400 dark:text-gray-500 py-2 text-center rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              No sub-roles yet. Add one below.
            </p>
          )}
          {settings.roles.map((sRole) => (
            <CollapsableThing
              key={sRole.id}
              groupId={groupId}
              settings={settings}
              setSettings={setSettings}
              role={sRole}
            />
          ))}
        </div>
        <form
          className="flex flex-row gap-2 mt-1"
          onSubmit={async (f) => {
            f.preventDefault();
            const target = f.target as any;
            const name = target.name.value;
            if (!name?.trim()) return;
            setSettings({
              ...settings,
              roles: [
                ...settings.roles,
                { id: v4(), name, maxUsers: 1, minRank: 0, claimOnce: false },
              ],
            });
            target.reset();
          }}
        >
          <TextLabel id="name" placeholder="New sub-role name" disableMt={true} className="w-full" />
          <Button variant="blue" size="medium" icon={PlusCircleIcon}>
            Add
          </Button>
        </form>
      </div>

      <Button
        variant="primary"
        size="medium"
        disabled={!isDirty}
        onClick={async () => {
          const action = new Promise<void>((resolve, reject) => {
            updateRoleMutation
              .mutateAsync({
                groupId,
                roleId: settings.id,
                name: settings.name,
                roles: settings.roles,
              })
              .then(() => {
                context.workspaces.workspace.sessions.roles.getRoles.invalidate({ groupId });
                resolve();
              })
              .catch((e) => {
                reject(e);
              });
          });

          toast.promise(action, {
            loading: 'Saving role',
            success: 'Successfully saved role',
            error: 'Failed to save role',
          });
        }}
      >
        {isDirty ? 'Save changes' : 'Saved'}
      </Button>
    </Card>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSidebarNavigationLayout>{page}</WorkspaceSessionsSidebarNavigationLayout>
);
