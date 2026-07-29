import { usePathname } from 'next/navigation';
import {
  CalendarDaysIcon,
  PlayIcon,
  UserCircleIcon,
} from '@heroicons/react/24/solid';
import PageNav from '~/components/layouts/PageNav';

export default function WorkspaceSessionsNavigation({
  groupId,
}: {
  groupId: string;
}) {
  const path = usePathname();

  const SessionsUrl = `/workspaces/${groupId}/sessions`;
  const ScheduleUrl = `/workspaces/${groupId}/sessions/schedule`;
  const RoleUrl = `/workspaces/${groupId}/sessions/roles`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Sessions',
      href: SessionsUrl,
      icon: PlayIcon,
      current: path == SessionsUrl,
    },
    {
      name: 'Schedule',
      href: ScheduleUrl,
      icon: CalendarDaysIcon,
      current: path.startsWith(ScheduleUrl),
    },
    {
      name: 'Role Groups',
      href: RoleUrl,
      icon: UserCircleIcon,
      current: path.startsWith(RoleUrl),
    },
  ];

  return <PageNav tabs={tabs} />;
}
