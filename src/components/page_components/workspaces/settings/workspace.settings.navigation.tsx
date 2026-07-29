import { usePathname } from 'next/navigation';
import {
  ChartBarIcon,
  ClockIcon,
  CogIcon,
  CreditCardIcon,
  ServerIcon,
  UsersIcon,
  FolderArrowDownIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import PageNav from '~/components/layouts/PageNav';
import { PropsWithChildren } from 'react';
import posthog from 'posthog-js';

export default function WorkspaceNavigation({ groupId, children }: PropsWithChildren<{ groupId: string }>) {
  const path = usePathname();

  const InformationUrl = `/workspaces/${groupId}/settings`;
  const IntegrationsUrl = `/workspaces/${groupId}/settings/integrations`;
  const DepartmentsUrl = `/workspaces/${groupId}/settings/departments`;
  const UserTagsUrl = `/workspaces/${groupId}/settings/user-tags`;
  const ActivityGoalsUrl = `/workspaces/${groupId}/settings/activity-goals`;
  const DistributionsUrl = `/workspaces/${groupId}/settings/distributions`;
  const DownloadsUrl = `/workspaces/${groupId}/settings/downloads`;
  const BillingUrl = `/workspaces/${groupId}/settings/billing`;

  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Information',
      href: InformationUrl,
      icon: CogIcon,
      current: path == InformationUrl,
    },
    {
      name: 'Integrations',
      href: IntegrationsUrl,
      icon: ServerIcon,
      current: path?.startsWith(IntegrationsUrl),
    },
    {
      name: 'Departments',
      href: DepartmentsUrl,
      icon: UsersIcon,
      current: path?.startsWith(DepartmentsUrl),
    },
    {
      name: 'User Tags',
      href: UserTagsUrl,
      icon: TagIcon,
      current: path?.startsWith(UserTagsUrl),
    },
    {
      name: 'Distributions',
      href: DistributionsUrl,
      icon: ChartBarIcon,
      current: path?.startsWith(DistributionsUrl),
    },
    {
      name: 'Downloads',
      href: DownloadsUrl,
      icon: FolderArrowDownIcon,
      current: path?.startsWith(DownloadsUrl),
    },
    {
      name: 'Activity Goals',
      href: ActivityGoalsUrl,
      icon: ClockIcon,
      current: path?.startsWith(ActivityGoalsUrl),
    },
    {
      name: 'Billing',
      href: BillingUrl,
      icon: CreditCardIcon,
      current: path?.startsWith(BillingUrl),
    },
  ];

  return <PageNav tabs={tabs} >{children}</PageNav>;
}
