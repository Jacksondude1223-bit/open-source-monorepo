/* eslint-disable @next/next/no-img-element */
import { CalendarDaysIcon, ClockIcon, IdentificationIcon, InformationCircleIcon, ExclamationTriangleIcon, PlayCircleIcon, PlayIcon, BoltIcon, MoonIcon, ChatBubbleBottomCenterTextIcon, ChatBubbleLeftRightIcon, CalendarIcon, CheckBadgeIcon } from '@heroicons/react/20/solid';
import { ClipboardIcon } from '@heroicons/react/24/outline'
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JSX, ReactElement, useState, useEffect, useRef } from 'react';
import Button from '~/components/forms/Button';
import { DiscordIcon } from '~/components/icons';
import LoadingPage from '~/components/layouts/LoadingPage';
import WorkspaceUserSidebarLayout from '~/components/page_components/workspaces/users/user/WorkspaceUserSidebarLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import TimeAgo from 'react-timeago'
import ReactTimeago from 'react-timeago';


import { LineChart } from '@mui/x-charts/LineChart';
import { SuspicouslyNumberLikeToString } from './activity';
import StatCard from '~/components/ui/StatCard';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import ActivityHeatmap from '~/components/ui/ActivityHeatmap';
import UserTeamsPanel from '~/components/ui/UserTeamsPanel';
import UserPersonalDetailsPanel from '~/components/ui/UserPersonalDetailsPanel';
import Head from 'next/head';
import toast from 'react-hot-toast';
import { openCallDrawer } from '~/components/ui/callDrawerBus';

export const ARRAY_OF_ZERO_THIRTEEN_TIMES: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function StausIndicator({ Icon, title, description, newLines = false, accent = 'gray' }: { Icon: any; title: string; description: JSX.Element | string; newLines?: boolean; accent?: 'gray' | 'blue' | 'green' | 'amber' | 'rose' | 'violet'; }) {
  const accentMap: Record<string, string> = {
    gray: 'text-gray-500 bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300',
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400',
    amber: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400',
    rose: 'text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400',
    violet: 'text-violet-600 bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400',
  };
  return (
    <div className="group flex flex-row items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 px-4 py-3 shadow-sm transition hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentMap[accent]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <small className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</small>
        <div className="mt-0.5 flex flex-row items-start gap-2">
          {newLines ? (
            //@ts-expect-error i made this work
            <p className="w-full break-words text-sm text-gray-800 dark:text-gray-200" id={`${title}-tocopy`}>{description.split("\n").map((ap, i) => {
              return (
                <span key={i}>
                  {ap}
                  <br />
                </span>
              )
            })}</p>
          ) : (
            <p id={`${title}-tocopy`} className="w-full break-words text-sm text-gray-800 dark:text-gray-200">
              {description}
            </p>
          )}
          <button className="opacity-0 transition group-hover:opacity-100" onClick={() => {
            //@ts-expect-error aaa
            navigator.clipboard.writeText(document.getElementById(`${title}-tocopy`)?.innerText);
          }}>
            <ClipboardIcon className="h-4 w-4 text-gray-300 transition hover:text-blue-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const utils = trpc.useUtils();
  const { data: userInfo } = trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery({ groupId, userId });
  const { data: availableYears } = trpc.workspaces.workspace.activity.users.activity.getAvailableYears.useQuery({ groupId, userId });
  const { data: yearlySummary } = trpc.workspaces.workspace.activity.users.activity.getYearlySummary.useQuery({ groupId, userId, year: selectedYear.toString() });
  const backfillSummaries = trpc.workspaces.workspace.activity.users.activity.backfillSummaries.useMutation({
    onSuccess: () => {
      utils.workspaces.workspace.activity.users.activity.getYearlySummary.invalidate({ groupId, userId, year: selectedYear.toString() });
    },
  });

  const startCall = trpc.workspaces.workspace.calls.startCall.useMutation({
    onSuccess: ({ callId }) => {
      toast.success('Chat started');
      openCallDrawer(callId);
    },
    onError: (e) => {
      toast.error(e.message || 'Could not start chat');
    },
  });

  // Premium-only: if a year has summary minutes but no daily heatmap buckets,
  // it predates daily tracking — trigger a one-time recalc to backfill them.
  const backfillTriggered = useRef(false);
  useEffect(() => {
    if (backfillTriggered.current) return;
    if (!workspace?.premium?.is) return;
    if (!yearlySummary || !(yearlySummary as any).summaries) return;
    const summaries = (yearlySummary as any).summaries;
    const hasMinutes = ((yearlySummary as any).minutes?.total || 0) > 0;
    const hasDays = summaries.days && Object.keys(summaries.days).length > 0;
    if (hasMinutes && !hasDays && !backfillSummaries.isPending) {
      backfillTriggered.current = true;
      backfillSummaries.mutate({ groupId, userId });
    }
  }, [yearlySummary, workspace, groupId, userId, backfillSummaries]);


  if (!workspace) {
    return <LoadingPage />;
  }

  if (!workspace?.department?.permissions?.activity?.view) {
    if (typeof (window) !== undefined) {
      router.push(`/workspaces/${groupId}`)
    }
    return <></>;
  }

  if (userInfo?.role?.rank == 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">This user is not in this workspace.</p>
        <Button variant="primary" href={`/workspaces/${groupId}/users`} className='mt-4 w-full max-w-sm'>Back to Users</Button>
      </div>
    )
  }


  return (
    <>
      <Head>
        <title>{workspace?.premium?.is ? '' : 'ReAdmin '}{workspace?.groupName || ''} {userInfo?.robloxInfo?.name || ''} Info</title>
      </Head>

      <div className='animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out flex flex-col gap-6'>
        <>
          <div className="flex flex-row items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <CalendarIcon className="h-4 w-4" /> Activity Overview
            </h3>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Year</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm transition hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-600"
              >
                {(availableYears && availableYears.length > 0
                  ? availableYears.map((y) => parseInt(y))
                  : [selectedYear]
                )
                  .filter((y, i, arr) => arr.indexOf(y) === i)
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard accent="blue" icon={ClockIcon} label="Total this Year" loading={yearlySummary == null} value={SuspicouslyNumberLikeToString(
              //@ts-expect-error hello world!
              yearlySummary?.minutes?.total || 0
            )} hint="time tracked" />
            <StatCard accent="green" icon={BoltIcon} label="Active this Year" loading={yearlySummary == null} value={SuspicouslyNumberLikeToString(
              //@ts-expect-error hello world!
              yearlySummary?.minutes?.active || 0
            )} hint="active time" />
            <StatCard accent="amber" icon={MoonIcon} label="Idle this Year" loading={yearlySummary == null} value={SuspicouslyNumberLikeToString(
              //@ts-expect-error hello world!
              yearlySummary?.minutes?.inactive || 0
            )} hint="idle time" />
            <StatCard accent="violet" icon={ChatBubbleBottomCenterTextIcon} label="Typing this Year" loading={yearlySummary == null} value={SuspicouslyNumberLikeToString(
              //@ts-expect-error hello world!
              yearlySummary?.minutes?.typing || 0
            )} hint="typing time" />
            <StatCard accent="cyan" icon={ChatBubbleLeftRightIcon} label="Messages this Year" loading={yearlySummary == null} value={(
              //@ts-expect-error hello world!
              yearlySummary?.minutes?.messages || 0
            ).toLocaleString()} hint="sent in-game" />
            <StatCard accent="rose" icon={CalendarIcon} label="Sessions this Year" loading={yearlySummary == null} value={(
              //@ts-expect-error hello world!
              yearlySummary?.attendedSessions?.length || 0
            ).toLocaleString()} hint="attended" />
          </div>

          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition dark:border-gray-700/80 dark:bg-gray-800/80">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Monthly Breakdown</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">Last 12 months</span>
              </div>
              <LineChart
                className="w-full min-h-[400px] max-h-96 transition dark:bg-transparent dark:text-gray-100 text-gray-900"
                loading={yearlySummary == null}
                margin={{ left: 12, right: 16, top: 24, bottom: 24 }}
                grid={{ horizontal: true }}
                xAxis={[{ scaleType: 'point', data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }]}
                series={[
                  {
                    label: 'Active', showMark: false, color: '#10b981',
                    //@ts-expect-error hello world!
                    data: !yearlySummary?.summaries ? ARRAY_OF_ZERO_THIRTEEN_TIMES : Object.keys(yearlySummary?.summaries?.months || {})?.map((weekNum) => yearlySummary.summaries.months[parseInt(weekNum.toString())].minutes.active).slice(1, 13) || ARRAY_OF_ZERO_THIRTEEN_TIMES
                  }, {
                    label: 'Idle', showMark: false, color: '#f59e0b',
                    //@ts-expect-error hello world!
                    data: !yearlySummary?.summaries ? ARRAY_OF_ZERO_THIRTEEN_TIMES : Object.keys(yearlySummary?.summaries?.months || {})?.map((weekNum) => yearlySummary.summaries.months[parseInt(weekNum.toString())].minutes.inactive).slice(1, 13) || ARRAY_OF_ZERO_THIRTEEN_TIMES
                  }, {
                    label: 'Typing', showMark: false, color: '#8b5cf6',
                    //@ts-expect-error hello world!
                    data: !yearlySummary?.summaries ? ARRAY_OF_ZERO_THIRTEEN_TIMES : Object.keys(yearlySummary?.summaries?.months || {})?.map((weekNum) => yearlySummary.summaries.months[parseInt(weekNum.toString())].minutes.typing).slice(1, 13) || ARRAY_OF_ZERO_THIRTEEN_TIMES
                  },
                ]}
              />
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition dark:border-gray-700/80 dark:bg-gray-800/80">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Weekly Trend</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">Across the year</span>
              </div>
              <LineChart
                className="w-full min-h-[400px] max-h-96 transition dark:bg-transparent dark:text-gray-100 text-gray-900"
                loading={yearlySummary == null}
                margin={{ left: 12, right: 16, top: 24, bottom: 24 }}
                grid={{ horizontal: true }}
                //@ts-expect-error hello world!
                xAxis={[{ scaleType: 'point', data: Object.keys(yearlySummary?.summaries?.weeks || Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0).map(a => parseInt(a.toString()))) }]}
                series={[
                  {
                    label: 'Active', showMark: false, color: '#10b981',
                    //@ts-expect-error hello world!
                    data: !yearlySummary?.summaries?.weeks ? Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0) : Object.keys(yearlySummary?.summaries?.weeks || {})?.map((weekNum) => yearlySummary.summaries.weeks[parseInt(weekNum.toString())].minutes.active) || []
                  }, {
                    label: 'Idle', showMark: false, color: '#f59e0b',
                    //@ts-expect-error hello world!
                    data: !yearlySummary?.summaries?.weeks ? Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0) : Object.keys(yearlySummary?.summaries?.weeks || {})?.map((weekNum) => yearlySummary.summaries.weeks[parseInt(weekNum.toString())].minutes.inactive) || []
                  }, {
                    label: 'Typing', showMark: false, color: '#8b5cf6',
                    //@ts-expect-error hello world!
                    data: !yearlySummary?.summaries?.weeks ? Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0) : Object.keys(yearlySummary?.summaries?.weeks || {})?.map((weekNum) => yearlySummary.summaries.weeks[parseInt(weekNum.toString())].minutes.typing) || []
                  },
                ]}
              />
            </div>
          </div>

          <ActivityHeatmap
            year={selectedYear}
            loading={yearlySummary == null}
            //@ts-expect-error days are added to the yearly summary
            days={yearlySummary?.summaries?.days}
          />
        </>


        {!userInfo ? (
          <>
            <LoadingAnimation />
          </>
        ) : (
          <div className="w-full">

            {(userInfo?.playerInGame && userInfo?.gameSession && userInfo?.gameSession?.game && userInfo?.gameSession?.runningGame && userInfo?.gameSession?.session) && (
              <div className="relative my-4 flex flex-row flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-blue-50 px-5 py-4 dark:border-emerald-700/50 dark:from-emerald-900/20 dark:to-blue-900/20">
                <div className="flex flex-row items-center gap-4">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                  <PlayCircleIcon className='h-7 w-7 self-center text-emerald-500' />
                  <div className="flex flex-col">
                    <p className="text-lg font-bold">Currently Playing <Link className="transition hover:text-blue-500" href={`https://www.roblox.com/games/${userInfo?.gameSession?.game?.placeId}/aaaaa`} target="__blank">{userInfo.gameSession.game.name}</Link></p>
                    <small className="text-gray-600 dark:text-gray-400">Joined <TimeAgo date={userInfo?.gameSession?.session?.created} /> · {userInfo?.gameSession?.events ? userInfo?.gameSession?.events[userInfo?.gameSession?.events?.length - 1]?.type : ''}</small>
                  </div>
                </div>
                <div className="flex flex-row items-center gap-2 self-center">
                  {(workspace?.department?.permissions?.admin || workspace?.department?.permissions?.calls?.manage) && (
                    <Button variant="default" size="medium" className="align-middle" disabled={startCall.isPending} onClick={(a) => {
                      a.preventDefault();
                      startCall.mutate({ groupId, userId });
                    }}>{startCall.isPending ? 'Starting…' : 'Start Chat'}</Button>
                  )}
                  <Button variant="blue" size="medium" className="align-middle" onClick={(a) => {
                    a.preventDefault();
                    window.open(
                      `https://www.roblox.com/games/start?placeId=${userInfo.gameSession.game?.placeId || ''}&launchData=ReAdmin-${userInfo?.gameSession?.runningGame?.jobId || ''}`,
                      '__blank',
                    );
                  }}>Join Game</Button>
                </div>
              </div>
            )}



            {(workspace?.teamsSettings?.enabled !== false)
              && (workspace?.department?.permissions?.admin
              || workspace?.department?.permissions?.teams?.view
              || workspace?.department?.permissions?.teams?.manage
              || workspace?.department?.permissions?.teams?.manageAll) && (
              <UserTeamsPanel groupId={groupId} userId={userId} brandColor={workspace.brandColor || 'blue'} />
            )}


            {(workspace?.department?.permissions?.admin
              || workspace?.department?.permissions?.profile?.view) && (
              <UserPersonalDetailsPanel groupId={groupId} userId={userId} />
            )}


            {userInfo?.robloxInfo && (
              <div className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <IdentificationIcon className="h-4 w-4" /> User Details
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <StausIndicator accent="blue" Icon={InformationCircleIcon} title={'Roblox Description'} newLines={true} description={userInfo.robloxInfo.description || 'No description set'} />
                  </div>
                  <StausIndicator accent="green" Icon={PlayIcon} title={'Last Seen in Game'} newLines={false} description={userInfo?.lastSession ? (<ReactTimeago date={new Date(userInfo.lastSession.created)} />) : 'Never tracked'} />
                  <StausIndicator accent="gray" Icon={IdentificationIcon} title={'Roblox User ID'} description={userInfo?.robloxInfo?.id?.toString() || 'Unknown'} />
                  <StausIndicator accent="violet" Icon={DiscordIcon} title={'Discord ID'} description={userInfo?.readminUser?.discordId ? userInfo.readminUser.discordId : 'User does not have a linked Discord'} />
                  <StausIndicator accent={userInfo.currentInactivity == null ? 'green' : 'amber'} Icon={ClockIcon} title={'ReAdmin Activity Status'} description={userInfo.currentInactivity == null ? 'Not on leave' : (
                    <>User is on leave - {userInfo.currentInactivity?.reason} - returning <ReactTimeago date={userInfo.currentInactivity?.ends} /></>
                  )} />
                  <StausIndicator accent={userInfo.robloxInfo.isBanned ? 'rose' : 'green'} Icon={userInfo.robloxInfo.isBanned ? ExclamationTriangleIcon : CheckBadgeIcon} title={'Roblox Ban Status'} description={userInfo.robloxInfo.isBanned ? 'User is currently banned by Roblox' : 'User is not banned by Roblox'} />
                  <StausIndicator accent="gray" Icon={CalendarDaysIcon} title={'ReAdmin Created'} description={userInfo.readminUser ? new Date(userInfo.readminUser.created).toLocaleString() : 'User has not created ReAdmin account'} />
                  <StausIndicator accent="gray" Icon={CalendarDaysIcon} title={'Roblox Created'} description={new Date(userInfo.robloxInfo.created).toLocaleString()} />
                </div>
              </div>
            )}


          </div>
        )}
      </div>

    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceUserSidebarLayout>{page}</WorkspaceUserSidebarLayout>
);
