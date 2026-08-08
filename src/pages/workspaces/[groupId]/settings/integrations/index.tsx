/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import { getBaseUrl, trpc } from '~/utils/trpc';
import { ROBLOX_OAUTH_CLIENT_ID } from '~/utils/robloxOAuth';
import LinkDiscord from '~/components/page_components/workspaces/settings/integrations/LinkDiscord';
import DiscordLinkage from '~/components/page_components/workspaces/settings/integrations/DiscordLinkage';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Button from '~/components/forms/Button';
import ReactTimeago from 'react-timeago';
import Line from '~/components/NextGenStyles/Line';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const { data: linkages, isPending: linkagesLoading } =
    trpc.workspaces.workspace.settings.integrations.get_linkages.useQuery({
      groupId,
    });
  const { data: robloxOAuth } = trpc.workspaces.workspace.settings.integrations.get_roblox_oauth.useQuery({ groupId });
  const robloxLinked = !!(robloxOAuth && robloxOAuth.created);
  const robloxLastUsed = robloxOAuth && robloxOAuth.lastUsed ? robloxOAuth.lastUsed : null;

  if (!user || !workspace) {
    return <LoadingPage />;
  }


  if (!workspace?.premium?.is) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Integrations`}
        />

        <div className="mt-4">
          <PageHeading title="Discord Integration" />
          <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              Premium
            </span>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Linking your Discord server lets you mirror activity logs and run
              ReAdmin admin actions straight from Discord. This integration is
              available on our Premium plans — upgrade below to connect it.
            </p>
            <div className="mt-3">
              <Button className="w-44" variant="primary" disabled>
                Link Discord Guild
              </Button>
            </div>
          </div>
        </div>
        <Line />

        {workspace?.department?.permissions?.admin && (
          <div className="mt-4">
            <PageHeading title="Roblox Integration - OAuth" description="ReAdmin relies on Open Cloud to read your workspace's members, roles, and other Roblox data, and to perform actions within Roblox. Linking this keeps your workspace's data accurate and prevents weird site issues." />

            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Roblox Open Cloud
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {robloxLinked ? (
                      <>
                        Last refreshed{' '}
                        <ReactTimeago date={new Date(robloxLastUsed!)} />
                      </>
                    ) : (
                      'Not linked yet — link below to avoid missing or outdated data across the site.'
                    )}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    robloxLinked
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      robloxLinked ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                  />
                  {robloxLinked ? 'Linked' : 'Not linked'}
                </span>
              </div>

              <a
                href="https://docs.readmin.app/settings/intergrations#why-does-readmin-need-these-permissions"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Why do we need this?
              </a>

              {'loggedIn' in user && (
                <div className="mt-3">
                  <Button
                    className="w-full sm:w-auto"
                    variant={'primary'}
                    size="medium"
                    href={`https://authorize.roblox.com/?client_id=${ROBLOX_OAUTH_CLIENT_ID}&response_type=Code&scope=${[
                      'openid',
                      'profile',
                      'group:read',
                      'group:write',
                      'legacy-group:manage'
                    ].map(scope => encodeURIComponent(scope)).join('+')}&step=accountConfirm&redirect_uri=${encodeURIComponent(`${getBaseUrl()}/auth/roblox`)}&state=workspaceLink:${workspace.groupId}`}
                  >
                    {robloxLinked ? 'Relink Open Cloud' : 'Link Open Cloud'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className='flex flex-col gap-4 mt-6 items-center'>
          <h1 className='text-xl font-bold text-center text-gray-900 dark:text-gray-100'>Automate your ranking, join-requests on Roblox, and perform actions through Discord</h1>
          <img src="https://cdn.readmin.app/readmin-public/ManageServersUpsale.jpeg" className='max-h-[400px] rounded-xl shadow-md border border-gray-200 dark:border-gray-700' alt="activity upsale image" />
          <WorkspaceUpsale />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Integrations`}
      />

      {linkagesLoading ? (
        <div className="mt-6 text-center">
          <LoadingAnimation />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Loading your integration settings...
          </p>
        </div>
      ) : (
        <div className="mt-4">

          <PageHeading title="Discord Integration" />
          <div>
            {!linkages?.discord && <LinkDiscord groupId={groupId} />}
            {linkages?.discord && <DiscordLinkage groupId={groupId} />}
          </div>
          <Line />

          <div className="mt-4">
            <PageHeading title="Roblox Integration - OAuth" description="OAuth is the new brand new way to handle group actions, it's more secure, and is tied directly to ReAdmin. In the future, the user performing the action will be the source of ranking actions." />

            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Roblox Open Cloud
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {robloxLinked ? (
                      <>
                        Last refreshed{' '}
                        <ReactTimeago date={new Date(robloxLastUsed!)} />
                      </>
                    ) : (
                      'Not linked yet — link below to keep your data accurate.'
                    )}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    robloxLinked
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      robloxLinked ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                  />
                  {robloxLinked ? 'Linked' : 'Not linked'}
                </span>
              </div>

              <a
                href="https://docs.readmin.app/settings/intergrations#why-does-readmin-need-these-permissions"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Why do we need this?
              </a>

              {'loggedIn' in user && (
                <div className="mt-3">
                  <Button
                    className="w-full sm:w-auto"
                    variant={'primary'}
                    size="medium"
                    href={`https://authorize.roblox.com/?client_id=${ROBLOX_OAUTH_CLIENT_ID}&response_type=Code&scope=${[
                      'openid',
                      'profile',
                      // 'universe-messaging-service:publish',
                      'group:read',
                      'group:write',
                      'legacy-group:manage'
                    ].map(scope => encodeURIComponent(scope)).join('+')}&step=accountConfirm&redirect_uri=${encodeURIComponent(`${getBaseUrl()}/auth/roblox`)}&state=workspaceLink:${workspace.groupId}`}
                  >
                    {robloxLinked ? 'Relink Open Cloud' : 'Link Open Cloud'}
                  </Button>
                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
