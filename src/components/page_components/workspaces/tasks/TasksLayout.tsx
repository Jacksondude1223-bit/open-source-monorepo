import {
  ViewColumnsIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';
import { useWorkspace } from '~/components/contexts/workspace';
import {
  WorkspaceSidebarTabType,
  WorkspaceWithExtraSidebarLayout,
} from '~/components/page_components/WorkspaceWithExtraSidebarLayout';

export default function TasksLayout({
  children,
  disablePadding = false,
}: PropsWithChildren<{ disablePadding?: boolean }>) {
  const workspace = useWorkspace();
  const router = useRouter();
  const path = router.asPath;

  if (!workspace?.groupId) {
    return <></>;
  }

  const groupId = workspace.groupId;
  const BoardUrl = `/workspaces/${groupId}/tasks`;
  const SettingsUrl = `/workspaces/${groupId}/tasks/settings`;
  const canManage = !!workspace?.department?.permissions?.tasks?.assign;

  const tabs: WorkspaceSidebarTabType[] = [
    {
      name: 'Board',
      href: BoardUrl,
      icon: ViewColumnsIcon,
      current: path === BoardUrl,
    },
    {
      name: 'Settings',
      href: SettingsUrl,
      icon: Cog6ToothIcon,
      current: path?.startsWith(SettingsUrl) || false,
      canShow: canManage,
    },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout
      title={`${workspace?.groupName} Tasks`}
      disablePadding={disablePadding}
      tabs={tabs}
    >
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
