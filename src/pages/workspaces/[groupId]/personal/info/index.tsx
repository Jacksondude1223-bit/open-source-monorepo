import { useRouter } from 'next/router';
import { JSX, ReactElement } from 'react';
import { ChatBubbleLeftEllipsisIcon, ClockIcon } from '@heroicons/react/24/solid';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { useWorkspace } from '~/components/contexts/workspace';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  if (!true) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading title={`${workspace?.groupName} Forms`} disableDivide={true} />
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout
      title="Workspace Home"
      tabs={[
        {
          name: 'Home',
          href: `/workspaces/${groupId}`,
          icon: ChatBubbleLeftEllipsisIcon,
          current: false,
        },
        {
          name: 'Your Activity',
          href: `/workspaces/${groupId}/personal/activity`,
          icon: ClockIcon,
          current: false,
        },
      ]}
      disablePadding={false}
    >
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
