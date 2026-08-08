import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState, useRef } from 'react';
import AuthedLayout from '~/components/layouts/PageLayout';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import SectionHeader from '~/components/ui/SectionHeader';
import OngoingCallsWidget from '~/components/page_components/workspaces/calls/OngoingCallsWidget';
import { BriefcaseIcon, Cog8ToothIcon, HomeIcon, PencilSquareIcon, UsersIcon, PhoneIcon, ArrowUpCircleIcon, UserGroupIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/solid';
import { Command } from 'cmdk';
import * as Popover from '@radix-ui/react-popover'
import { faBarsProgress, faCalendarDays, faCarrot, faCircleInfo, faListCheck, faRobot, faTable, faUmbrellaBeach, faUserClock, faUserShield } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link';
import JSONPretty from 'react-json-pretty';
import LoadingPage from '../layouts/LoadingPage';
import PageSkeleton from '~/components/ui/PageSkeleton';
import { BRAND_NAME, BRAND_WORDMARK_DARK } from '~/utils/brand';

type DefaultLayoutProps = { children: ReactNode, disableMl?: boolean };


const CommandMenu = () => {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const containerElement = useRef(null)


  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: any) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger>Toggle popover</Popover.Trigger>

        <Popover.Content className='h-screen w-screen z-999'>
          <Command>
            <Command.Input />
            <Command.List>
              <Command.Empty>No results found.</Command.Empty>

              <Command.Group heading="Letters">
                <Command.Item>This is a test</Command.Item>
                <Command.Item>Testing</Command.Item>
                <Command.Separator />
                <Command.Item>123455666</Command.Item>
              </Command.Group>

              <Command.Item>Hello again</Command.Item>
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Root>
    </>
  )
}

export const WorkspaceLayout = ({ children, disableMl }: DefaultLayoutProps) => {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const path = router.asPath;
  const user = useUser();
  const workspace = useWorkspace();
  const { error, isError } = trpc.workspaces.workspace.getWorkspace.useQuery({ groupId: groupId as string }, { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false });

  const { data: workspaceLogo } = trpc.workspaces.workspace.getWorkspaceLogo.useQuery({ groupId }, { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false });

  if (!groupId) {
    return (
      <AuthedLayout
        navigation={[{ name: 'Back to Dashboard', href: '/dashboard', icon: HomeIcon, current: false }]}
      >
        <Head>
          <title>{BRAND_NAME}</title>
          <link rel="icon" href={workspaceLogo || BRAND_WORDMARK_DARK} />
        </Head>

        <PageSkeleton sections={3} className="mx-8 mt-6" />

      </AuthedLayout>
    )
  }

  if (isError) {
    return (
      <AuthedLayout
        navigation={[{ name: 'Back to Dashboard', href: '/dashboard', icon: HomeIcon, current: false }]}
      >
        <Head>
          <title>{BRAND_NAME}</title>
          <link rel="icon" href={workspaceLogo || BRAND_WORDMARK_DARK} />
        </Head>

        <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="h-1.5 w-full bg-amber-500 dark:bg-amber-500/80" />
            <div className="flex flex-col items-center gap-5 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Couldn&apos;t open this workspace
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You may no longer have access, or your membership couldn&apos;t be confirmed. If you were just added, give it a moment and try again.
                </p>
              </div>

              {error?.message && (
                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left dark:border-gray-800 dark:bg-gray-800/50">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Details
                  </p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {error.message}
                  </p>
                </div>
              )}

              <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 dark:focus:ring-offset-gray-900"
                >
                  <HomeIcon className="h-4 w-4" />
                  Back to Dashboard
                </Link>
                <button
                  onClick={() => router.reload()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-900"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </main>

      </AuthedLayout>
    )
  }

  if (workspace?.banStatus?.is == true && (`user` in user && user.user?.dbUser.role !== 'Founder')) {
    return (
      <AuthedLayout
        navigation={[{ name: 'Back to Dashboard', href: '/dashboard', icon: HomeIcon, current: false }]}
      >
        <Head>
          <title>{BRAND_NAME}</title>
          <link rel="icon" href={workspaceLogo || BRAND_WORDMARK_DARK} />
        </Head>

        <main>
          <SectionHeader title="Workspace is banned" />
          <p className="font-bold text-lg">This workspace has been banned from ReAdmin.</p>
          <p>If you believe this is a mistake, please contact the workspace owner.</p>
          <p>Ban reason: {workspace?.banStatus?.reason}</p>
        </main>

      </AuthedLayout>
    )
  }


  const DashboardUrl = `/workspaces/${groupId}`;
  const UsersUrl = `/workspaces/${groupId}/users`;
  const TimeOffUrl = `/workspaces/${groupId}/time-off`;
  const GamesUrl = `/workspaces/${groupId}/games`;
  const CallsUrl = `/workspaces/${groupId}/calls`;
  const ViewsUrl = `/workspaces/${groupId}/views`;
  const HubUrl = `/workspaces/${groupId}/hub`;
  const FormsUrl = `/workspaces/${groupId}/forms`;
  const PostingsUrl = `/workspaces/${groupId}/postings`;
  const OrdersUrl = `/workspaces/${groupId}/orders`;
  const TasksUrl = `/workspaces/${groupId}/tasks`;
  const SessionsUrl = `/workspaces/${groupId}/sessions`;
  const TimeclockUrl = `/workspaces/${groupId}/timeclock`;
  const EmployeeHistoryUrl = `/workspaces/${groupId}/employee-history`;
  const FlowsUrl = `/workspaces/${groupId}/flows`;
  const PromotionRequestsUrl = `/workspaces/${groupId}/promotion-requests`;
  const TeamsUrl = `/workspaces/${groupId}/teams`;
  const SettingsUrl = `/workspaces/${groupId}/settings`;

  const nav = [
    {
      name: 'Home',
      href: DashboardUrl,
      current: path == DashboardUrl || path.includes('/personal'),
      icon: HomeIcon,
      canShow: true,
    },
    {
      name: 'Users',
      href: UsersUrl,
      current: path?.startsWith(UsersUrl) || false,
      icon: UsersIcon,
      canShow: workspace?.department?.permissions?.activity?.view,
      premiumOnly: !workspace?.premium?.is,
    },
    {
      name: 'Time Off',
      href: TimeOffUrl,
      current: path?.startsWith(TimeOffUrl) || false,
      icon: faUmbrellaBeach,
      faIcon: true,
      canShow: true,
      premiumOnly: false,
    },
    {
      name: 'Timeclock',
      href: TimeclockUrl,
      current: path?.startsWith(TimeclockUrl) || false,
      icon: ClockIcon,
      canShow: workspace?.timeclockSettings?.enabled === true && (workspace?.department?.permissions?.timeclock?.view || workspace?.department?.permissions?.timeclock?.manage || workspace?.department?.permissions?.timeclock?.edit || workspace?.department?.permissions?.admin),
    },
    {
      name: 'Games',
      href: GamesUrl,
      current: path?.startsWith(GamesUrl) || false,
      icon: faBarsProgress,
      faIcon: true,
      canShow: workspace?.department?.permissions?.games?.manageBans || workspace?.department?.permissions?.games?.view,
      premiumOnly: !workspace?.premium?.is,
    },
    {
      name: 'Calls',
      href: CallsUrl,
      current: path?.startsWith(CallsUrl) || false,
      icon: PhoneIcon,
      canShow: workspace?.department?.permissions?.calls?.view || workspace?.department?.permissions?.calls?.manage || workspace?.department?.permissions?.admin,
      premiumOnly: !workspace?.premium?.is,
    },
    {
      name: 'Hub',
      href: HubUrl,
      current: path?.startsWith(HubUrl) || false,
      icon: faCircleInfo,
      faIcon: true,
      canShow: true,
      premiumOnly: false,
    },
    {
      name: 'Sessions',
      href: SessionsUrl,
      current: path?.startsWith(SessionsUrl) || false,
      icon: faCalendarDays,
      faIcon: true,
      canShow: workspace?.department?.permissions?.sessions?.view,
      premiumOnly: !workspace?.premium?.is,
    },
    {
      name: 'Views',
      href: ViewsUrl,
      current: path?.startsWith(ViewsUrl) || false,
      icon: faTable,
      faIcon: true,
      premiumOnly: !workspace?.premium?.is,
      canShow: workspace?.department?.permissions?.reports?.view,
    },
    {
      name: 'Orders',
      href: OrdersUrl,
      current: path?.startsWith(OrdersUrl) || false,
      icon: faCarrot,
      faIcon: true,
      canShow: false,
        /*workspace?.enabledModules?.orders &&
        (workspace?.department?.permissions?.admin ||
          workspace?.department?.permissions?.orders?.view ||
          workspace?.department?.permissions?.orders?.manage ||
          workspace?.department?.permissions?.orders?.manageProducts ||
          workspace?.department?.permissions?.orders?.manageSettings), */
      premiumOnly: !workspace?.premium?.is,
    },
    {
      name: 'Staff History',
      href: EmployeeHistoryUrl,
      current: path?.startsWith(EmployeeHistoryUrl) || false,
      icon: faUserClock,
      faIcon: true,
      canShow: workspace?.department?.permissions?.writeUps?.promote || workspace?.department?.permissions?.writeUps?.writeUps || workspace?.department?.permissions?.writeUps?.terminations || workspace?.department?.permissions?.writeUps?.suspensions,
    },
    {
      name: 'Forms',
      href: FormsUrl,
      current: path?.startsWith(FormsUrl) || false,
      icon: PencilSquareIcon,
      canShow: workspace?.department?.permissions?.applications?.viewApplications,
    },
    {
      name: 'Job Postings',
      href: PostingsUrl,
      current: path?.startsWith(PostingsUrl) || false,
      icon: BriefcaseIcon,
      canShow:
        workspace?.department?.permissions?.admin ||
        workspace?.department?.permissions?.postings?.canManage ||
        workspace?.department?.permissions?.postings?.canViewApplicants,
    },
    {
      name: 'Promotions',
      href: PromotionRequestsUrl,
      current: path?.startsWith(PromotionRequestsUrl) || false,
      icon: ArrowUpCircleIcon,
      canShow: workspace?.department?.permissions?.promotionRequests?.view || workspace?.department?.permissions?.promotionRequests?.manage,
    },
    {
      name: 'Tasks',
      href: TasksUrl,
      faIcon: true,
      current: path?.startsWith(TasksUrl) || false,
      icon: faListCheck,
      canShow: true,
    },
    {
      name: 'Flows',
      href: FlowsUrl,
      current: path?.startsWith(FlowsUrl) || false,
      icon: faRobot,
      faIcon: true,
      canShow: workspace?.department?.permissions?.admin,
      premiumOnly: !workspace?.premium?.is,
    },
    {
      name: 'Teams',
      href: TeamsUrl,
      current: path?.startsWith(TeamsUrl) || false,
      icon: UserGroupIcon,
      canShow: (workspace?.teamsSettings?.enabled !== false) && (workspace?.department?.permissions?.teams?.view || workspace?.department?.permissions?.teams?.manage || workspace?.department?.permissions?.teams?.manageAll || workspace?.department?.permissions?.admin),
    },
    {
      name: 'Settings',
      href: SettingsUrl,
      current: path?.startsWith(SettingsUrl) || false,
      icon: Cog8ToothIcon,
      canShow: workspace?.department?.permissions?.admin,
    },
  ];


  if (workspace?.banStatus?.is) {
    return (
      <AuthedLayout
        navigation={[{ name: 'Back to Dashboard', href: '/dashboard', icon: HomeIcon, current: false }]}
      >
        <Head>
          <title>{BRAND_NAME}</title>
          <link rel="icon" href={workspaceLogo || BRAND_WORDMARK_DARK} />
        </Head>

        {workspace.banStatus.bannedBy == 'billing' ? (
          <main>
            <SectionHeader title="Workspace is banned" />
            <p className="font-bold text-lg">This workspace has been banned for non-payment</p>
            <p>If you believe this is a mistake, please contact the person who manages your workspace billing.</p>
            <p>Ban reason: {workspace?.banStatus?.reason}</p>
          </main>
        ) : (
          <main>
            <SectionHeader title="Workspace is banned" />
            <p className="font-bold text-lg">This workspace has been banned from ReAdmin.</p>
            <p>If you believe this is a mistake, please contact the workspace owner.</p>
            <p>Ban reason: {workspace?.banStatus?.reason}</p>
          </main>
        )}

      </AuthedLayout>
    )
  }

  return (
    <AuthedLayout
      disableMl={disableMl}
      overwriteImage={workspaceLogo}
      brandColor={workspace?.brandColor || 'blue'}
      navigation={nav}
    >
      <Head>
        <title>{workspace?.premium?.is ? '' : `${BRAND_NAME} `}{workspace?.groupName} {nav.find(p => p.current)?.name || ''}</title>
        <link rel="icon" href={workspaceLogo || BRAND_WORDMARK_DARK} />
      </Head>

      {/* <CommandMenu /> */}
      {workspace?.department?.permissions?.admin && !workspace?.premium?.is && !workspace?.usingOpenCloud && (
        <div id="alerts" className="">
          <div className="relative overflow-hidden rounded-l-none rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 shadow-sm">
            <div className="absolute inset-y-0 left-0 w-1 bg-red-500 dark:bg-red-500/80" />
            <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Action required: Link your Roblox Open Cloud integration
                  </h3>
                  <p className="mt-1 text-sm text-red-700/90 dark:text-red-300/80">
                    ReAdmin relies on Open Cloud to read your workspace&apos;s members, roles, and other Roblox data, and to perform actions within Roblox. Until you link it, you&apos;ll run into unexpected site issues and missing or outdated data.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                  <Link
                    href={`/workspaces/${groupId}/settings/integrations`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-red-950"
                  >
                    Set up integration
                    <ArrowUpCircleIcon className="h-4 w-4 rotate-90" />
                  </Link>
                  <Link
                    href={`https://docs.readmin.app/other/workspace-roblox-integration`}
                    target="_blank"
                    className="text-sm font-medium text-red-700 underline-offset-2 transition hover:text-red-600 hover:underline dark:text-red-300 dark:hover:text-red-200"
                  >
                    Learn more
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {(path?.startsWith(SettingsUrl) && !workspace?.department?.permissions?.admin) ? (
        <main className='text-center'>
          <p className="font-bold text-lg">You are not a workspace admin!</p>
          <p className="text-lg">You have not been given permission to edit the settings of this workspace, contact your workspace admin if you believe this is a mistake.</p>
        </main>
      ) : (<>
        {children}
      </>)
      }
      <OngoingCallsWidget />
    </AuthedLayout >
  );
};
