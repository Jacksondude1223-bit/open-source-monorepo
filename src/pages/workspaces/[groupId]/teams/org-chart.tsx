'use client';

import { useRouter } from 'next/router';
import { JSX, ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useWorkspace } from '~/components/contexts/workspace';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { teamsTabs } from '~/components/page_components/teamsTabs';
import OrgChartView from '~/components/ui/OrgChartView';

export default function OrgChartPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();

  if (!workspace) return <LoadingPage />;

  return (
    <>
      <PageHeading
        title="Org Chart"
        description="Your full organizational hierarchy. Click arrows to expand or collapse teams."
      />
      <div className="px-6 pb-6">
        <OrgChartView groupId={groupId} brandColor={workspace.brandColor || 'blue'} />
      </div>
    </>
  );
}

OrgChartPage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout title="Teams" tabs={teamsTabs(groupId)}>
      {page}
    </WorkspaceWithExtraSidebarLayout>
  );
};
