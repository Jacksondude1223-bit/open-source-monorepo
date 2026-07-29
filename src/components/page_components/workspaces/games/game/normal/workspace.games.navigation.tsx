import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';
import PageNav from '~/components/layouts/PageNav';
import { Cog6ToothIcon, ServerStackIcon, UsersIcon } from '@heroicons/react/24/solid';

export default function WorkspaceGamesNormalNavigation({
  groupId,
  gameId,
  children,
}: PropsWithChildren<{ groupId: string; gameId: string }>) {
  const path = usePathname();

  const ServersUrl = `/workspaces/${groupId}/games/${gameId}`;
  const PlayersUrl = `/workspaces/${groupId}/games/${gameId}/players`;
  const SettingsUrl = `/workspaces/${groupId}/games/${gameId}/settings`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Servers',
      href: ServersUrl,
      icon: ServerStackIcon,
      current: path == ServersUrl,
    },
    {
      name: 'Players',
      href: PlayersUrl,
      icon: UsersIcon,
      current: path.startsWith(PlayersUrl),
    },
    {
      name: 'Settings',
      href: SettingsUrl,
      icon: Cog6ToothIcon,
      current: path.startsWith(SettingsUrl),
    }
  ];

  return <PageNav tabs={tabs}>{children}</PageNav>;
}
