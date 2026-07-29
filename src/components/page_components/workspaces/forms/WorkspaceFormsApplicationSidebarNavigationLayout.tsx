/* eslint-disable @next/next/no-img-element */
import {
  BoltIcon,
  CalculatorIcon,
  CogIcon,
  QuestionMarkCircleIcon,
  UsersIcon,
} from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import {
  WorkspaceSidebarTabType,
  WorkspaceWithExtraSidebarLayout,
} from '../../WorkspaceWithExtraSidebarLayout';

export default function WorkspaceFormsApplicationSidebarNavigationLayout({
  children,
  disablePadding = false,
}: PropsWithChildren<{ disablePadding?: boolean }>) {
  const workspace = useWorkspace();
  const router = useRouter();
  const { groupId, applicationId }: { groupId: string; applicationId: string } =
    router.query as any;

  const { data: application } =
    trpc.workspaces.workspace.forms.applications.application.getApplication.useQuery(
      { groupId, applicationId },
      { enabled: !!groupId && !!applicationId },
    );

  const ResponsesUrl = `/workspaces/${groupId}/forms/application/${applicationId}`;
  const QuestionsUrl = `/workspaces/${groupId}/forms/application/${applicationId}/questions`;
  const QuizModeUrl = `/workspaces/${groupId}/forms/application/${applicationId}/quiz-mode`;
  const AutomationsUrl = `/workspaces/${groupId}/forms/application/${applicationId}/automations`;
  const SettingsUrl = `/workspaces/${groupId}/forms/application/${applicationId}/settings`;

  const tabs: WorkspaceSidebarTabType[] = [
    { name: 'Responses', href: ResponsesUrl, icon: UsersIcon, current: false, canShow: true },
    { name: 'Questions', href: QuestionsUrl, icon: QuestionMarkCircleIcon, current: false, canShow: true },
    { name: 'Quiz Mode', href: QuizModeUrl, icon: CalculatorIcon, current: false, canShow: true },
    { name: 'Automations', href: AutomationsUrl, icon: BoltIcon, current: false, canShow: true },
    { name: 'Settings', href: SettingsUrl, icon: CogIcon, current: false, canShow: true },
  ];

  return (
    <WorkspaceWithExtraSidebarLayout
      title={application?.name || `${workspace?.groupName || 'Workspace'} Forms`}
      tabs={tabs}
      disablePadding={disablePadding}
    >
      {children}
    </WorkspaceWithExtraSidebarLayout>
  );
}
