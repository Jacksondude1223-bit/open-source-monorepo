/* eslint-disable @next/next/no-img-element */
import { UsersIcon } from '@heroicons/react/24/solid';
import { CogIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { JSX } from 'react';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import WorkspaceUpsale from '../settings/billing/Upsale';
import {
  WorkspaceSidebarTabType,
  WorkspaceWithExtraSidebarLayout,
} from '../../WorkspaceWithExtraSidebarLayout';

export default function WorkspaceSessionsSessionSidebarNavigationLayout({
  children,
}: {
  children: JSX.Element;
}) {
  const workspace = useWorkspace();
  const router = useRouter();
  const { groupId, sessionId }: { groupId: string; sessionId: string } =
    router.query as any;

  const { data: sessionData } =
    trpc.workspaces.workspace.sessions.v2.getSessionData.useQuery(
      { groupId, sessionId },
      { enabled: !!groupId && !!sessionId && !!workspace?.premium?.is },
    );

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
      name: 'Users',
      href: `/workspaces/${groupId}/sessions/session/${sessionId}`,
      icon: UsersIcon,
      current: false,
      canShow: true,
    },
  ];

  if (sessionData?.session?.oneOffSession) {
    tabs.push({
      name: 'Edit',
      href: `/workspaces/${groupId}/sessions/session/${sessionId}/editOneOff`,
      icon: CogIcon,
      current: false,
      canShow: true,
    });
  }

  return (
    <WorkspaceWithExtraSidebarLayout
      title={
        sessionData?.session?.template?.name
          ? `${workspace?.groupName || 'Workspace'} - ${sessionData.session.template.name}`
          : `${workspace?.groupName || 'Workspace'} Session`
      }
      tabs={tabs}
    >
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
