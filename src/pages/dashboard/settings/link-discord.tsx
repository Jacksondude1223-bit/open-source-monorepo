/* eslint-disable react-hooks/exhaustive-deps */
import { ReactElement, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { getBaseUrl, trpc } from '~/utils/trpc';

export default function LinkDiscordPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const linkMutation = trpc.user.linkDiscordAccount.useMutation();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!router.isReady || hasRun.current) {
      return;
    }
    hasRun.current = true;

    const code = router.query.code as string | undefined;
    if (!code) {
      router.replace('/dashboard/settings');
      return;
    }

    linkMutation
      .mutateAsync({ code, redirect_uri: `${getBaseUrl()}/auth/discord` })
      .then(() => {
        toast.success('Discord account linked successfully');
        return Promise.all([
          utils.user.getDiscordAccounts.invalidate(),
          utils.user.info.invalidate(),
        ]);
      })
      .catch((err) => {
        toast.error(err?.message || 'Failed to link Discord account');
      })
      .finally(() => {
        router.replace('/dashboard/settings');
      });
  }, [router.isReady]);

  return <LoadingPage />;
}

LinkDiscordPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);
