import { usePathname } from 'next/navigation';
import { ClipboardIcon } from '@heroicons/react/24/solid';
import PageNav from '~/components/layouts/PageNav';
import { PropsWithChildren } from 'react';

export default function WorkspaceFormsNavigation({
  groupId,
  children,
}: PropsWithChildren<{
  groupId: string;
}>) {
  const path = usePathname();

  const ApplicationsUrl = `/workspaces/${groupId}/forms`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Forms',
      href: ApplicationsUrl,
      icon: ClipboardIcon,
      current: path == ApplicationsUrl,
    },
  ];

  return <PageNav tabs={tabs}>{children}</PageNav>;
}
