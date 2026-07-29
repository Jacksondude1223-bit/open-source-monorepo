import { usePathname } from 'next/navigation';
import {
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  IdentificationIcon,
} from '@heroicons/react/24/solid';
import PageNav from '~/components/layouts/PageNav';

export default function WorkspaceDashboardNavigation({
  groupId,
}: {
  groupId: string;
}) {
  const path = usePathname();

  const FeedUrl = `/workspaces/${groupId}`;
  const YourActivityUrl = `/workspaces/${groupId}/personal/activity`;
  const InfoUrl = `/workspaces/${groupId}/personal/info`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Workspace Feed',
      href: FeedUrl,
      icon: ChatBubbleLeftEllipsisIcon,
      current: path == FeedUrl,
    },
    {
      name: 'Your Activity',
      href: YourActivityUrl,
      icon: ClockIcon,
      current: path.startsWith(YourActivityUrl),
    },
    // {
    //   name: 'Your Info',
    //   href: InfoUrl,
    //   icon: IdentificationIcon,
    //   current: path.startsWith(InfoUrl),
    // },
  ];

  return <PageNav tabs={tabs} />;
}
