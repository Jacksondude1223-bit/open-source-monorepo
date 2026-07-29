import { ServerStackIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';
import PageNav from '~/components/layouts/PageNav';
import {
  ChatBubbleBottomCenterTextIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';

export default function WorkspaceGamesRunningNavigation({
  groupId,
  gameId,
  serverId,
  children,
}: PropsWithChildren<{ groupId: string; gameId: string; serverId: string }>) {
  const path = usePathname();

  const PlayersUrl = `/workspaces/${groupId}/games/${gameId}/running/${serverId}`;
  const ChatLogUrl = `/workspaces/${groupId}/games/${gameId}/running/${serverId}/chats`;
  const InformationUrl = `/workspaces/${groupId}/games/${gameId}/running/${serverId}/info`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Players',
      href: PlayersUrl,
      icon: ServerStackIcon,
      current: path == PlayersUrl,
    },
    {
      name: 'Chat Log',
      href: ChatLogUrl,
      icon: ChatBubbleBottomCenterTextIcon,
      current: path.startsWith(ChatLogUrl),
    },
    {
      name: 'Information',
      href: InformationUrl,
      icon: InformationCircleIcon,
      current: path.startsWith(InformationUrl),
    },
  ];

  return <PageNav tabs={tabs}>{children}</PageNav>;
}
