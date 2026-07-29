import { useState } from 'react';
import {
  CheckIcon,
  BoltIcon,
  SparklesIcon,
  ClockIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ServerStackIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import classNames from '~/utils/classNames';
import { getBaseUrl, trpc } from '~/utils/trpc';
import { useWorkspace } from '~/components/contexts/workspace';
import toast from 'react-hot-toast';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import { SHUTDOWN_INFO_URL, SUBSCRIPTIONS_CLOSED } from '~/services/constants/Subscriptions';

export type TierType = {
  name: string;
  id: string;
  price: string | { monthly: string };
  description: string;
  features: string[];
  featured: boolean;
  footnote?: string;
  trialAvailable?: boolean;
  cta: string | null;
};
export const PremiumFeatures = [
  'Everything in Free, plus:',
  'Activity tracking — active, idle & typing time at scale',
  'Remote admin — notify, kick & ban from web or Discord',
  'Custom Views & performance dashboards',
  'Roblox Open Cloud & Discord integrations',
  'Sessions, activity goals & leaderboards',
  'Automated distributions & Ranking API',
  'Custom branding to make it yours',
];

/** Outcome-led highlights shown beneath the pricing cards to *show* the value. */
const PREMIUM_HIGHLIGHTS = [
  {
    name: 'Activity Tracking',
    icon: ClockIcon,
    description:
      'Measure active, idle, and typing time for tens of thousands of staff — so promotions are based on real effort.',
  },
  {
    name: 'Remote Admin',
    icon: BoltIcon,
    description:
      'Notify, kick, ban, and watch live chat across every server from the dashboard or Discord — never open Roblox.',
  },
  {
    name: 'Views & Dashboards',
    icon: ChartBarIcon,
    description:
      'Filter, sort, and compare staff side-by-side to instantly spot your top performers and your dead weight.',
  },
  {
    name: 'Discord Integration',
    icon: ChatBubbleLeftRightIcon,
    description:
      'Run admin actions, mirror logs, and keep your whole team in sync straight from your Discord server.',
  },
  {
    name: 'Sessions & Goals',
    icon: CalendarDaysIcon,
    description:
      'Schedule sessions, let staff claim roles by your rules, and set activity quotas everyone can see.',
  },
  {
    name: 'Ranking API & Automation',
    icon: ServerStackIcon,
    description:
      'Auto rerank on Roblox and automate distributions from the dashboard, Discord, or your own code.',
  },
];

/** Social proof reused from the public marketing site. */
const TRUST_STATS = [
  { value: '1,000+', label: 'Communities' },
  { value: '8M+', label: 'Users tracked' },
  { value: 'Tens of thousands', label: 'Staff per group' },
  { value: '30 min', label: 'Sync interval' },
];

export default function WorkspaceUpsale() {
  const workspace = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);
  const [setupAssist, setSetupAssist] = useState(false);
  const [previousTool, setPreviousTool] = useState('');
  const [contactMethod, setContactMethod] = useState<'discord' | 'email'>('discord');
  const [contact, setContact] = useState('');
  const subscribeToPlanMutation =
    trpc.workspaces.workspace.settings.billing.subscribeToWorkspacePlan.useMutation();
  const billingPortalMutation = trpc.user.getStripeBillingPortal.useMutation();

  function openBillingPortal() {
    const promise = billingPortalMutation
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

  // ReAdmin's hosted service is shutting down - this component is the Premium
  // gate across the whole dashboard, so on readmin.app it explains the shutdown
  // instead of selling a plan nobody can buy anymore.
  if (SUBSCRIPTIONS_CLOSED) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center lg:px-8">
        <span className="inline-flex items-center gap-x-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          <ShieldCheckIcon className="h-4 w-4" />
          ReAdmin is shutting down
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Premium is no longer available
        </h1>
        <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-400">
          We&apos;ve closed new Premium subscriptions and free trials while we
          wind ReAdmin down, so this workspace can&apos;t be upgraded. Everything
          on the free plan keeps working, and existing subscriptions carry on
          until they&apos;re cancelled or they end.
        </p>
        <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-400">
          Read the full{' '}
          <a
            href={SHUTDOWN_INFO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            shutdown notice
          </a>{' '}
          for what happens next and to your data.
        </p>

        {/* Always reachable so anyone who has paid us can confirm for
            themselves, in Stripe, that their subscription has ended. */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left dark:border-white/10 dark:bg-white/5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Check your subscription has ended
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-400">
            Open your Stripe billing portal to see every subscription, invoice,
            and payment method on your account — and to cancel anything that is
            still running.
          </p>
          <button
            type="button"
            onClick={openBillingPortal}
            disabled={billingPortalMutation.isPending}
            className="mt-4 inline-flex items-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-70"
          >
            {billingPortalMutation.isPending ? (
              <LoadingAnimation />
            ) : (
              'Open Stripe billing portal'
            )}
          </button>
        </div>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Questions about your account or your data? Reach us on{' '}
          <a
            href="https://discord.gg/msdjzQNsV2"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Discord
          </a>
          .
        </p>
      </div>
    );
  }

  if (!workspace?.department?.permissions?.admin) {
    return (
      <div className="flex justify-center text-center flex-col gap-1">
        <h1 className="text-2xl font-bold">You are not a workspace admin</h1>
        <p>Please contact a workspace admin to upgrade this workspace!</p>
      </div>
    );
  }

  const tiers: TierType[] = [
    {
      name: 'Free',
      id: 'free',
      price: 'Free',
      description:
        'Everything a small group needs to get organized and start managing staff.',
      features: [
        'Write-ups & punishments',
        'Applications & forms',
        'Tasks & to-dos',
        'Inactivity notices',
        'Unlimited staff members',
        'Community knowledge hub',
      ],
      featured: false,
      trialAvailable: false,
      cta: null,
    },
    {
      name: 'Premium',
      id: 'premium',
      price: { monthly: '$8' },
      description:
        'Unleash the full power of ReAdmin and manage your group with innovation.',
      features: PremiumFeatures,
      footnote: '+ 80¢ per 1,000 users tracked',
      featured: true,
      trialAvailable: workspace?.promotionalRedemptions?.sevenDayTrial !== true,
      cta: `Upgrade ${workspace?.groupName}`,
    },
  ];

  if (!workspace || 'success' in workspace) {
    return <></>;
  }

  async function configureSubscription() {
    if (!workspace || 'success' in workspace) {
      return;
    }

    if (setupAssist && !contact.trim()) {
      toast.error(
        contactMethod === 'email'
          ? 'Please add an email so we can reach you about your setup.'
          : 'Please add your Discord username so we can reach you about your setup.',
      );
      return;
    }

    setIsLoading(true);
    subscribeToPlanMutation
      .mutateAsync({
        groupId: workspace.groupId,
        path: getBaseUrl(),
        ...(setupAssist
          ? {
              setupAssist: {
                contactMethod,
                contact: contact.trim(),
                ...(previousTool.trim()
                  ? { previousTool: previousTool.trim() }
                  : {}),
              },
            }
          : {}),
      })
      .then((req) => {
        if (!req) {
          return;
        }
        toast.success('Please wait as we redirect you');
        window.location.href = req.url;
        setIsLoading(false);
      })
      .catch((e) => {
        setIsLoading(false);
        toast.error(`Something went wrong${e}`);
      });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
      {/* Header */}
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-x-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-blue-300">
          <SparklesIcon className="h-4 w-4" />
          Upgrade your workspace
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Run {workspace.groupName} like a real company
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-400">
          The free plan keeps you organised — but everything that makes ReAdmin
          powerful lives in Premium: real activity tracking, remote admin,
          integrations, sessions, and automation. Start your{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            7-day free trial
          </span>{' '}
          and cancel anytime.
        </p>

        {/* Social proof */}
        <div className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          {TRUST_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Trusted by Washiez, Cineblox, Tsunami Sushi, and 1,000+ Roblox
          communities.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={classNames(
              'relative flex h-full flex-col rounded-3xl p-8 xl:p-10',
              tier.featured
                ? 'border border-blue-500/40 bg-linear-to-b from-blue-500/10 to-transparent shadow-[0_0_60px_-15px_rgba(59,130,246,0.45)] dark:to-white/2'
                : 'border border-gray-200 bg-white dark:border-white/10 dark:bg-white/3',
            )}
          >
            {tier.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-x-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  <BoltIcon className="h-3.5 w-3.5" />
                  Most popular
                </span>
              </div>
            )}

            <h3
              id={tier.id}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {tier.name}
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
              {tier.description}
            </p>

            <p className="mt-6 flex items-baseline gap-x-1">
              <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
                {typeof tier.price === 'string' ? tier.price : tier.price.monthly}
              </span>
              {typeof tier.price !== 'string' ? (
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  /mo
                </span>
              ) : null}
            </p>
            {tier.footnote && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">
                {tier.footnote}
              </p>
            )}

            {tier.cta !== null && (
              <button
                onClick={() => configureSubscription()}
                aria-describedby={tier.id}
                disabled={isLoading}
                className={classNames(
                  'mt-8 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition disabled:opacity-70',
                  tier.featured
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-white/15 dark:text-white dark:hover:bg-white/5',
                )}
              >
                {isLoading ? (
                  <LoadingAnimation />
                ) : (
                  <>{tier.trialAvailable ? 'Try seven days free' : tier.cta}</>
                )}
              </button>
            )}

            {tier.featured && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-gray-500 dark:text-gray-400">
                <ShieldCheckIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                {tier.trialAvailable
                  ? '7-day free trial · Cancel anytime · No contract'
                  : 'Cancel anytime · No long-term contract'}
              </p>
            )}

            <ul
              role="list"
              className="mt-8 space-y-3.5 text-sm leading-6 text-gray-700 dark:text-gray-300"
            >
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-x-3">
                  <CheckIcon
                    className="h-6 w-5 flex-none text-blue-500 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* What Premium unlocks — show, don't just tell */}
      <div className="mt-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Everything Premium unlocks
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
            One upgrade replaces your HR tool, your moderation tool, and the
            spreadsheets in between — all measuring what your staff actually do.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/10 dark:bg-white/10">
          {PREMIUM_HIGHLIGHTS.map((highlight) => (
            <div
              key={highlight.name}
              className="group h-full bg-white p-6 transition hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-400/20 transition group-hover:bg-blue-500/15 group-hover:ring-blue-400/40 dark:bg-white/5 dark:ring-white/10">
                <highlight.icon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {highlight.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {highlight.description}
              </p>
            </div>
          ))}
        </div>

        {/* Testimonial / closing reassurance */}
        <figure className="mx-auto mt-10 max-w-2xl rounded-3xl border border-blue-200 bg-blue-50/60 p-6 text-center dark:border-blue-900/50 dark:bg-blue-900/10">
          <blockquote className="text-base leading-7 text-gray-800 dark:text-gray-200">
            &ldquo;ReAdmin replaced four different tools for us. We finally know
            who our best staff actually are — and ranking happens automatically.&rdquo;
          </blockquote>
          <figcaption className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
            A community management team on ReAdmin Premium
          </figcaption>
        </figure>
      </div>

      {/* Done-for-you setup add-on */}
      <div className="mt-8 rounded-3xl border border-blue-200 bg-blue-50/60 p-6 ring-1 ring-blue-100 dark:border-blue-900/50 dark:bg-blue-900/10 dark:ring-blue-900/40">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={setupAssist}
            onChange={(e) => setSetupAssist(e.target.checked)}
            className="mt-1 h-5 w-5 accent-blue-600"
          />
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                Have us set it up for you
              </span>
              <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                +$15 one-time
              </span>
            </span>
            <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
              Don&apos;t want to do the setup yourself? Add this and our team
              will configure your workspace for you, and bringing over whatever
              data we can from your current tool. It&apos;s added to your first
              invoice.
            </span>
          </span>
        </label>

        {setupAssist && (
          <div className="mt-4 space-y-4 pl-8">
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                How should we reach you to get started?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
                  {(
                    [
                      { value: 'discord', label: 'Discord' },
                      { value: 'email', label: 'Email' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setContactMethod(opt.value)}
                      className={classNames(
                        contactMethod === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                        'rounded-md px-3 py-1.5 text-sm font-medium transition',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input
                  id="setup-contact"
                  type={contactMethod === 'email' ? 'email' : 'text'}
                  value={contact}
                  maxLength={200}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={
                    contactMethod === 'email'
                      ? 'you@example.com'
                      : 'your Discord username (e.g. yourname)'
                  }
                  className="w-full flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Easiest way to get help is our Discord —{' '}
                <a
                  href="https://discord.gg/msdjzQNsV2"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  join the server
                </a>{' '}
                and we&apos;ll get you set up.
              </p>
            </div>

            <div>
              <label
                htmlFor="previous-tool"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Moving from another tool? (optional)
              </label>
              <input
                id="previous-tool"
                type="text"
                value={previousTool}
                maxLength={120}
                onChange={(e) => setPreviousTool(e.target.value)}
                placeholder="e.g. Hyra, Trello, a spreadsheet..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Tell us what you use today and we&apos;ll migrate whatever is
                technically possible to bring across.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
