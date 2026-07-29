import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';
import { ClipboardDocumentListIcon, ShoppingBagIcon, Cog8ToothIcon, ChartBarIcon, CpuChipIcon } from '@heroicons/react/24/solid';
import { useWorkspace } from '~/components/contexts/workspace';
import { WorkspaceSidebarTabType, WorkspaceWithExtraSidebarLayout } from '../../WorkspaceWithExtraSidebarLayout';
import { ordersAccess } from './access';

/**
 * Secondary sidebar layout for the Orders / POS module. Tabs respect the user's
 * orders permissions (e.g. the Settings tab only shows for `manageSettings`).
 */
export default function OrdersLayout({
  children,
  disablePadding = false,
}: PropsWithChildren<{ disablePadding?: boolean }>) {
  const workspace = useWorkspace();
  const router = useRouter();
  const path = router.asPath;

  if (!workspace?.groupId) {
    return <></>;
  }

  const groupId = workspace.groupId;
  const access = ordersAccess(workspace);

  const OrdersUrl = `/workspaces/${groupId}/orders`;
  const ProductsUrl = `/workspaces/${groupId}/orders/products`;
  const SettingsUrl = `/workspaces/${groupId}/orders/settings`;
  const DevicesUrl = `/workspaces/${groupId}/orders/devices`;
  const StatsUrl = `/workspaces/${groupId}/orders/stats`;

  const tabs: WorkspaceSidebarTabType[] = [
    {
      name: 'Orders',
      href: OrdersUrl,
      icon: ClipboardDocumentListIcon,
      current: path === OrdersUrl,
      canShow: access.view,
    },
    {
      name: 'Products',
      href: ProductsUrl,
      icon: ShoppingBagIcon,
      current: path?.startsWith(ProductsUrl),
      canShow: access.manageProducts || access.manage,
    },
    {
      name: 'Settings',
      href: SettingsUrl,
      icon: Cog8ToothIcon,
      current: path?.startsWith(SettingsUrl),
      canShow: access.manageSettings,
    },
    {
      name: 'Devices',
      href: DevicesUrl,
      icon: CpuChipIcon,
      current: path?.startsWith(DevicesUrl),
      canShow: access.view,
    },
    {
      name: 'Stats',
      href: StatsUrl,
      icon: ChartBarIcon,
      current: path?.startsWith(StatsUrl),
      canShow: access.view,
    },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout title={`${workspace?.groupName} Orders`} disablePadding={disablePadding} tabs={tabs}>
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
