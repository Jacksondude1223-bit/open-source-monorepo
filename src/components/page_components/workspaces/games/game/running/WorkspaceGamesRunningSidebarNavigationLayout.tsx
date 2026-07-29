/* eslint-disable @next/next/no-img-element */
import { ServerStackIcon } from '@heroicons/react/24/outline';
import {
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import { JSX } from 'react';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import WorkspaceUpsale from '../../../settings/billing/Upsale';
import {
  WorkspaceSidebarTabType,
  WorkspaceWithExtraSidebarLayout,
} from '../../../../WorkspaceWithExtraSidebarLayout';

export default function WorkspaceGamesRunningSidebarNavigationLayout({
  children,
}: {
  children: JSX.Element;
}) {
  const workspace = useWorkspace();
  const router = useRouter();
  const {
    groupId,
    gameId,
    serverId,
  }: { groupId: string; gameId: string; serverId: string } = router.query as any;

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
      name: 'Players',
      href: `/workspaces/${groupId}/games/${gameId}/running/${serverId}`,
      icon: ServerStackIcon,
      current: false,
      canShow: true,
    },
    {
      name: 'Chat Log',
      href: `/workspaces/${groupId}/games/${gameId}/running/${serverId}/chats`,
      icon: ChatBubbleBottomCenterTextIcon,
      current: false,
      canShow: true,
    },
    {
      name: 'Information',
      href: `/workspaces/${groupId}/games/${gameId}/running/${serverId}/info`,
      icon: InformationCircleIcon,
      current: false,
      canShow: true,
    },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout
      title={`${workspace?.groupName || 'Workspace'} Server`}
      tabs={tabs}
    >
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
