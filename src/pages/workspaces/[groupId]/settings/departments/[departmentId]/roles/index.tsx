'use client';

import { LockClosedIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import DepartmentLayout from '~/components/page_components/DepartmentLayout';
import TogglableCard from '~/components/ui/ToggleableCard';
import MagicToggleForAbsoloute from '~/components/forms/MagicToggleForAbsoloute';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, departmentId }: { groupId: string; departmentId: string } =
    router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const { data: departmentInfo } =
    trpc.workspaces.workspace.settings.departments.getDepartmentById.useQuery({
      groupId,
      departmentId,
    });
  const setRolesMutation =
    trpc.workspaces.workspace.settings.departments.setDepartmentRoles.useMutation();
  const { data: roleAssignments } =
    trpc.workspaces.workspace.settings.departments.getRoleAssignments.useQuery({
      groupId,
    });
  const context = trpc.useUtils();

  // Optimistic local state so toggles feel instant instead of waiting on the
  // server round-trip. Synced whenever the query data changes.
  const [selectedRanks, setSelectedRanks] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (departmentInfo) {
      setSelectedRanks(new Set(departmentInfo.roles.map((role) => role.rankId)));
    }
  }, [departmentInfo]);

  if (!user || !workspace || !departmentInfo) {
    return <LoadingPage />;
  }

  const roles = workspace.roles ?? [];

  // Map of rankId -> department name for roles already claimed by ANOTHER
  // department. These are locked here (a role belongs to one department).
  const lockedByOther = new Map<number, string>();
  for (const assignment of roleAssignments ?? []) {
    if (assignment.departmentId !== departmentId) {
      lockedByOther.set(assignment.rankId, assignment.departmentName);
    }
  }

  const invalidate = () => {
    context.workspaces.workspace.settings.departments.getDepartmentById.invalidate({
      groupId,
      departmentId,
    });
    context.workspaces.workspace.settings.departments.getRoleAssignments.invalidate({
      groupId,
    });
  };

  const applyRoles = (rankIds: number[]) => {
    setRolesMutation
      .mutateAsync({ groupId, departmentId, rankIds })
      .then(() => {
        invalidate();
      })
      .catch((error) => {
        toast.error(error.message);
        // Revert optimistic state on failure.
        invalidate();
      });
  };

  const toggleRole = (rank: number, value: boolean) => {
    if (lockedByOther.has(rank)) return;
    const next = new Set(selectedRanks);
    if (value) {
      next.add(rank);
    } else {
      next.delete(rank);
    }
    setSelectedRanks(next);
    applyRoles(Array.from(next));
  };

  const toggleAll = (value: boolean) => {
    // Never touch roles locked by another department.
    const next = value
      ? new Set(roles.filter((role) => !lockedByOther.has(role.rank)).map((role) => role.rank))
      : new Set<number>();
    setSelectedRanks(next);
    applyRoles(Array.from(next));
  };

  if (departmentInfo?.isAddedBySupport){
    return (
      <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
        <p className="font-semibold text-gray-900 dark:text-gray-100">This department was created by ReAdmin support and cannot be edited.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          If you have questions about this department, please contact ReAdmin support.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Header fontSize="sm">Roles</Header>
      <Small>
        Toggle any group role on to grant everyone with that role this department&apos;s access.
        Changes save instantly.
      </Small>

      <div className="mt-3">
        {roles.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-700">
            <UserGroupIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              No group roles found
            </p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Connect your Roblox group to sync your roles.
            </p>
          </div>
        ) : (
          <TogglableCard
            title="Group roles"
            optionalHeaderChildren={
              <MagicToggleForAbsoloute
                onChange={toggleAll}
                value={roles
                  .filter((role) => !lockedByOther.has(role.rank))
                  .every((role) => selectedRanks.has(role.rank))}
              />
            }
          >
            <div className="flex flex-col gap-2">
              {roles.map((role) => {
                const lockedDept = lockedByOther.get(role.rank);
                if (lockedDept) {
                  return (
                    <div
                      key={role.rank}
                      className="flex flex-row items-center justify-between gap-3 rounded-lg opacity-70"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-md flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <LockClosedIcon className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="truncate">{role.name}</span>
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Assigned to {lockedDept}
                        </span>
                      </div>
                      <MagicToggleForAbsoloute
                        value={false}
                        disabled={true}
                        onChange={() => { }}
                      />
                    </div>
                  );
                }
                return (
                  <MagicToggleForAbsoloute
                    className="flex flex-row-reverse justify-end gap-3"
                    key={role.rank}
                    id={role.rank.toString()}
                    label={`${role.name} · ${role.memberCount} member${role.memberCount === 1 ? '' : 's'}`}
                    value={selectedRanks.has(role.rank)}
                    onChange={(value) => toggleRole(role.rank, value)}
                  />
                );
              })}
            </div>
          </TogglableCard>
        )}
      </div>
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>
    <DepartmentLayout>{page}</DepartmentLayout>
  </SettingsLayout>
);
