import { GetServerSideProps } from 'next';
import { getBaseUrl, trpc } from '~/utils/trpc';
import { PropsWithChildren, ReactElement, useEffect } from 'react';
import { useRouter } from 'next/router';
import LoadingPage from '~/components/layouts/LoadingPage';
import toast from 'react-hot-toast';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return new Promise(async (resolve) => {
    const { req, res } = context;
    const { code, guild_id, state } = context.query as {
      code: string;
      state: string;
      guild_id: string;
    };
    if (!code || !guild_id || !state) {
      return resolve({
        redirect: {
          destination: '/',
          permanent: false,
        },
      });
    }

    return resolve({
      props: { code, guild_id, state },
    });
  });
};

export default function Page({
  code,
  guild_id,
  state,
}: PropsWithChildren<{ code: string; guild_id: string; state: string }>) {
  const url = getBaseUrl();
  const router = useRouter();
  const mutation = trpc.workspaces.workspace.settings.integrations.discord_link.useMutation();

  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    if (!code || !guild_id || !state) {
      router.push('/');
    }
    mutation
      .mutateAsync({
        groupId: state,
        code,
        guild_id,
        redirect_uri: `${url}/workspaces/discord/link`,
      })
      .then(() => {
        router.push(
          `/workspaces/${state}/settings/integrations?discord_linked=true`,
        );
      })
      .catch((e) => {
        toast.error(e.toString())
      });
  }, []);

  return (<LoadingPage />)
}

Page.getLayout = (page: ReactElement) => (
  <DashboardLayout disableMl={true}>{page}</DashboardLayout>
);
