/* eslint-disable @next/next/no-img-element */
import { SparklesIcon, PlusIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import { useRouter } from "next/router";
import { PropsWithChildren, ReactElement } from "react";
import { WorkspaceLayout } from "~/components/page_components/WorkspaceLayout";
import { useWorkspace } from "~/components/contexts/workspace";
import { trpc } from "~/utils/trpc";
import WorkspaceUpsale from "../settings/billing/Upsale";
import { WorkspaceSidebarTabType, WorkspaceWithExtraSidebarLayout } from "../../WorkspaceWithExtraSidebarLayout";

export default function WorkspaceViewSidebarNavigationLayout({ children, disablePadding = false }: PropsWithChildren<{ disablePadding: boolean; }>) {
  const workspace = useWorkspace();
  const router = useRouter()
  const path = router.asPath;

  if (!workspace?.groupId) { return (<></>) }

  const { data: views } = trpc.workspaces.workspace.views.getViews.useQuery({ groupId: workspace?.groupId });

  if (!workspace?.premium?.is) {
    return (
      <WorkspaceLayout disableMl={true}>
        <div className='flex flex-col gap-2'>
          <h1 className='my-4 text-2xl font-bold text-center'>View user activity at scale</h1>
          <img src="https://readmin.app/app/views.png" className='self-center align-middle max-h-[500px]  rounded-lg shadow-lg border border-gray-500' alt="activity upsale image" />
          <WorkspaceUpsale />
        </div>
      </WorkspaceLayout>
    )
  }

  let tabs: WorkspaceSidebarTabType[] = [];
  if (workspace.department.permissions.reports.view) {
    tabs = views?.map(view => ({
      name: view.icon ? `${view.icon} ${view.name}` : view.name,
      href: `/workspaces/${workspace?.groupId}/views/${view.id}`,
      icon: SparklesIcon,
      current: path.startsWith(`/workspaces/${workspace?.groupId}/views/${view.id}`),
      canShow: true
    })) || []
  }

  if (workspace.department.permissions.reports.export) {
    tabs.push({
      name: 'Create View',
      href: `/workspaces/${workspace?.groupId}/views/create`,
      icon: PlusIcon,
      current: path.startsWith(`/workspaces/${workspace?.groupId}/views/create`),
      canShow: true
    });
  }


  return (
    <WorkspaceWithExtraSidebarLayout title={`${workspace?.groupName} Views`} tabs={tabs} disablePadding={disablePadding}>
      {children}
    </WorkspaceWithExtraSidebarLayout>
  )
}