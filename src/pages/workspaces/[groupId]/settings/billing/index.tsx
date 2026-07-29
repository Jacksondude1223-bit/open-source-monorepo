'use client';

import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import CancellationSurveyModal, { type CancellationReason } from '~/components/page_components/user/CancellationSurveyModal';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { getBaseUrl, trpc } from '~/utils/trpc';
import { SHUTDOWN_INFO_URL, SUBSCRIPTIONS_CLOSED } from '~/services/constants/Subscriptions';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, subscribed }: { groupId: string; subscribed?: 'true' } =
    router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const utils = trpc.useUtils();
  const billingPortalMutation =
    trpc.workspaces.workspace.settings.billing.maangeSubscription.useMutation();
  const userBillingPortalMutation = trpc.user.getStripeBillingPortal.useMutation();
  const { data: subscriptions } = trpc.user.getSubscriptions.useQuery();
  const cancelSubscriptionMutation = trpc.user.cancelSubscriptionByWorkspaceId.useMutation();
  const restartSubscriptionMutation = trpc.user.uncancelSubscriptionByworkspaceId.useMutation();
  const [showCancelSurvey, setShowCancelSurvey] = useState(false);

  if (!user || !workspace || 'loading' in user || user?.loggedIn == false) {
    return <LoadingPage />;
  }

  const currentSub = subscriptions?.userSubscriptions.find(
    (s) => s.metadata.workspaceId === groupId,
  );
  const isOwner =
    workspace?.premium?.managedBy?.robloxId == user.user.dbUser.robloxId;

  function maangeSub() {
    const url = getBaseUrl();
    const update = new Promise<void>((resolve, reject) => {
      billingPortalMutation
        .mutateAsync({
          groupId,
          path: url,
        })
        .then((r) => {
          window.open(r, '_blank');
          resolve();
        })
        .catch((e) => {
          reject(e);
        });
    })

    toast.promise(update, {
      loading: 'Redirecting you to the billing portal',
      success: 'Please wait as we redirect you',
      error: 'Something went wrong'
    })
  }

  // Portal session for the logged in user rather than the workspace, so anyone
  // who has ever paid us can check their own subscriptions - even if they are
  // not this workspace's admin or payer.
  function openUserBillingPortal() {
    const promise = userBillingPortalMutation
      .mutateAsync({ path: getBaseUrl() })
      .then((url) => {
        window.open(url, '_blank');
      });

    toast.promise(promise, {
      loading: 'Opening your Stripe billing portal',
      success: 'Please wait as we redirect you',
      error:
        'We could not open your billing portal - you may not have any billing set up with us. Contact us on Discord if you need help.',
    });
  }

  function uncancel() {
    const promise = restartSubscriptionMutation
      .mutateAsync({ groupId })
      .then(() => {
        utils.user.getSubscriptions.invalidate();
      });
    toast.promise(promise, {
      loading: 'Uncancelling subscription...',
      success: 'Subscription uncancelled',
      error: 'Failed to uncancel subscription - please contact support on Discord',
    });
  }

  function confirmCancel(reason: CancellationReason, details: string) {
    const promise = cancelSubscriptionMutation
      .mutateAsync({ groupId, reason, details: details || undefined })
      .then(() => {
        setShowCancelSurvey(false);
        utils.user.getSubscriptions.invalidate();
      });
    toast.promise(promise, {
      loading: 'Cancelling subscription...',
      success: 'Subscription cancelled',
      error: 'Failed to cancel subscription - please contact support on Discord',
    });
  }

  return (
    <>
      <PageHeading title={`${workspace?.groupName} Billing`} description="Manage your workspace subscription and payment details" />

      {workspace?.premium?.is == false && (
        <div className="mt-4">
          <WorkspaceUpsale />
        </div>
      )}

      {/* The upsale already carries the shutdown notice for free workspaces, so
          this only has to cover workspaces that are still on Premium. */}
      {(SUBSCRIPTIONS_CLOSED && workspace?.premium?.is == true) && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-6 dark:border-amber-900/50 dark:bg-amber-900/10">
          <h3 className="text-base font-semibold text-amber-900 dark:text-amber-300">
            ReAdmin is shutting down
          </h3>
          <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">
            Your subscription is still active and you can cancel it whenever you
            want — below, or in Stripe. Read the{' '}
            <a
              href={SHUTDOWN_INFO_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              shutdown notice
            </a>{' '}
            for the timeline and what happens to your data.
          </p>
          <Button
            variant="warning"
            size="medium"
            className="mt-4 whitespace-nowrap"
            onClick={openUserBillingPortal}
          >
            Open Stripe billing portal
          </Button>
        </div>
      )}

      {workspace?.premium?.is == true && (
        <div className="mt-6">
          {isOwner ? (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">Thank you for subscribing!</h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1 max-w-lg">
                    You have access to all premium features. Join our Discord to stay updated on development and request new features.
                  </p>
                  {currentSub?.cancel_at && (
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-3">
                      Your subscription is set to cancel{' '}
                      <ReactTimeago date={new Date(currentSub.cancel_at * 1000)} />.
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="medium"
                    className="whitespace-nowrap"
                    onClick={maangeSub}
                  >
                    Manage Subscription
                  </Button>
                  {currentSub?.cancel_at ? (
                    <Button
                      variant="blue"
                      size="medium"
                      className="whitespace-nowrap"
                      onClick={uncancel}
                    >
                      Keep Subscription
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      size="medium"
                      className="whitespace-nowrap"
                      onClick={() => setShowCancelSurvey(true)}
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 text-center">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                You can&apos;t manage this workspace&apos;s billing
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Another user is already paying for this workspace. Contact support if you have any questions.
              </p>
              {/* They cannot touch this workspace's subscription, but they can
                  still check their own billing with us. */}
              <Button
                variant="blue"
                size="medium"
                className="mt-4 whitespace-nowrap"
                onClick={openUserBillingPortal}
              >
                Check your own subscriptions in Stripe
              </Button>
            </div>
          )}
        </div>
      )}

      <CancellationSurveyModal
        open={showCancelSurvey}
        setOpen={setShowCancelSurvey}
        workspaceName={workspace?.groupName}
        loading={cancelSubscriptionMutation.isPending}
        onConfirm={confirmCancel}
      />
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
