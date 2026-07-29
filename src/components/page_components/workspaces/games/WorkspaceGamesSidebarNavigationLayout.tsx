/* eslint-disable @next/next/no-img-element */
import { ServerStackIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { JSX } from 'react';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import WorkspaceUpsale from '../settings/billing/Upsale';
import {
  WorkspaceSidebarTabType,
  WorkspaceWithExtraSidebarLayout,
} from '../../WorkspaceWithExtraSidebarLayout';

export default function WorkspaceGamesSidebarNavigationLayout({
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
            Advanced Activity Monitoring, Synchronized Bans, and Effortless Remote-Admin Controls (including Kick, Ban, Notify) - all in Real-Time.{' '}
          </h1>
          <img
            src="https://readmin.app/app/games.png"
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
      name: 'Games',
      href: `/workspaces/${groupId}/games`,
      icon: ServerStackIcon,
      current: false,
      canShow: true,
    },
    {
      name: 'Bans',
      href: `/workspaces/${groupId}/games/bans`,
      icon: NoSymbolIcon,
      current: false,
      canShow: true,
    },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout
      title={`${workspace?.groupName || 'Workspace'} Games`}
      tabs={tabs}
    >
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
