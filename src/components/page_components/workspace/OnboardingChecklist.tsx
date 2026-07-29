import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { trpc } from '~/utils/trpc';
import { useWorkspace } from '~/components/contexts/workspace';

type StepKey =
  | 'linkedRoblox'
  | 'linkedDiscord'
  | 'installedModule'
  | 'trackedActivity'
  | 'createdView'
  | 'invitedStaff';

const STEP_CONFIG: {
  key: StepKey;
  title: string;
  why: string;
  href: (groupId: string) => string;
  cta: string;
  /** Step depends on a Premium plan — disclosed to non-premium workspaces. */
  premium?: boolean;
}[] = [
  {
    key: 'linkedRoblox',
    title: 'Link your Roblox group',
    why: 'Lets ReAdmin sync your members, roles, and rank on your behalf.',
    href: (g) => `/workspaces/${g}/settings/integrations`,
    cta: 'Connect Roblox',
  },
  {
    key: 'linkedDiscord',
    title: 'Link your Discord server',
    why: 'Mirror activity logs and run ReAdmin commands from Discord. Available on Premium plans.',
    href: (g) => `/workspaces/${g}/settings/integrations`,
    cta: 'Connect Discord',
    premium: true,
  },
  {
    key: 'installedModule',
    title: 'Install the activity tracker in your game',
    why: 'Download the ReAdmin module, drop it into ServerScriptService in Roblox Studio, and publish. This is what records staff activity and powers live remote admin in your game.',
    href: (g) => `/workspaces/${g}/settings/downloads`,
    cta: 'Download & install',
  },
  {
    key: 'trackedActivity',
    title: 'See your first tracked session',
    why: 'Once the module is published, join your game for a minute. ReAdmin starts logging active, idle and typing time — confirming everything is wired up correctly.',
    href: (g) => `/workspaces/${g}/settings/downloads`,
    cta: 'See setup steps',
  },
  {
    key: 'createdView',
    title: 'Create your first View',
    why: 'Turns raw activity into the report your team actually needs.',
    href: (g) => `/workspaces/${g}/views`,
    cta: 'Create a View',
  },
  {
    key: 'invitedStaff',
    title: 'Set up departments & invite your staff',
    why: 'Departments are how you control access — pick a template (LR / MR / HR), then add your staff so they can see and do the right things. Set these up first; you can add Teams for reporting later.',
    href: (g) => `/workspaces/${g}/settings/departments`,
    cta: 'Set up departments',
  },
];

export default function OnboardingChecklist({ groupId }: { groupId: string }) {
  const { data } = trpc.workspaces.workspace.getOnboardingStatus.useQuery({ groupId });
  const workspace = useWorkspace();
  const isPremium = !!workspace?.premium?.is;
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(`readmin-onboarding-dismissed-${groupId}`) === 'true');
  }, [groupId]);

  if (!data || data.activated || dismissed) {
    return null;
  }

  const { steps, completedCount, totalCount } = data;
  const percent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="mb-4 rounded-lg border border-gray-300 bg-gray-100 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4 p-6 pb-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            🚀 Get your workspace ready
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {completedCount} of {totalCount} steps complete — finish setup to unlock
            the full power of ReAdmin.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {collapsed ? (
              <ChevronDownIcon className="h-5 w-5" />
            ) : (
              <ChevronUpIcon className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(`readmin-onboarding-dismissed-${groupId}`, 'true');
              setDismissed(true);
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <ul className="divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {STEP_CONFIG.map((step) => {
            const done = steps[step.key];
            return (
              <li
                key={step.key}
                className="flex items-center gap-4 px-6 py-3.5"
              >
                <CheckCircleIcon
                  className={`h-6 w-6 flex-none ${
                    done
                      ? 'text-green-500'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`flex flex-wrap items-center gap-2 text-sm font-medium ${
                      done
                        ? 'text-gray-400 line-through dark:text-gray-500'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {step.title}
                    {step.premium && !isPremium && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 no-underline dark:bg-blue-900/40 dark:text-blue-300">
                        Premium
                      </span>
                    )}
                  </p>
                  {!done && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {step.why}
                    </p>
                  )}
                </div>
                {!done && (
                  <Link
                    href={step.href(groupId)}
                    className="flex-none rounded-md bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                  >
                    {step.cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!collapsed && (
        <div className="border-t border-gray-200 bg-blue-50 px-6 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-blue-900/10 dark:text-gray-300">
          <span className="font-semibold text-gray-800 dark:text-gray-100">Departments vs Teams:</span>{' '}
          Start with <span className="font-medium">Departments</span> — they decide what your staff can
          access (permissions). Add <span className="font-medium">Teams</span> afterwards to manage
          direct reports and route time-off / expense approvals. We recommend setting up departments first.
        </div>
      )}

      <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Need help?{' '}
        <Link
          href="https://discord.gg/msdjzQNsV2"
          target="_blank"
          className="font-medium text-blue-600 underline dark:text-blue-400"
        >
          Open a setup ticket in our support server
        </Link>
        .
      </div>
    </div>
  );
}
