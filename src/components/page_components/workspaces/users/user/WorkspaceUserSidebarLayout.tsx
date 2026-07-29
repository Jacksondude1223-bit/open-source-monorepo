import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import {
  ClockIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  UserCircleIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import UserHeaderImage from './UserHeaderImage';
import { trpc } from '~/utils/trpc';
import { useWorkspace } from '~/components/contexts/workspace';

export default function WorkspaceUserSidebarLayout({
  children,
  disablePadding,
}: {
  children: ReactNode;
  disablePadding?: boolean;
}) {
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;

  const workspace = useWorkspace();
  const { data: userInfo } =
    trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery(
      { groupId, userId },
      { enabled: !!groupId && !!userId },
    );

  const tcPerms = workspace?.department?.permissions;
  const showTimeclock =
    workspace?.timeclockSettings?.enabled === true &&
    (tcPerms?.admin || tcPerms?.timeclock?.view || tcPerms?.timeclock?.manage || tcPerms?.timeclock?.edit);

  return (
    <WorkspaceWithExtraSidebarLayout
      disablePadding={disablePadding}
      title={userInfo?.robloxInfo?.name || 'User'}
      tabs={[
        {
          name: 'Info',
          href: `/workspaces/${groupId}/users/${userId}`,
          icon: InformationCircleIcon,
          current: false,
        },
        {
          name: 'Activity',
          href: `/workspaces/${groupId}/users/${userId}/activity`,
          icon: ClockIcon,
          current: false,
        },
        ...(showTimeclock
          ? [
              {
                name: 'Timeclock',
                href: `/workspaces/${groupId}/users/${userId}/timeclock`,
                icon: ClockIcon,
                current: false,
              },
            ]
          : []),
        {
          name: 'Logging',
          href: `/workspaces/${groupId}/users/${userId}/logging`,
          icon: UserCircleIcon,
          current: false,
        },
        {
          name: 'Notes',
          href: `/workspaces/${groupId}/users/${userId}/notes`,
          icon: PencilSquareIcon,
          current: false,
        },
        {
          name: 'Records',
          href: `/workspaces/${groupId}/users/${userId}/records`,
          icon: FolderIcon,
          current: false,
        },
      ]}
    >
      <div className="mb-6 mt-4">
        <UserHeaderImage />
      </div>
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
