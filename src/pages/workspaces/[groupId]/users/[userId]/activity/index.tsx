/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import Dropdown from '~/components/forms/Dropdown';
import DistributionSelector from '~/components/forms/DistributionSelector';
import LoadingPage from '~/components/layouts/LoadingPage';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Card from '~/components/ui/Card';

import Link from 'next/link';
import { Game, UserGameSession, UserGameSessionEvent } from '~/services/NewMongoTypes';
import Modal from '~/components/ui/Modal';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import Button from '~/components/forms/Button';
import SectionHeader from '~/components/ui/SectionHeader';
import TextLabel from '~/components/forms/TextLabel';
import toast from 'react-hot-toast';
import React from 'react';
import Head from 'next/head';
import UsersUpsale from '~/components/page_components/workspaces/users/user/UsersUpsale';
import { ActivitygoalNumberType } from '~/services/NewMongoTypes/UserGameSessionDistributionSummary.type';
import JSONPretty from 'react-json-pretty';
import Line from '~/components/NextGenStyles/Line';
import StatCard from '~/components/ui/StatCard';
import { ClockIcon, BoltIcon, MoonIcon, ChatBubbleBottomCenterTextIcon, ChatBubbleLeftRightIcon, CalendarIcon, TrophyIcon, CheckBadgeIcon, ChartBarIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { BRAND_NAME } from '~/utils/brand';

export function SuspicouslyNumberLikeToString(number: any, isTime = true) {
  if (isTime == false) {
    return number
  } else {
    const actualTime = number * 60;
    const minutes = Math.floor(actualTime / 60).toString();
    const seconds = Math.floor(actualTime % 60);
    return parseFloat(minutes) > 60 ? parseFloat(minutes).toLocaleString() : `${minutes}:${seconds.toString().length == 1 ? `0${seconds}` : seconds}`
  }
}

export function BoxWithMinutes({ title, desc, time = true, disableForThisDistribution }: { title: string; desc: number; time?: boolean; disableForThisDistribution?: boolean; }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 grow shadow-sm">
      <p className='font-bold text-2xl text-left text-gray-900 dark:text-gray-100'>{SuspicouslyNumberLikeToString(desc, time)}</p>
      <p className="font-medium text-sm text-left text-gray-600 dark:text-gray-400">{title}</p>
      {disableForThisDistribution !== true && (<p className='text-xs text-gray-400 dark:text-gray-500'>for this distribution</p>)}
    </div>
  )
}
export function BoxForSession({ title, desc, time = true }: { title: string; desc: any; time?: boolean; }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 grow shadow-sm">
      <p className='text-gray-900 dark:text-gray-100 font-bold text-lg'>{SuspicouslyNumberLikeToString(desc, time)}</p>
      <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">{title}</p>
    </div>
  )
}

function InlineSessionStat({ title, desc, time = true, accent }: { title: string; desc: any; time?: boolean; accent?: string; }) {
  return (
    <div className="text-right">
      <p className={`text-sm font-bold tabular-nums leading-tight ${accent || 'text-gray-900 dark:text-gray-100'}`}>{SuspicouslyNumberLikeToString(desc, time)}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</p>
    </div>
  )
}

const SESSION_STAT_ACCENTS: Record<string, { icon: string; ring: string }> = {
  blue: { icon: 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400', ring: 'hover:border-blue-300 dark:hover:border-blue-500/40' },
  emerald: { icon: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400', ring: 'hover:border-emerald-300 dark:hover:border-emerald-500/40' },
  amber: { icon: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400', ring: 'hover:border-amber-300 dark:hover:border-amber-500/40' },
  violet: { icon: 'text-violet-600 bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400', ring: 'hover:border-violet-300 dark:hover:border-violet-500/40' },
  cyan: { icon: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-400', ring: 'hover:border-cyan-300 dark:hover:border-cyan-500/40' },
  rose: { icon: 'text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400', ring: 'hover:border-rose-300 dark:hover:border-rose-500/40' },
};

function SessionStatTile({ icon: Icon, title, desc, accent, time = true }: { icon: any; title: string; desc: any; accent: keyof typeof SESSION_STAT_ACCENTS; time?: boolean; }) {
  const styles = SESSION_STAT_ACCENTS[accent] ?? SESSION_STAT_ACCENTS.blue!;
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition dark:border-gray-700/80 dark:bg-gray-800/80 ${styles.ring}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{SuspicouslyNumberLikeToString(desc, time)}</p>
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const [selectedDistributionNumber, setSelectedDistribution] = useState<null | number>(null);
  const { data: distributions } = trpc.workspaces.workspace.settings.distributions.get.useQuery({ groupId }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const { data: goals } = trpc.workspaces.workspace.settings.activityGoals.getGoals.useQuery({ groupId }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false });

  const { data: distributionSessions } = trpc.workspaces.workspace.activity.users.activity.getDistributionSessions.useQuery({ groupId, distributionNumber: selectedDistributionNumber, userId }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const { data: distributionSummaries } = trpc.workspaces.workspace.activity.users.activity.getDistributionSummaries.useQuery({ groupId, distributionNumber: selectedDistributionNumber, userId }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const { data: games } = trpc.workspaces.workspace.games.getAllGames.useQuery({ groupId }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const { data: userInfo } = trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery({ groupId, userId }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const { data: manualMinutes } = trpc.workspaces.workspace.activity.users.activity.getManualMinutes.useQuery({ groupId, userId, distributionNumber: selectedDistributionNumber }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const deleteManualMinutes = trpc.workspaces.workspace.activity.users.activity.deleteManualMinutes.useMutation();
  const context = trpc.useUtils();
  const [showingSession, setShowingSession] = useState<null | UserGameSession>(null);
  const [adjustingMinutes, setAdjustingMinutes] = useState(false);
  // Users can rack up hundreds of sessions in a single distribution, so we render
  // them in compact rows and only reveal a page at a time to keep the DOM light.
  const SESSIONS_PAGE_SIZE = 25;
  const [visibleSessions, setVisibleSessions] = useState(SESSIONS_PAGE_SIZE);

  useEffect(() => {
    setVisibleSessions(SESSIONS_PAGE_SIZE);
  }, [selectedDistributionNumber]);

  useEffect(() => {
    if (distributions) {
      //@ts-expect-error dot be annoying
      setSelectedDistribution(distributions[distributions.length - 1]?.num)
    }
  }, [distributions])


  if (!workspace) {
    return <LoadingPage />;
  }
  if (!workspace.department.permissions.activity.view) {
    router.push(`/workspaces/${groupId}`)
    return <></>;
  }


  return (
    <>
      <Head>
        <title>{workspace?.premium?.is ? '' : `${BRAND_NAME} `}{workspace?.groupName || ''} {userInfo?.robloxInfo?.name || ''} Activity</title>
      </Head>

      <div className='animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out'>
        {!distributions ? (
          <>
            <LoadingAnimation />
          </>
        ) : (
          <DistributionSelector
            distributions={distributions as any}
            value={selectedDistributionNumber}
            onChange={(num) => setSelectedDistribution(num)}
            className="mt-4"
          />
        )}


        <>
          <h3 className="mt-6 mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <ChartBarIcon className="h-4 w-4" /> This Distribution
          </h3>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
            <StatCard accent="blue" icon={ClockIcon} label="Total Minutes" loading={distributionSummaries == null} value={SuspicouslyNumberLikeToString(distributionSummaries?.minutes?.total || 0)} hint="this distribution" />
            <StatCard accent="green" icon={BoltIcon} label="Active Minutes" loading={distributionSummaries == null} value={SuspicouslyNumberLikeToString(distributionSummaries?.minutes?.active || 0)} hint="this distribution" />
            <StatCard accent="amber" icon={MoonIcon} label="Idle Minutes" loading={distributionSummaries == null} value={SuspicouslyNumberLikeToString(distributionSummaries?.minutes?.inactive || 0)} hint="this distribution" />
            <StatCard accent="violet" icon={ChatBubbleBottomCenterTextIcon} label="Typing Minutes" loading={distributionSummaries == null} value={SuspicouslyNumberLikeToString(distributionSummaries?.minutes?.typing || 0)} hint="this distribution" />
            <StatCard accent="cyan" icon={ChatBubbleLeftRightIcon} label="Messages" loading={distributionSummaries == null} value={(distributionSummaries?.minutes?.messages || 0).toLocaleString()} hint="this distribution" />
            <StatCard accent="rose" icon={CalendarIcon} label="Sessions" loading={distributionSummaries == null} value={(distributionSummaries?.attendedSessions?.length || 0).toLocaleString()} hint="this distribution" />
          </div>


          {Object.keys(distributionSummaries?.goals || {}).length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <TrophyIcon className="h-4 w-4" /> Activity Goals
              </h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {Object.keys(distributionSummaries?.goals || {}).map(goalId => {
                  const goalReqs = (distributionSummaries?.goals[goalId.toString()] || {}) as Record<string, ActivitygoalNumberType>;
                  if (!distributionSummaries?.goals[goalId.toString()]) {
                    return null;
                  }
                  const foundGoal = goals?.find(a => a._id.toString() == goalId.toString()) || { name: '' };
                  const labelMap: Record<string, string> = {
                    minutes: 'Total',
                    activeMinutes: 'Active',
                    minimumMessages: 'Messages',
                    minimumSessions: 'Sessions',
                  };
                  const trackedKeys = Object.keys(goalReqs).filter(name => (goalReqs[name]?.goal || 0) > 0);
                  const metCount = trackedKeys.filter(name => (goalReqs[name]?.percentage || 0) >= 100).length;
                  const totalReq = trackedKeys.length;
                  const allMet = totalReq > 0 && metCount === totalReq;
                  return (
                    <div key={goalId} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700/80 dark:bg-gray-800/80">
                      <span className={`absolute inset-x-0 top-0 h-1 ${allMet ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <div className="flex items-center justify-between gap-3 px-5 pt-4">
                        <p className="flex min-w-0 items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${allMet ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          <span className="truncate">{foundGoal?.name || goalId.toString()}</span>
                        </p>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${allMet ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {allMet && <CheckBadgeIcon className="h-3.5 w-3.5" />}
                          {metCount}/{totalReq} met
                        </span>
                      </div>
                      <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
                        {Object.keys(goalReqs).map(name => {
                          const thisGoal = goalReqs[name];
                          if (!thisGoal) return null;
                          const pct = Math.floor(thisGoal.percentage);
                          const clamped = pct <= 0 ? 0 : pct >= 100 ? 100 : pct;
                          return (
                            <div key={name} className="min-w-0">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium text-gray-600 dark:text-gray-300">{labelMap[name] || name}</span>
                                {thisGoal.goal == 0 ? (
                                  <span className="shrink-0 text-xs font-medium text-gray-400">N/A</span>
                                ) : (
                                  <span className="flex shrink-0 items-center gap-2 whitespace-nowrap tabular-nums">
                                    <span className={`text-sm font-semibold ${pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{pct}%</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">{Math.floor(thisGoal.at)}/{thisGoal.goal}</span>
                                  </span>
                                )}
                              </div>
                              {thisGoal.goal != 0 && (
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                  <div className={`h-full rounded-full transition-all duration-500 ${pct <= 0 ? 'bg-red-500' : pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${clamped === 0 ? 3 : clamped}%` }} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>


        {manualMinutes ? (
          <div className="flex flex-col gap-2 w-full mt-6">
            <div className="flex flex-row gap-2 justify-between flex-wrap items-center">
              <p className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                Manual Minutes
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{manualMinutes.length}</span>
              </p>
              {workspace.department.permissions.activity.admin && (
                <Button variant="blue" onClick={() => { setAdjustingMinutes(true) }}>Create Minute Adjustment</Button>
              )}
            </div>

            {manualMinutes.length == 0 && (
              <div className="py-8 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">No manual minutes have been created for this distribution.</p>
              </div>
            )}

            {manualMinutes.map(manual => (
              <Card key={manual._id.toString()}>
                <div className="flex flex-row flex-wrap gap-2 justify-between">
                  <div className="self-center align-middle">
                    <p className="font-bold text-lg">{parseInt(manual.minutes.toString()).toLocaleString()} {{ active: 'Active', typing: 'Typing', idle: 'Idle' }[manual.type]} minutes created by {manual.authorInfo.name || manual.createdBy}</p>
                    <small>{new Date(manual.created).toLocaleString()} - {manual._id.toString()}</small>
                  </div>
                  {workspace.department.permissions.activity.admin && (
                    <Button variant="light_danger" className='min-w-[100px] h-min self-center' size="medium" onClick={() => {
                      deleteManualMinutes.mutateAsync({
                        groupId,
                        userId,
                        manualMinutesId: manual._id.toString()
                      }).then(() => {
                        toast.success('Successfully deleted manual minutes, it may take a few minutes for the users summaries to update.');
                        context.workspaces.workspace.activity.users.activity.getDistributionSummaries.invalidate({ groupId, distributionNumber: manual.distribution, userId })
                        context.workspaces.workspace.activity.users.activity.getManualMinutes.invalidate({ groupId, userId, distributionNumber: selectedDistributionNumber });
                      })
                    }}>Delete</Button>
                  )}
                </div>
              </Card>
            ))}

          </div>
        ) : (
          <div className='mt-4'>
            <p className="font-bold text-lg">Manual Minutes this Distribution</p>
            <LoadingAnimation />
            <p className="text-center font-bold text-gray-500 text-lg mt-2">Please wait as we load this users sessions</p>
          </div>
        )}

        {distributionSessions ? (
          <div className="flex flex-col gap-2 w-full mt-6">
            <p className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              Tracked Sessions
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{distributionSessions.length}</span>
            </p>

            {distributionSessions.length == 0 && (
              <div className="py-8 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-gray-100">No tracked sessions</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">Once the user joins a game with the activity tracking module, their sessions will appear here.</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {distributionSessions.slice(0, visibleSessions).map(session => {
                const game = games?.find(a => a.placeId == session.placeId);
                const icon = game?.images?.icon || game?.images?.thumbnail;
                return (
                  <button key={session._id.toString()} onClick={() => { setShowingSession(session) }} className="group w-full text-left">
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-800/80 dark:hover:border-gray-600">
                      {/* Game icon — only worth the bytes/space on larger displays */}
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt={game?.name || ''} loading="lazy" className="hidden h-11 w-11 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700 sm:block" />
                      ) : (
                        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-700 sm:flex">
                          <CalendarIcon className="h-5 w-5" />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{game?.name || 'Unknown game'}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{new Date(session.created).toLocaleString()}</p>
                      </div>

                      {session?.minutes ? (
                        <>
                          {/* Compact single stat on mobile */}
                          <div className="flex shrink-0 items-center sm:hidden">
                            <InlineSessionStat title="Total" desc={session?.minutes?.total} />
                          </div>
                          {/* Fuller stat strip as space allows */}
                          <div className="hidden shrink-0 items-center gap-4 sm:flex md:gap-5 lg:gap-6">
                            <InlineSessionStat title="Total" desc={session?.minutes?.total} />
                            <InlineSessionStat title="Active" desc={session?.minutes?.active} accent="text-emerald-600 dark:text-emerald-400" />
                            <div className="hidden md:block"><InlineSessionStat title="Idle" desc={session?.minutes?.inactive} accent="text-amber-600 dark:text-amber-400" /></div>
                            <div className="hidden lg:block"><InlineSessionStat title="Typing" desc={session?.minutes?.typing} accent="text-violet-600 dark:text-violet-400" /></div>
                            <div className="hidden lg:block"><InlineSessionStat title="Messages" desc={session?.minutes?.messages} time={false} /></div>
                          </div>
                        </>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                          </span>
                          {session.inGame ? 'In game' : 'Calculating'}
                        </span>
                      )}

                      <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
                    </div>
                  </button>
                )
              })}
            </div>

            {distributionSessions.length > visibleSessions && (
              <div className="mt-1 flex flex-col items-center gap-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Showing {visibleSessions} of {distributionSessions.length} sessions</p>
                <div className="flex flex-row gap-2">
                  <Button variant="discrete" size="medium" onClick={() => setVisibleSessions(v => v + SESSIONS_PAGE_SIZE)}>Show more</Button>
                  <Button variant="discrete" size="medium" onClick={() => setVisibleSessions(distributionSessions.length)}>Show all</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className='mt-4'>
            <p className="font-bold text-lg">Tracked Sessions this Distribution</p>
            <LoadingAnimation />
            <p className="text-center font-bold text-gray-500 text-lg mt-2">Please wait as we load this users sessions</p>
          </div>
        )}

        <MinuteAdjustmentModal userId={userId} adjustingMinutes={adjustingMinutes} setAdjustingMinutes={setAdjustingMinutes} groupId={groupId} distribution={selectedDistributionNumber} selectedDistributionNumber={selectedDistributionNumber} />
        {(showingSession !== null) && (
          <SessionModal showingSession={showingSession} setShowingSession={setShowingSession} games={games} />
        )}
      </div>
    </>
  );
}

function MinuteAdjustmentModal({ adjustingMinutes, setAdjustingMinutes, userId, groupId, distribution, selectedDistributionNumber }: { userId: string; adjustingMinutes: boolean; setAdjustingMinutes: any; groupId: string; distribution: number | null; selectedDistributionNumber?: number | null; }) {

  const mutation = trpc.workspaces.workspace.activity.users.activity.createManualMinutes.useMutation();
  const context = trpc.useUtils();

  return (
    <Modal open={adjustingMinutes} setOpen={setAdjustingMinutes}>
      <SectionHeader title="What type of adjustment do you want to make?" enableMt={false} />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const target = e.target as any;
          const minuteType = target['type'].value;
          const timeAmount = parseInt(target['timeAmount'].value);
          mutation.mutateAsync({
            groupId,
            userId,
            minuteType,
            timeAmount,
            //@ts-expect-error ignore this
            distribution: distribution,
          }).then(() => {
            toast.success('Successfully created manual minutes, it may take a few minutes for the users summaries to update.');
            context.workspaces.workspace.activity.users.activity.getManualMinutes.invalidate({ groupId, distributionNumber: distribution, userId })
            context.workspaces.workspace.activity.users.activity.getDistributionSessions.invalidate({ groupId, distributionNumber: selectedDistributionNumber, userId })
            setAdjustingMinutes(false);
          }).catch(e => {
            toast.error('Something went wrong creating manual minutes')
          })

        }}
      >
        <Dropdown id="type" label="Minutes type" choices={[
          {
            name: 'Active Minutes',
            id: 'active'
          },
          {
            name: 'Idle Minutes',
            id: 'idle'
          },
          {
            name: 'Typing Minutes',
            id: 'typing'
          },
        ]} />
        <TextLabel id="timeAmount" type="number" label='How many minutes do you want to add/subtract?' placeholder="0" />
        <Button type="submit" variant="primary">Submit Adjustment</Button>
      </form>
    </Modal>
  )
}

export function SessionModal({ showingSession, setShowingSession, games }: {
  showingSession: null | UserGameSession;
  setShowingSession: any;
  games: Game[] | undefined;
}) {
  const { data: events } = trpc.workspaces.workspace.activity.users.activity.getUserGameSessionEvents.useQuery({
    sessionId: showingSession?._id?.toString() || '',
    groupId: showingSession?.groupId.toString() || ''
  }, { refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchInterval: 5000 });
  const recalculateMinutes = trpc.workspaces.workspace.activity.users.activity.recalculateSessionEvent.useMutation();
  const [showOnlyMessages, setShowOnlyMessages] = useState(false);
  // const [events, setEvents] = useState<UserGameSessionEvent[]>(initialEvents || []);
  // useEffect(() => {
  //   if (initialEvents) {
  //     setEvents(initialEvents);
  //   }
  // }, [initialEvents]);
  // const subscripton = trpc.workspaces.workspace.activity.users.activity.streamedUserGameSessionEvents.useSubscription({ sessionId: showingSession?._id?.toString() || '', groupId: showingSession?.groupId.toString() || '' }, {
  //   onStarted: () => { console.log('connected') },
  //   onData: (newEvent) => {
  //     console.log(newEvent)
  //     setEvents((prevEvents) => [...prevEvents, newEvent]);
  //   },
  //   onError: console.error
  // });


  return (
    <Modal open={showingSession !== null} setOpen={() => { setShowingSession(null) }}>
      {showingSession !== null && (
        <>
          {(() => {
            const game = games?.find(a => a.placeId == showingSession?.placeId);
            const banner = game?.images?.thumbnail || game?.images?.icon;
            return (
              <div className="relative -mx-4 -mt-5 mb-4 overflow-hidden rounded-t-lg sm:-mx-6 sm:-mt-6">
                {/* Game thumbnail banner. Thumbnails are user-generated and can be any
                    color, so we layer a consistent dark scrim + always-white text on top
                    to keep the header legible regardless of the image or theme. */}
                {banner ? (
                  <img src={banner} alt={game?.name || ''} className="h-44 w-full object-cover sm:h-52" />
                ) : (
                  <div className="h-44 w-full bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 sm:h-52" />
                )}
                {/* Dark scrim: a soft full overlay plus a stronger bottom gradient. */}
                <div className="pointer-events-none absolute inset-0 bg-black/25" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                {/* Blend the very bottom edge into the modal body so it doesn't feel cut off. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-gray-900" />
                <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4 sm:px-6">
                  {game?.images?.icon && (
                    <img src={game.images.icon} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-white/20 object-cover shadow-lg ring-1 ring-black/20" />
                  )}
                  <div className="min-w-0 pb-0.5 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                    <p className="truncate text-xl font-bold text-white">{game?.name || 'Unknown game'}</p>
                    <p className="truncate text-xs font-medium text-white/80">{new Date(showingSession?.created).toLocaleString()}</p>
                  </div>
                  {showingSession?.minutes ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 self-center rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
                      <CheckBadgeIcon className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  ) : (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 self-center rounded-full bg-blue-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      {showingSession?.inGame ? 'In game' : 'Calculating'}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          <p className="mb-3 px-0.5 text-[11px] text-gray-400 dark:text-gray-500">Session ID: {showingSession?._id?.toString() || ''}</p>

          {showingSession?.minutes ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <SessionStatTile icon={ClockIcon} accent="blue" title="Total" desc={showingSession?.minutes?.total} />
              <SessionStatTile icon={BoltIcon} accent="emerald" title="Active" desc={showingSession?.minutes?.active} />
              <SessionStatTile icon={MoonIcon} accent="amber" title="Idle" desc={showingSession?.minutes?.inactive} />
              <SessionStatTile icon={ChatBubbleBottomCenterTextIcon} accent="violet" title="Typing" desc={showingSession?.minutes?.typing} />
              <SessionStatTile icon={ChatBubbleLeftRightIcon} accent="cyan" title="Messages" desc={showingSession?.minutes?.messages} time={false} />
              <SessionStatTile icon={CalendarIcon} accent="rose" title="Sessions" desc={showingSession?.attendedSessions?.length || 0} time={false} />
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-center dark:border-gray-700">
              <p className="font-semibold text-gray-700 dark:text-gray-200">{showingSession?.inGame ? 'This user is currently in-game, we are tracking their minutes.' : 'The user has left the game, we are calculating their minutes.'}</p>
            </div>
          )}

          <Line />

          {showingSession?.minutes && (
            <>
              {(showingSession?.attendedSessions && showingSession?.attendedSessions?.length !== 0) && (
                <>
                  <div className={'flex flex-col'}>
                    <div className="w-full px-4 py-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <p className='text-sm text-center font-bold dark:text-blue-100'>This in-game session was a part of a workspace session</p>
                      <Button
                        variant="blue"
                        className='mt-2 w-full'
                        href={`/workspaces/${showingSession?.groupId}/sessions/session/${showingSession?.attendedSessions?.[0]}`}
                        target="_blank">View the session</Button>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 my-3" />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex flex-row items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-bold text-gray-700 transition dark:text-gray-300">
              Activity Log
              {events && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{events.filter(event => !showOnlyMessages || event.type == 'message').length}</span>
              )}
            </p>
            <Button
              variant={showOnlyMessages ? 'blue' : 'discrete'}
              size="medium"
              onClick={() => { setShowOnlyMessages(prev => !prev) }}>
              {showOnlyMessages ? 'Showing chat only' : 'Show chat only'}
            </Button>
          </div>

          <div className="mt-2 max-h-75 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40">
            {events ? (
              <div className="flex flex-col gap-1.5">
                {events.filter(event => !showOnlyMessages || event.type == 'message').length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">{showOnlyMessages ? 'No chat messages in this session.' : 'No activity events for this session.'}</p>
                ) : (
                  events.filter(event => !showOnlyMessages || event.type == 'message').map((event, i) => {
                    const when = new Date(event?.date ? event.date : event.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    if (event.type == 'message') {
                      return (
                        <div key={event._id?.toString() || `${event.date}-${i}`} className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-white px-3 py-2 shadow-sm transition dark:border-blue-900/60 dark:bg-gray-800">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                            <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                          </span>
                          <p className="min-w-0 flex-1 break-words text-sm font-medium text-gray-800 dark:text-gray-200">{event.message}</p>
                          <small className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{when}</small>
                        </div>
                      )
                    }
                    const meta = ({
                      join: { label: 'Joined the game', dot: 'bg-emerald-500' },
                      leave: { label: 'Left the game', dot: 'bg-rose-500' },
                      idle: { label: 'Went idle', dot: 'bg-amber-500' },
                      active: { label: 'Became active', dot: 'bg-emerald-500' },
                      typing: { label: 'Began typing', dot: 'bg-violet-500' },
                    } as Record<string, { label: string; dot: string }>)[event.type] || { label: event.type, dot: 'bg-gray-400' };
                    return (
                      <div key={event._id?.toString() || `${event.date}-${i}`} className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition hover:bg-white dark:hover:bg-gray-800">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">{meta.label}</p>
                        <small className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{when}</small>
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <LoadingAnimation />
            )}
          </div>
          <Line />
          <Button variant="discrete" className='w-full' onClick={() => {
            recalculateMinutes.mutateAsync({
              groupId: showingSession?.groupId.toString() || '',
              sessionId: showingSession?._id?.toString() || ''
            }).then(() => {
              toast.success('Successfully recalculated the session summary');
            }).catch(() => {
              toast.error('Something went wrong recalculating the session summary');
            })
          }}>Recalculate Session Summary</Button>
        </>
      )}
    </Modal>
  )
}

DashboardPage.getLayout = (page: ReactElement) => (
  <UsersUpsale>{page}</UsersUpsale>
);
