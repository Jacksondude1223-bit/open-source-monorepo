import { usePathname } from 'next/navigation';
import {
  UsersIcon,
} from '@heroicons/react/24/solid';
import PageNav from '~/components/layouts/PageNav';
import { CogIcon } from '@heroicons/react/24/outline';

export default function WorkspaceSessionsSessionsNavigation({
  groupId,
  sessionId,
  oneOff = false,
}: {
  groupId: string;
  sessionId?: string;
  oneOff?: boolean;
}) {
  const path = usePathname();

  const ClaimedRolesURL = `/workspaces/${groupId}/sessions/session/${sessionId}`;
  const EditURL = `/workspaces/${groupId}/sessions/session/${sessionId}/editOneOff`

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Users',
      href: ClaimedRolesURL,
      icon: UsersIcon,
      current: path == ClaimedRolesURL,
    }
  ];

  if (oneOff) {
    tabs.push({
      name: 'Edit',
      href: EditURL,
      icon: CogIcon,
      current: path.startsWith(EditURL)
    })
  }

  return (<div className="mt-2"><PageNav tabs={tabs} /></div>);
}
