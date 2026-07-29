/* eslint-disable @next/next/no-img-element */
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { useUser } from '~/components/contexts/user';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import { getBaseUrl, trpc } from '~/utils/trpc';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import DiscordConnections from '~/components/page_components/user/DiscordConnections';
import IdentityLinkSection from '~/components/page_components/user/IdentityLinkSection';
import CancellationSurveyModal, { type CancellationReason } from '~/components/page_components/user/CancellationSurveyModal';
import { SHUTDOWN_INFO_URL, SUBSCRIPTIONS_CLOSED } from '~/services/constants/Subscriptions';
import {
  MoonIcon,
  SunIcon,
  ArrowRightOnRectangleIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  CakeIcon
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const info = useUser();

  const { data: subscriptions } = trpc.user.getSubscriptions.useQuery();
  const getBillingPortal = trpc.user.getStripeBillingPortal.useMutation();
  const cancelSubscriptionMutation = trpc.user.cancelSubscriptionByWorkspaceId.useMutation();
  const restartSubscriptionMutation = trpc.user.uncancelSubscriptionByworkspaceId.useMutation();
  const mutation = trpc.user.configureDarkMode.useMutation();
  const logoutMutation = trpc.user.logout.useMutation();
  const updateBirthdayMutation = trpc.user.updateBirthday.useMutation();
  const removeBirthdayMutation = trpc.user.removeBirthday.useMutation();
  const utils = trpc.useUtils();

  const [birthdayMonth, setBirthdayMonth] = useState<number>(info && 'user' in info ? info.user?.dbUser?.birthday?.month || 0 : 0);
  const [birthdayDay, setBirthdayDay] = useState<number>(info && 'user' in info ? info.user?.dbUser?.birthday?.day || 0 : 0);
  const [cancelTarget, setCancelTarget] = useState<{ groupId: string; groupName?: string } | null>(null);

  if ('loading' in info || !subscriptions) {
    return <LoadingPage />;
  }
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <Cog6ToothIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <PageHeading  title="Your Settings" />
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account preferences and settings
          </p>
        </div>
      </div>

      {/* Account Preferences Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <UserCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Preferences</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {info?.user?.dbUser?.darkMode ? (
                <MoonIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <SunIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              )}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Dark Mode</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enable dark mode on ReAdmin for your account
                </p>
              </div>
            </div>
            <Toggle
              value={info?.user?.dbUser?.darkMode == true}
              onChange={(v) => {
                mutation.mutateAsync({
                  enable: v
                }).then(() => {
                  utils.user.info.invalidate();
                })
              }}
            />
          </div>
        </div>
      </div>

      {/* Discord Integration Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Discord Integration</h2>
          </div>
        </div>

        <div className="p-6">
          <DiscordConnections />
        </div>
      </div>

      {/* Birthday Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <CakeIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Birthday</h2>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Add your birthday to let your workspace members celebrate with you!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birthday-month" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Month
                </label>
                <select
                  id="birthday-month"
                  value={birthdayMonth}
                  onChange={(e) => setBirthdayMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Select month...</option>
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
              </div>

              <div>
                <label htmlFor="birthday-day" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Day
                </label>
                <select
                  id="birthday-day"
                  value={birthdayDay}
                  onChange={(e) => setBirthdayDay(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={birthdayMonth === 0}
                >
                  <option value={0}>Select day...</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="blue"
                size="medium"
                disabled={birthdayMonth === 0 || birthdayDay === 0}
                onClick={() => {
                  const promise = updateBirthdayMutation.mutateAsync({
                    month: birthdayMonth,
                    day: birthdayDay,
                  }).then(() => {
                    utils.user.info.invalidate();
                  });

                  toast.promise(promise, {
                    loading: 'Saving birthday...',
                    success: 'Birthday saved successfully!',
                    error: (err) => err.message || 'Failed to save birthday',
                  });
                }}
              >
                {info && 'user' in info && info.user?.dbUser?.birthday ? 'Update Birthday' : 'Save Birthday'}
              </Button>

              {info && 'user' in info && info.user?.dbUser?.birthday && (
                <Button
                  variant="danger"
                  size="medium"
                  onClick={() => {
                    const promise = removeBirthdayMutation.mutateAsync().then(() => {
                      setBirthdayMonth(0);
                      setBirthdayDay(0);
                      utils.user.info.invalidate();
                    });

                    toast.promise(promise, {
                      loading: 'Removing birthday...',
                      success: 'Birthday removed successfully!',
                      error: 'Failed to remove birthday',
                    });
                  }}
                >
                  Remove Birthday
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {SUBSCRIPTIONS_CLOSED && (
          <div className="px-6 py-4 bg-amber-50/70 border-b border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/50">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              ReAdmin is shutting down
            </p>
            <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">
              Everything you are subscribed to is listed below, and you can cancel
              it here or in Stripe. Use <span className="font-medium">Manage Billing</span>{' '}
              to see every subscription, invoice, and payment method on your Stripe
              account and confirm for yourself that it has ended. The full{' '}
              <a
                href={SHUTDOWN_INFO_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                shutdown notice
              </a>{' '}
              covers the timeline and what happens to your data.
            </p>
          </div>
        )}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between gap-3">
            <div className="flex items-center gap-3">
              <CreditCardIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Subscriptions</h2>
            </div>
            <Button onClick={() => {
              const url = getBaseUrl();
              const update = new Promise<void>((resolve, reject) => {
                getBillingPortal
                  .mutateAsync({
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
                error: 'We could not open your billing portal - you may not have any billing set up with us. Contact us on Discord if you need help.'
              })
            }} variant="blue">Manage Billing</Button>
          </div>
        </div>

        <div className="p-6">
          {subscriptions.workspaces.length == 0 ? (
            <div className="text-center py-8">
              <CreditCardIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">You have no subscriptions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.workspaces.map((ascWorkspace) => {
                const sub = subscriptions.userSubscriptions.find(subscription => ascWorkspace.groupId === subscription.metadata.workspaceId);
                if (!sub) {
                  return null; // Skip if no subscription found for this workspace
                }
                return (
                  <div key={ascWorkspace.groupId} className="flex flex-row items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{ascWorkspace?.groupName}</p>
                      <p className="text-gray-500 dark:text-gray-400">
                        {sub.cancel_at ? (
                          <>cancelling <ReactTimeago date={new Date(sub.cancel_at * 1000)} /></>
                        ) : (
                          <>
                            {{
                              active: 'Active',
                              canceled: 'Canceled',
                              incomplete: 'Incomplete',
                              incomplete_expired: 'Expired',
                              past_due: 'Past due',
                              paused: 'Paused',
                              trialing: 'Trial',
                              unpaid: 'Unpaid',
                            }[sub.status]} - next billed <ReactTimeago date={new Date((sub?.next_pending_invoice_item_invoice || 0) * 1000)} />
                          </>
                        )}
                      </p>
                    </div>
                    <Button variant="danger" size="small" onClick={() => {
                      if (sub.cancel_at) {
                        const promise = new Promise<void>((resolve, reject) => {
                          restartSubscriptionMutation.mutateAsync({
                            groupId: ascWorkspace?.groupId as string
                          }).then(() => {
                            resolve()
                            utils.user.getSubscriptions.invalidate();
                          }).catch(e => {
                            reject(e)
                          })
                        })

                        toast.promise(promise, {
                          loading: 'Uncancelling subscription...',
                          success: 'Subscription uncancelled',
                          error: 'Failed to uncancel subscription - please contact support on Discord'
                        })
                      } else {
                        setCancelTarget({ groupId: ascWorkspace?.groupId as string, groupName: ascWorkspace?.groupName });
                      }
                    }}>{sub.cancel_at ? 'Uncancel Subscription' : 'Cancel Subscription'}</Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Account Actions Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ArrowRightOnRectangleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Actions</h2>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Sign Out</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sign out of your ReAdmin account on this device
              </p>
            </div>
            <Button variant="danger" size="medium" onClick={() => {
              logoutMutation.mutateAsync().then(() => {
                localStorage.clear();
                window.location.href = 'https://readmin.app';
              });
            }}>
              <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </div>

      {/* Founder-only: identity link testing. Self-gates — renders nothing for non-founders. */}
      <IdentityLinkSection />

      <CancellationSurveyModal
        open={cancelTarget !== null}
        setOpen={(open) => {
          if (!open) setCancelTarget(null);
        }}
        workspaceName={cancelTarget?.groupName}
        loading={cancelSubscriptionMutation.isPending}
        onConfirm={(reason: CancellationReason, details: string) => {
          if (!cancelTarget) return;
          const promise = cancelSubscriptionMutation.mutateAsync({
            groupId: cancelTarget.groupId,
            reason,
            details: details || undefined,
          }).then(() => {
            setCancelTarget(null);
            utils.user.getSubscriptions.invalidate();
          });

          toast.promise(promise, {
            loading: 'Cancelling subscription...',
            success: 'Subscription cancelled',
            error: 'Failed to cancel subscription - please contact support on Discord'
          });
        }}
      />
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);
