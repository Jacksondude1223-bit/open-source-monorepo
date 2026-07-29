import { ServerStackIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';
import PageNav from '~/components/layouts/PageNav';

export default function WorkspaceGamesNavigation({
  groupId,
  children,
}: PropsWithChildren<{ groupId: string }>) {
  const path = usePathname();

  const GamesUrl = `/workspaces/${groupId}/games`;
  const BansUrl = `/workspaces/${groupId}/games/bans`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Games',
      href: GamesUrl,
      icon: ServerStackIcon,
      current: path == GamesUrl,
    },
    {
      name: 'Bans',
      href: BansUrl,
      icon: NoSymbolIcon,
      current: path.startsWith(BansUrl),
    },
  ];

  return <PageNav tabs={tabs}>{children}</PageNav>;
}
