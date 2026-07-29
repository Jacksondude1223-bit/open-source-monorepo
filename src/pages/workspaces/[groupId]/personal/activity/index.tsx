import { useRouter } from 'next/router';
import { JSX, ReactElement, useState } from 'react';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import { BoxForSession, BoxWithMinutes, SessionModal } from '../../users/[userId]/activity';
import Card from '~/components/ui/Card';
import { UserGameSession } from '~/services/NewMongoTypes';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import { ActivitygoalNumberType, DistributionActivityGoal, RequirementTypes } from '~/services/NewMongoTypes/UserGameSessionDistributionSummary.type';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import { ChatBubbleLeftEllipsisIcon, ClockIcon } from '@heroicons/react/20/solid';
import Header from '~/components/NextGenStyles/Header';
import { LineChart } from '@mui/x-charts/LineChart';
import { HorizontalLine } from '~/components/NextGenStyles/Line';
import { ARRAY_OF_ZERO_THIRTEEN_TIMES } from '../../users/[userId]';
import ActivityHeatmap from '~/components/ui/ActivityHeatmap';
import UserTeamsPanel from '~/components/ui/UserTeamsPanel';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const user = useUser();
  const [showingSession, setShowingSession] = useState<null | UserGameSession>(null);
  if (!('user' in user)) {
    return (<></>)
  }
  const currentUserId = user.user?.roblox?.id?.toString() || '';
  const { data: yearlySummary } = trpc.workspaces.workspace.activity.users.activity.getYearlySummary.useQuery({ groupId, userId: user.user?.roblox?.id?.toString() || '' });
  const { data: goals } = trpc.workspaces.workspace.settings.activityGoals.getGoals.useQuery({ groupId });
  const { data: distributionSessions } = trpc.workspaces.workspace.activity.users.activity.getDistributionSessions.useQuery({ groupId, userId: user.user?.roblox?.id?.toString() || '' });
  const { data: distributionSummaries } = trpc.workspaces.workspace.activity.users.activity.getDistributionSummaries.useQuery({ groupId, userId: user.user?.roblox?.id?.toString() || '' });
  const { data: games } = trpc.workspaces.workspace.games.getGames.useQuery({ groupId });
  const { data: manualMinutes } = trpc.workspaces.workspace.activity.users.activity.getManualMinutes.useQuery({ groupId, userId: user.user?.roblox?.id?.toString() || '' });


  if (!workspace?.premium?.is) {
    return (
      <>
        <WorkspaceUpsale />
      </>
    );
  }

  return (
    <>
      {workspace?.teamsSettings?.enabled !== false && currentUserId && (
        <>
          <UserTeamsPanel groupId={groupId} userId={currentUserId} brandColor={workspace?.brandColor || 'blue'} />
          <HorizontalLine />
        </>
      )}

      <Header>Summary</Header>

      {yearlySummary ? (<>
        <div className="mt-2 animate-in fade-in slide-in-from-left w-full flex flex-row gap-2 min-w-[200px] flex-wrap">
          <BoxWithMinutes title={'Total Minutes this Year'} desc={
            //@ts-expect-error hello world!`
            yearlySummary?.minutes?.total || 0
          } />
          <BoxWithMinutes title={'Active Minutes this Year'} desc={
            //@ts-expect-error hello world!
            yearlySummary?.minutes?.active || 0
          } />
          <BoxWithMinutes title={'Idle Minutes this Year'} desc={
            //@ts-expect-error hello world!
            yearlySummary?.minutes?.inactive || 0
          } />
          <BoxWithMinutes title={'Typing Minutes this Year'} desc={
            //@ts-expect-error hello world!
            yearlySummary?.minutes?.typing || 0
          } />
          <BoxWithMinutes title={'Messages this Year'} desc={
            //@ts-expect-error hello world!
            yearlySummary?.minutes?.messages || 0
          } time={false} />
          <BoxWithMinutes title={'Sessions this Year'} desc={
            //@ts-expect-error hello world!
            yearlySummary?.attendedSessions?.length || 0
          } time={false} />
        </div>
        <HorizontalLine />


        <Header className='mt-4'>This Year in Review</Header>

        <div className="animate-in fade-in slide-in-from-left w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <LineChart
              className="w-full min-h-[450px] transition dark:bg-gray-800 dark:text-gray-100 text-gray-900"
              title="Monthly Summary"
              loading={!yearlySummary}
              xAxis={[{ scaleType: 'point', data: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] }]}
              series={[
                {
                  label: 'Active Time',
                  //@ts-expect-error hello world!
                  data: !yearlySummary?.summaries ? ARRAY_OF_ZERO_THIRTEEN_TIMES : Object.keys(yearlySummary?.summaries?.months || {})?.map((weekNum) => yearlySummary.summaries.months[parseInt(weekNum.toString())].minutes.active).slice(1, 13) || ARRAY_OF_ZERO_THIRTEEN_TIMES
                }, {
                  label: 'Idle Time',
                  //@ts-expect-error hello world!
                  data: !yearlySummary?.summaries ? ARRAY_OF_ZERO_THIRTEEN_TIMES : Object.keys(yearlySummary?.summaries?.months || {})?.map((weekNum) => yearlySummary.summaries.months[parseInt(weekNum.toString())].minutes.inactive).slice(1, 13) || ARRAY_OF_ZERO_THIRTEEN_TIMES
                }, {
                  label: 'Typing Time',
                  //@ts-expect-error hello world!
                  data: !yearlySummary?.summaries ? ARRAY_OF_ZERO_THIRTEEN_TIMES : Object.keys(yearlySummary?.summaries?.months || {})?.map((weekNum) => yearlySummary.summaries.months[parseInt(weekNum.toString())].minutes.typing).slice(1, 13) || ARRAY_OF_ZERO_THIRTEEN_TIMES
                },
              ]}
            />
          </div>
          <div className="animate-in fade-in slide-in-from-left border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <LineChart
              className="w-full min-h-[450px] transition dark:bg-gray-800 dark:text-gray-100 text-gray-900"
              title="Yearly Summary"
              loading={!yearlySummary}
              //@ts-expect-error hello world!
              xAxis={[{ scaleType: 'point', data: Object.keys(yearlySummary?.summaries?.weeks || Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0).map(a => parseInt(a.toString()))) }]}
              series={[
                {
                  label: 'Active Time',
                  //@ts-expect-error hello world!
                  data: !yearlySummary?.summaries?.weeks ? Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0) : Object.keys(yearlySummary?.summaries?.weeks || {})?.map((weekNum) => yearlySummary.summaries.weeks[parseInt(weekNum.toString())].minutes.active) || []
                }, {
                  label: 'Idle Time',
                  //@ts-expect-error hello world!
                  data: !yearlySummary?.summaries?.weeks ? Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0) : Object.keys(yearlySummary?.summaries?.weeks || {})?.map((weekNum) => yearlySummary.summaries.weeks[parseInt(weekNum.toString())].minutes.inactive) || []
                }, {
                  label: 'Typing Time',
                  //@ts-expect-error hello world!
                  data: !yearlySummary?.summaries?.weeks ? Array.apply(null, Array(53)).map(Number.prototype.valueOf, 0) : Object.keys(yearlySummary?.summaries?.weeks || {})?.map((weekNum) => yearlySummary.summaries.weeks[parseInt(weekNum.toString())].minutes.typing) || []
                },
              ]}
            />
          </div>
        </div>

        <div className="mt-4">
          <ActivityHeatmap
            year={new Date().getFullYear()}
            loading={!yearlySummary}
            //@ts-expect-error days are added to the yearly summary
            days={yearlySummary?.summaries?.days}
          />
        </div>

        <HorizontalLine />
      </>) : (
        <div className='mt-4'>
          <LoadingAnimation />
        </div>
      )}




      <Header className="mt-4">Minutes this Distribution</Header>
      <div className='animate-in fade-in slide-in-from-left flex flex-row gap-2 flex-wrap mt-2 w-full'>
        <BoxWithMinutes title={'Total Minutes'} desc={distributionSummaries?.minutes?.total || 0} />
        <BoxWithMinutes title={'Active Minutes'} desc={distributionSummaries?.minutes?.active || 0} />
        <BoxWithMinutes title={'Idle Minutes'} desc={distributionSummaries?.minutes?.inactive || 0} />
        <BoxWithMinutes title={'Typing Minutes'} desc={distributionSummaries?.minutes?.typing || 0} />
        <BoxWithMinutes title={'Messages'} desc={distributionSummaries?.minutes?.messages || 0} time={false} />
        <BoxWithMinutes title={'Sessions'} desc={distributionSummaries?.attendedSessions?.length || 0} time={false} />
      </div>
      <HorizontalLine />


      <div className="w-full mt-4">

        {goals ? (<>
          {goals.filter(goal => goal.departments.map(a => a.toString()).includes(workspace?.department?._id?.toString() || '')).length !== 0 && (
            <>
              <Header>Assigned Goals</Header>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2 w-full">

                {goals.map(goal => {
                  if (!goal.departments.map(a => a.toString()).includes(workspace?.department?._id?.toString() || '')) {
                    return <></>;
                  }
                  const fallback = {
                    minutes: { at: 0, goal: goal.minimumMinutes, percentage: 0 },
                    activeMinutes: { at: 0, goal: goal.minimumActiveMinutes, percentage: 0 },
                    minimumMessages: { at: 0, goal: goal.minimumMessages, percentage: 0 },
                    minimumSessions: { at: 0, goal: goal.minimumSessions, percentage: 0 }
                  };
                  const foundGoal = distributionSummaries?.goals[goal._id.toString()] as unknown as DistributionActivityGoal || fallback;
                  const requirements = Object.keys(foundGoal || {});
                  const metCount = requirements.filter((name) => ((foundGoal[name as RequirementTypes] as unknown as ActivitygoalNumberType)?.percentage || 0) >= 100).length;
                  const allMet = requirements.length > 0 && metCount === requirements.length;
                  return (
                    <div key={goal._id.toString()} className="min-w-0 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 px-5 py-4 shadow-sm">
                      <div className="flex flex-row items-center justify-between gap-3">
                        <p className="font-bold truncate">{goal.name}</p>
                        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${allMet ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {metCount}/{requirements.length} met
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-3">
                        {requirements.map((name) => {
                          const thisGoal: ActivitygoalNumberType = foundGoal[name as RequirementTypes] as unknown as ActivitygoalNumberType;
                          const pct = parseInt(thisGoal.percentage.toString());
                          const clampedPct = pct <= 0 ? 0 : pct >= 100 ? 100 : pct;
                          return (
                            <div key={name} className="min-w-0">
                              <div className="flex flex-row items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{{
                                  minutes: 'Total Minutes',
                                  activeMinutes: 'Active Minutes',
                                  minimumMessages: 'Messages',
                                  minimumSessions: 'Sessions'
                                }[name]}</span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap tabular-nums">{thisGoal.at}/{thisGoal.goal}</span>
                              </div>
                              <div className="w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700 h-2.5">
                                <div
                                  className={`${pct >= 100 ? 'bg-green-500' : pct <= 0 ? 'bg-red-500' : 'bg-blue-500'} h-full rounded-full transition-all`}
                                  style={{ width: `${clampedPct === 0 ? 2 : clampedPct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <HorizontalLine />
            </>
          )}
        </>) : (
          <div className='mt-6'>
            {workspace.premium?.is && (
              <>
                <Header>Assigned Goals</Header>
                <LoadingAnimation />
                <HorizontalLine />
              </>
            )}
          </div>
        )}
      </div>




      {manualMinutes ? (
        <div className="animate-in fade-in slide-in-from-left flex flex-col gap-2 w-full mt-4">
          <Header>Manual Minutes this Distribution</Header>

          {manualMinutes.length == 0 && (
            <div className="py-8 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">No manual minutes have been created for you this distribution.</p>
            </div>
          )}

          {manualMinutes.map(manual => (
            <Card key={manual._id.toString()}>
              <div className="flex flex-row flex-wrap gap-2 justify-between">
                <div className="self-center align-middle">
                  <p className="font-bold text-lg">{parseInt(manual.minutes.toString()).toLocaleString()} {{ active: 'Active', typing: 'Typing', idle: 'Idle' }[manual.type]} minutes created by {manual.authorInfo.name || manual.createdBy}</p>
                  <small>{new Date(manual.created).toLocaleString()} - {manual._id.toString()}</small>
                </div>
              </div>
            </Card>
          ))}

        </div>
      ) : (
        <div className='mt-4'>
          <Header>Manual Minutes this Distribution</Header>
          <LoadingAnimation />
          <p className="text-center font-bold text-gray-500 text-lg mt-2">Please wait as we load your sessions</p>
          <HorizontalLine />
        </div>
      )}
      {manualMinutes && <HorizontalLine />}

      {distributionSessions ? (
        <div className="flex flex-col gap-2 w-full mt-4">

          <Header>Tracked Sessions this Distribution</Header>

          {distributionSessions.length == 0 && (
            <div className="py-8 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="font-semibold text-gray-900 dark:text-gray-100">No tracked sessions</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">Once you join a game with the activity tracking module, your sessions will appear here.</p>
            </div>
          )}
          {distributionSessions.map(session => (
            <button key={session._id.toString()} onClick={() => { setShowingSession(session) }}>
              <Card className="text-left">
                <div className="flex flex-row flex-wrap gap-2 justify-between">
                  <div className="self-center align-middle">
                    <p className="font-bold text-lg">{games?.find(a => a.placeId == session.placeId)?.name || ''}</p>
                    <small>{new Date(session.created).toLocaleString()} - {session._id.toString()}</small>
                  </div>
                  <div className="flex flex-row gap-2 flex-wrap">
                    {session?.minutes ? (<>
                      <BoxForSession title="Total Minutes" desc={session?.minutes?.total} />
                      <BoxForSession title="Active Minutes" desc={session?.minutes?.active} />
                      <BoxForSession title="Inactive Minutes" desc={session?.minutes?.inactive} />
                      <BoxForSession title="Typing Minutes" desc={session?.minutes?.typing} />
                      <BoxForSession title="Total Messages" desc={session?.minutes?.messages} time={false} />
                      <BoxForSession title="Total Sessions" desc={session?.attendedSessions?.length || 0} time={false} />
                    </>) : (
                      <div className="w-full flex flex-row justify-center gap-2">
                        <p className="ml-4 w-full self-center align-middle font-bold text-lg">{session.inGame ? 'This user is currently in-game, we are currently tracking their minutes.' : 'The user has left the game, and we are currently calculating their minutes.'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      ) : (
        <div className='mt-4'>
          <p className="font-bold text-lg">Tracked Sessions this Distribution</p>
          <LoadingAnimation />
          <p className="text-center font-bold text-gray-500 text-lg mt-2">Please wait as we load your sessions</p>
        </div>
      )}

      {(showingSession !== null) && (
        <SessionModal showingSession={showingSession} setShowingSession={setShowingSession} games={games} />
      )}

    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout
      title="Workspace Home"
      tabs={[
        {
          name: 'Home',
          href: `/workspaces/${groupId}`,
          icon: ChatBubbleLeftEllipsisIcon,
          current: false
        },
        {
          name: 'Your Activity',
          href: `/workspaces/${groupId}/personal/activity`,
          icon: ClockIcon,
          current: true
        },
      ]}
      disablePadding={false}
    >{page}</WorkspaceWithExtraSidebarLayout>
  )
};
