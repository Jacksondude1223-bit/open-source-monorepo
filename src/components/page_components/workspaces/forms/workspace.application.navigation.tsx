import { usePathname } from 'next/navigation';
import PageNav from '~/components/layouts/PageNav';
import { PropsWithChildren } from 'react';
import {
  BoltIcon,
  CalculatorIcon,
  CogIcon,
  QuestionMarkCircleIcon,
  UsersIcon,
} from '@heroicons/react/20/solid';

export default function WorkspaceFormsApplicationNavigation({
  groupId,
  applicationId,
  children,
}: PropsWithChildren<{
  groupId: string;
  applicationId: string;
}>) {
  const path = usePathname();

  const ResponsesUrl = `/workspaces/${groupId}/forms/application/${applicationId}`;
  const QuestionsUrl = `/workspaces/${groupId}/forms/application/${applicationId}/questions`;
  const QuizModeUrl = `/workspaces/${groupId}/forms/application/${applicationId}/quiz-mode`;
  const AutomationsUrl = `/workspaces/${groupId}/forms/application/${applicationId}/automations`;
  const SettingsUrl = `/workspaces/${groupId}/forms/application/${applicationId}/settings`;
  if (!path) {
    return <></>;
  }

  const tabs = [
    {
      name: 'Responses',
      href: ResponsesUrl,
      icon: UsersIcon,
      current: path == ResponsesUrl,
    },
    {
      name: 'Questions',
      href: QuestionsUrl,
      icon: QuestionMarkCircleIcon,
      current: path.startsWith(QuestionsUrl),
    },
    {
      name: 'Quiz Mode',
      href: QuizModeUrl,
      icon: CalculatorIcon,
      current: path.startsWith(QuizModeUrl),
    },
    {
      name: 'Automations',
      href: AutomationsUrl,
      icon: BoltIcon,
      current: path.startsWith(AutomationsUrl),
    },
    {
      name: 'Settings',
      href: SettingsUrl,
      icon: CogIcon,
      current: path.startsWith(SettingsUrl),
    },
  ];

  return <PageNav tabs={tabs}>{children}</PageNav>;
}
