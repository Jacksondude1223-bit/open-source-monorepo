/* eslint-disable @next/next/no-img-element */
import { ArchiveBoxArrowDownIcon, BellAlertIcon, ChartBarIcon, ClockIcon, Cog8ToothIcon, CreditCardIcon, FolderArrowDownIcon, WifiIcon, ServerIcon, TagIcon, UsersIcon, UserGroupIcon, MegaphoneIcon, SparklesIcon, LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useRouter } from "next/router";
import posthog from "posthog-js";
import { PropsWithChildren } from "react";
import { WorkspaceLayout } from "~/components/page_components/WorkspaceLayout";
import { useWorkspace } from "~/components/contexts/workspace";
import { DiscordIcon, RobloxIcon } from "~/components/icons";
import { WorkspaceSidebarTabType, WorkspaceWithExtraSidebarLayout } from "../../WorkspaceWithExtraSidebarLayout";
import { faRobot } from "@fortawesome/free-solid-svg-icons";

export default function SettingsLayout({ children, disablePadding = false }: PropsWithChildren<{ disablePadding: boolean; }>) {
  const workspace = useWorkspace();
  const router = useRouter()
  const path = router.asPath;

  if (!workspace?.groupId) { return (<></>) }

  const groupId = workspace.groupId;

  const InformationUrl = `/workspaces/${groupId}/settings`;
  const IntegrationsUrl = `/workspaces/${groupId}/settings/integrations`;
  const LoggingUrl = `/workspaces/${groupId}/settings/logging`;
  const RemoteAdminUrl = `/workspaces/${groupId}/settings/remote-admin`;
  const RankingApiUrl = `/workspaces/${groupId}/settings/ranking-api`;
  const DepartmentsUrl = `/workspaces/${groupId}/settings/departments`;
  const UserTagsUrl = `/workspaces/${groupId}/settings/user-tags`;
  const ActivityGoalsUrl = `/workspaces/${groupId}/settings/activity-goals`;
  const DistributionsUrl = `/workspaces/${groupId}/settings/distributions`;
  const TimeclockUrl = `/workspaces/${groupId}/settings/timeclock`;
  const TeamsUrl = `/workspaces/${groupId}/settings/teams`;
  const NotificationsUrl = `/workspaces/${groupId}/settings/notifications`;
  const BannersUrl = `/workspaces/${groupId}/settings/banners`;
  const DownloadsUrl = `/workspaces/${groupId}/settings/downloads`;
  const BillingUrl = `/workspaces/${groupId}/settings/billing`;
  const PartnershipUrl = `/workspaces/${groupId}/settings/partnership`;
  const PrivacyUrl = `/workspaces/${groupId}/settings/privacy`;
  const DataManagementUrl = `/workspaces/${groupId}/settings/data-management`;
  const DataExportUrl = `/workspaces/${groupId}/settings/data-export`;

  if (!path) {
    return <></>;
  }

  const tabs: WorkspaceSidebarTabType[] = [
    {
      name: 'General',
      href: InformationUrl,
      icon: Cog8ToothIcon,
      current: path == InformationUrl,
      canShow: true,
    },
    {
      name: 'Departments',
      href: DepartmentsUrl,
      icon: UsersIcon,
      current: path?.startsWith(DepartmentsUrl),
    },
    {
      name: 'Automation',
      href: IntegrationsUrl,
      icon: faRobot,
      faIcon: true,
      current: path?.startsWith(IntegrationsUrl),
    },
    {
      name: 'Ranking API',
      href: RankingApiUrl,
      icon: RobloxIcon,
      current: path?.startsWith(RankingApiUrl),
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
      name: 'Timeclock',
      href: TimeclockUrl,
      icon: ClockIcon,
      current: path?.startsWith(TimeclockUrl),
    },
    {
      name: 'Teams',
      href: TeamsUrl,
      icon: UserGroupIcon,
      current: path?.startsWith(TeamsUrl),
    },
    {
      name: 'Notifications',
      href: NotificationsUrl,
      icon: BellAlertIcon,
      current: path?.startsWith(NotificationsUrl),
    },
    {
      name: 'Banners',
      href: BannersUrl,
      icon: MegaphoneIcon,
      current: path?.startsWith(BannersUrl),
    },
    {
      name: 'Downloads',
      href: DownloadsUrl,
      icon: FolderArrowDownIcon,
      current: path?.startsWith(DownloadsUrl),
    },
    {
      name: 'Remote Admin',
      href: RemoteAdminUrl,
      icon: WifiIcon,
      current: path?.startsWith(RemoteAdminUrl)
    },
    {
      name: 'Activity Goals',
      href: ActivityGoalsUrl,
      icon: ClockIcon,
      current: path?.startsWith(ActivityGoalsUrl),
    },
    {
      name: 'Logging',
      href: LoggingUrl,
      icon: DiscordIcon,
      current: path?.startsWith(LoggingUrl),
    },
    {
      name: 'Partnership',
      href: PartnershipUrl,
      icon: SparklesIcon,
      current: path?.startsWith(PartnershipUrl),
    },
    {
      name: 'Privacy',
      href: PrivacyUrl,
      icon: LockClosedIcon,
      current: path?.startsWith(PrivacyUrl),
    },
    {
      name: 'Data Management',
      href: DataManagementUrl,
      icon: ShieldCheckIcon,
      current: path?.startsWith(DataManagementUrl),
    },
    {
      name: 'Data Export',
      href: DataExportUrl,
      icon: ArchiveBoxArrowDownIcon,
      current: path?.startsWith(DataExportUrl),
    },
    {
      name: 'Billing',
      href: BillingUrl,
      icon: CreditCardIcon,
      current: path?.startsWith(BillingUrl),
    },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout title={`${workspace?.groupName} Settings`} disablePadding={disablePadding} tabs={tabs}>
      {children}
    </WorkspaceWithExtraSidebarLayout>
  )
}