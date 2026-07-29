"use client";

import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Button from '~/components/forms/Button';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import LoadingAnimation from '~/components/ui/LoadingAnimation';

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex flex-row items-center gap-2 py-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const settingsQuery =
    trpc.workspaces.workspace.sessions.attendance.getSettings.useQuery(
      { groupId },
      { refetchOnWindowFocus: false, enabled: !!groupId },
    );
  const updateMutation =
    trpc.workspaces.workspace.sessions.attendance.updateSettings.useMutation();

  const [visibleDepartmentIds, setVisibleDepartmentIds] = useState<string[]>([]);
  const [hostingRoleIds, setHostingRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (settingsQuery.data) {
      setVisibleDepartmentIds(settingsQuery.data.settings.visibleDepartmentIds);
      setHostingRoleIds(settingsQuery.data.settings.hostingRoleIds);
    }
  }, [settingsQuery.data]);

  if (!workspace) return <LoadingPage />;

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    id: string,
  ) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const save = () => {
    updateMutation
      .mutateAsync({ groupId, visibleDepartmentIds, hostingRoleIds })
      .then(() => {
        context.workspaces.workspace.sessions.attendance.getSettings.invalidate({
          groupId,
        });
        context.workspaces.workspace.sessions.attendance.getAttendanceGrid.invalidate(
          { groupId },
        );
        toast.success('Saved attendance settings');
      })
      .catch((e) => toast.error(e.message));
  };

  const data = settingsQuery.data;

  return (
    <>
      <PageHeading
        title="Attendance Settings"
        description="Choose which departments appear on the grid and which roles count as hosting."
        backUrl={`/workspaces/${groupId}/sessions/attendance`}
      />

      {settingsQuery.isLoading || !data ? (
        <div className="flex justify-center py-12">
          <LoadingAnimation />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <Card>
            <Header fontSize="sm">Visible departments</Header>
            <Small>
              Users in these departments appear as rows. Leave all unchecked to
              show every department.
            </Small>
            <div className="mt-3 flex flex-col">
              {data.departments.length === 0 ? (
                <Small>No departments exist yet.</Small>
              ) : (
                data.departments.map((d) => (
                  <CheckRow
                    key={d.id}
                    label={d.name}
                    checked={visibleDepartmentIds.includes(d.id)}
                    onChange={() =>
                      toggle(visibleDepartmentIds, setVisibleDepartmentIds, d.id)
                    }
                  />
                ))
              )}
            </div>
          </Card>

          <Card>
            <Header fontSize="sm">Hosting roles</Header>
            <Small>
              A user is marked <strong>Hosted (H)</strong> when they claim one of
              these roles and complete it. With none selected, no one is counted
              as a host.
            </Small>
            <div className="mt-3 flex flex-col gap-3">
              {data.roleGroups.length === 0 ? (
                <Small>No session role groups exist yet.</Small>
              ) : (
                data.roleGroups.map((group) => (
                  <div key={group.id}>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      {group.name}
                    </p>
                    {group.roles.map((role) => (
                      <CheckRow
                        key={role.id}
                        label={role.name}
                        checked={hostingRoleIds.includes(role.id)}
                        onChange={() =>
                          toggle(hostingRoleIds, setHostingRoleIds, role.id)
                        }
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Button
            variant="primary"
            className="w-full"
            onClick={save}
            disabled={updateMutation.isPending}
          >
            Save Settings
          </Button>
        </div>
      )}
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSidebarNavigationLayout>
    {page}
  </WorkspaceSessionsSidebarNavigationLayout>
);
