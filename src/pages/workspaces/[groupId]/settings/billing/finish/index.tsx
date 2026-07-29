'use client';

import { useRouter } from 'next/router';
import { useEffect, ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const params = router.query;

  const mutation = trpc.workspaces.workspace.settings.billing.finishWorkspaceSubscribe.useMutation();
  const [subsriptionStatus, setSubscriptionStatus] = useState<'loading' | 'subscribed' | 'error'>('loading');

  useEffect(() => {
    if (!workspace || 'success' in workspace) {
      return;
    }
    mutation.mutateAsync(
      {
        groupId,
        subscriptionId: params['id'] as string,
      },
    ).then(() => {
      window.location.href = `/workspaces/${workspace.groupId}/settings/billing?subscribed=true`;
    }).catch(e => {
      toast.error(`Something went wrong ${e}`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, params, workspace]);

  if (!user || !workspace || 'loading' in user || user?.loggedIn == false) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Finish Premium Subscription Setup`}
      />

      <h1 className="font-bold text-lg text-center">Please wait!</h1>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
