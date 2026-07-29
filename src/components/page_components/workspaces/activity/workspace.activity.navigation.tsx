import { usePathname } from 'next/navigation';
import {
  BellAlertIcon,
  ChartBarIcon,
  UsersIcon,
} from '@heroicons/react/24/solid';
import React, { PropsWithChildren } from 'react';
import PageNav from '~/components/layouts/PageNav';

export default function WorkspaceActivityNavigation({
  groupId,
  children,
}: PropsWithChildren<{
  groupId: string;
}>) {
  const path = usePathname();

  const UsersUrl = `/workspaces/${groupId}/activity`;
  const InactivityUrl = `/workspaces/${groupId}/activity/inactivity`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Users',
      href: UsersUrl,
      icon: UsersIcon,
      current: path == UsersUrl || path?.startsWith(`${UsersUrl}/roles`),
    },
    {
      name: 'Inactivity',
      href: InactivityUrl,
      icon: BellAlertIcon,
      current: path?.startsWith(InactivityUrl),
    },
    // {
    //   name: 'Stats',
    //   href: StatsUrl,
    //   icon: ChartBarIcon,
    //   current: path?.startsWith(StatsUrl),
    // },
  ];

  return <PageNav tabs={tabs}>{children}</PageNav>;
}
