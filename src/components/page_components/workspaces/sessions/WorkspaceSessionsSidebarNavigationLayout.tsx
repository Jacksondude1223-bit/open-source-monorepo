/* eslint-disable @next/next/no-img-element */
import {
  CalendarDaysIcon,
  PlayIcon,
  TableCellsIcon,
  UserCircleIcon,
} from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import { JSX } from 'react';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import WorkspaceUpsale from '../settings/billing/Upsale';
import {
  WorkspaceSidebarTabType,
  WorkspaceWithExtraSidebarLayout,
} from '../../WorkspaceWithExtraSidebarLayout';

export default function WorkspaceSessionsSidebarNavigationLayout({
  children,
}: {
  children: JSX.Element;
}) {
  const workspace = useWorkspace();
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  if (!workspace?.premium?.is) {
    return (
      <WorkspaceLayout disableMl={false}>
        <div className="flex flex-col gap-2 mt-2">
          <h1 className="my-4 text-2xl font-bold text-center">
            Advanced session logging
          </h1>
          <img
            src="https://readmin.app/app/sessions.png"
            className="self-center align-middle max-h-[500px] rounded-lg shadow-lg border border-gray-500"
            alt="activity upsale image"
          />
          <WorkspaceUpsale />
        </div>
      </WorkspaceLayout>
    );
  }

  const tabs: WorkspaceSidebarTabType[] = [
    {
      name: 'Sessions',
      href: `/workspaces/${groupId}/sessions`,
      icon: PlayIcon,
      current: false,
      canShow: true,
    },
    {
      name: 'Schedule',
      href: `/workspaces/${groupId}/sessions/schedule`,
      icon: CalendarDaysIcon,
      current: false,
      canShow: true,
    },
    {
      name: 'Role Groups',
      href: `/workspaces/${groupId}/sessions/roles`,
      icon: UserCircleIcon,
      current: false,
      canShow: true,
    },
    {
      name: 'Attendance',
      href: `/workspaces/${groupId}/sessions/attendance`,
      icon: TableCellsIcon,
      current: false,
      canShow:
        workspace?.department?.permissions?.admin ||
        workspace?.department?.permissions?.sessions?.attendance ||
        false,
    },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout
      title={`${workspace?.groupName || 'Workspace'} Sessions`}
      tabs={tabs}
    >
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
