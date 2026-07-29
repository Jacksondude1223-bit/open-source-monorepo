'use client';

import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();

  const context = trpc.useUtils();


  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Template`}
        disableDivide={true}
      >

      </PageHeading>

    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
