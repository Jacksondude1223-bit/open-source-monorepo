/* eslint-disable @next/next/no-img-element */
import { ClipboardIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';
import { useWorkspace } from '~/components/contexts/workspace';
import {
  WorkspaceSidebarTabType,
  WorkspaceWithExtraSidebarLayout,
} from '../../WorkspaceWithExtraSidebarLayout';

export default function WorkspaceFormsSidebarNavigationLayout({
  children,
  disablePadding = false,
}: PropsWithChildren<{ disablePadding?: boolean }>) {
  const workspace = useWorkspace();
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  const tabs: WorkspaceSidebarTabType[] = [
    {
      name: 'Forms',
      href: `/workspaces/${groupId}/forms`,
      icon: ClipboardIcon,
      current: false,
      canShow: true,
    },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout
      title={`${workspace?.groupName || 'Workspace'} Forms`}
      tabs={tabs}
      disablePadding={disablePadding}
    >
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
