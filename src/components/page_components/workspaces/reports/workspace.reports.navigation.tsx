import { usePathname } from 'next/navigation';
import { ArrowDownTrayIcon, PresentationChartBarIcon } from '@heroicons/react/24/solid';
import PageNav from '~/components/layouts/PageNav';

export default function WorkspaceReportsNavigation({
  groupId,
}: {
  groupId: string;
}) {
  const path = usePathname();

  const ReportsUrl = `/workspaces/${groupId}/reports`;
  const ExportUrl = `/workspaces/${groupId}/reports/export`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Leaderboard',
      href: ReportsUrl,
      icon: PresentationChartBarIcon,
      current: path == ReportsUrl,
    },
    // {
    //   name: 'Export',
    //   href: ExportUrl,
    //   icon: ArrowDownTrayIcon,
    //   current: path == ExportUrl,
    // },
  ];

  return <PageNav tabs={tabs} />;
}
