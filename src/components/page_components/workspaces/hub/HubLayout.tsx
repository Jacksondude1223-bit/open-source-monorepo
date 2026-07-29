/* eslint-disable @next/next/no-img-element */
import { Cog8ToothIcon, HomeIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/router";
import { PropsWithChildren } from "react";
import { useWorkspace } from "~/components/contexts/workspace";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/20/solid";
import { WorkspaceWithExtraSidebarLayout } from "../../WorkspaceWithExtraSidebarLayout";

export default function HubLayout({ children, disablePadding = false }: PropsWithChildren<{ disablePadding?: boolean; }>) {
  const workspace = useWorkspace();
  const router = useRouter()
  const path = router.asPath;

  if (!workspace?.groupId) { return (<></>) }

  const groupId = workspace.groupId;

  const HubUrl = `/workspaces/${groupId}/hub`;
  const HubSettingsUrl = `/workspaces/${groupId}/hub/settings`;
  const HubOpensUrl = `/workspaces/${groupId}/hub/opens`;

  if (!path) {
    return <></>;
  }

  const tabs: {
    name: string;
    href: string;
    icon: any;
    current: boolean;
    canShow?: boolean;
  }[] = [
      {
        name: 'Home',
        href: HubUrl,
        icon: HomeIcon,
        current: path == HubUrl,
        canShow: true,
      },
      {
        name: 'Settings',
        href: HubSettingsUrl,
        icon: Cog8ToothIcon,
        current: path.startsWith(HubSettingsUrl),
        canShow: workspace.department.permissions?.knowledgeHub?.manage || workspace.department.permissions.admin
      },
      {
        name: 'Opens',
        href: HubOpensUrl,
        icon: ClipboardDocumentCheckIcon,
        current: path.startsWith(HubOpensUrl),
        canShow: workspace.department.permissions?.knowledgeHub?.manage || workspace.department.permissions.admin
      },
    ];

  return (
    <WorkspaceWithExtraSidebarLayout title={`${workspace?.groupName} Knowledge Hub`} tabs={tabs}>
      {children}
    </WorkspaceWithExtraSidebarLayout>
  )
}