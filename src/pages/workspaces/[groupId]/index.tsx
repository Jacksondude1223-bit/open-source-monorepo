/* eslint-disable @next/next/no-img-element */
import { ChatBubbleLeftEllipsisIcon, ClockIcon, DocumentArrowDownIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { JSX, ReactElement, useState } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import CommentPost from '~/components/forms/CommentPost';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import PageSkeleton from '~/components/ui/PageSkeleton';
import BannerImage from '~/components/ui/BannerImage';
import LoadingPage from '~/components/layouts/LoadingPage';
import { processObjectsWithUserIdToUserDataResponse } from '~/services/roblox.service';
import ReadFile from "~/utils/FileReader";
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { RouterOutput, trpc } from '~/utils/trpc';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Feed } from '~/services/NewMongoTypes';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import { ActivitygoalNumberType, DistributionActivityGoal, RequirementTypes } from '~/services/NewMongoTypes/UserGameSessionDistributionSummary.type';
import Link from 'next/link';
import Header from '~/components/NextGenStyles/Header';
import Line from '~/components/NextGenStyles/Line';
import { WorkspaceWithExtraSidebarLayout } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';
import Headshot from '~/components/NextGenStyles/Headshot';
import Small from '~/components/NextGenStyles/Small';
import UpcomingBirthdays from '~/components/page_components/workspace/UpcomingBirthdays';
import OnboardingChecklist from '~/components/page_components/workspace/OnboardingChecklist';
import TimeclockCard from '~/components/page_components/workspace/TimeclockCard';
import { UserIcon } from '@heroicons/react/24/outline';


export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, new_workspace }: { groupId: string, new_workspace?: 'true'; } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const { data: posts } = trpc.workspaces.workspace.feed.getWorkspaceFeed.useQuery({ groupId: groupId });

  if (!('user' in user)) {
    return (<></>)
  }
  const { data: games } = trpc.workspaces.workspace.games.getGames.useQuery({ groupId });
  const { data: bannerImage } = trpc.workspaces.workspace.getWorkspaceBanner.useQuery({ groupId });
  const { data: leaderboard } = trpc.workspaces.workspace.activity.leaderboard.useQuery({ groupId });
  const { data: goals } = trpc.workspaces.workspace.settings.activityGoals.getGoals.useQuery({ groupId });
  const { data: distributionSummaries } = trpc.workspaces.workspace.activity.users.activity.getDistributionSummaries.useQuery({ groupId });
  const { data: upcomingBirthdays } = trpc.workspaces.workspace.getUpcomingBirthdays.useQuery({ groupId, daysAhead: 30 });

  const viewable = games?.filter(a => a.viewable);
  if (!workspace || !posts || false) {
    return (
      <>
        <BannerImage src={bannerImage} />
        <div className="mx-8 mt-6">
          <PageSkeleton cards={2} sections={2} />
        </div>
      </>
    );
  }

  const brand = workspace?.brandColor || 'blue';

  return (
    <>

      <BannerImage src={bannerImage} />

      <div className="mx-8 mt-6">
        {(workspace.owner.robloxId == user?.user?.dbUser?.robloxId) && (
          <OnboardingChecklist groupId={groupId} />
        )}

        <div className="mb-6">
          <TimeclockCard groupId={groupId} />
        </div>

        {(viewable && viewable?.length !== 0) && (
          <>
            <Header>Games</Header>
            <div className='mt-3 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 fade-in animate-in slide-in-from-left'>
              {viewable?.map((game) => (
                <div
                  key={game.placeId}
                  className="dark:border-gray-800 border aspect-video flex h-50 max-h-75 w-full relative flex-col gap-4 px-5 py-4 rounded-xl shadow-sm bg-cover bg-center bg-no-repeat bg-gray-100 overflow-hidden group"
                  style={{
                    backgroundImage: `url("${game.images.thumbnail}")`
                  }}
                >
                  <div className={`absolute inset-0 w-full h-full bg-${workspace?.brandColor || 'blue'}-500/70 z-10 rounded-xl group-hover:bg-${workspace?.brandColor || 'blue'}-500/60 transition-all`}></div>
                  <p className="font-bold text-xl drop-shadow-md tracking-tight text-white z-20">{game.name}</p>
                  <Button variant="discrete" className='self-end w-min z-20 mt-auto' target="__blank" href={`https://www.roblox.com/games/start?placeId=${game.placeId}`}>Play</Button>
                </div>
              ))}
            </div>
            <Line />
          </>
        )}

        {(goals) ? (<>
          {goals.filter(goal => goal.departments.map(a => a.toString()).includes(workspace.department._id?.toString() || '')).length !== 0 && (
            <>
              <div className='mt-4 mb-2'>
                <Header>Assigned Goals</Header>
              </div>
              <div className={`animate-in fade-in slide-in-from-left grid grid-cols-1 lg:grid-cols-2 gap-4 w-full`}>

                {goals.map(goal => {
                  if (!goal.departments.map(a => a.toString()).includes(workspace.department._id?.toString() || '')) {
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
                    <div key={goal._id.toString()} className="min-w-0 rounded-2xl border border-gray-200 transition dark:border-gray-700 bg-white dark:bg-gray-800/50 dark:text-gray-100 px-5 py-4 shadow-sm">
                      <div className="flex flex-row items-center justify-between gap-3">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{goal.name}</p>
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
              <Line />
            </>
          )}
        </>) : (
          <div className='mt-6'>
            {workspace.premium?.is && (
              <>
                <Header>Assigned Goals</Header>
                <LoadingAnimation />
                <Line />
              </>
            )}
          </div>
        )}

        {workspace.premium?.is && (
          <>
            {!workspace.usingOpenCloud ? (
              <div className='mt-6'>
                <Header>Top 50 <Small className="pl-1">This Distribution</Small></Header>
                <div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 px-6 py-12 text-center dark:border-gray-700">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-${brand}-100 text-${brand}-600 dark:bg-${brand}-900/40 dark:text-${brand}-300`}>
                    <ClockIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-200">No activity yet</p>
                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                      Link your Roblox Open Cloud integration to start syncing members and tracking activity.
                    </p>
                  </div>
                  {workspace.department.permissions.admin && (
                    <Button variant="primary" size="small" href={`/workspaces/${workspace.groupId}/settings/integrations`}>Link Roblox integration</Button>
                  )}
                </div>
                <Line />
              </div>
            ) : leaderboard ? (
              <div className='grid mt-6 mb-2'>
                <Header>Top 50 <Small className="pl-1">This Distribution</Small></Header>

                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {leaderboard.slice(0, 3).map((user, index) => {
                    const place = index + 1;
                    const medal =
                      place === 1
                        ? { ring: 'ring-amber-400', badge: 'bg-amber-400 text-amber-950', label: '1st' }
                        : place === 2
                          ? { ring: 'ring-gray-300', badge: 'bg-gray-300 text-gray-800', label: '2nd' }
                          : { ring: 'ring-orange-400', badge: 'bg-orange-400 text-orange-950', label: '3rd' };
                    return (
                      <Link
                        key={user._id?.toString()}
                        target="_blank"
                        href={`/workspaces/${workspace.groupId}/users/${user.user.id}`}
                        className={`group relative flex flex-col items-center gap-1 rounded-2xl border border-gray-200 bg-white px-4 py-5 text-center shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800/50 ${place === 1 ? 'sm:-mt-2 sm:py-7' : ''}`}
                      >
                        <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-bold ${medal.badge}`}>{medal.label}</span>
                        <div className={`rounded-full ring-2 ${medal.ring} ring-offset-2 ring-offset-white dark:ring-offset-gray-900`}>
                          <Headshot src={user.user.thumbnail} alt={`${user.user.name}'s thumbnail`} />
                        </div>
                        <p className="mt-2 max-w-full truncate font-semibold text-gray-900 dark:text-gray-100">{user.user.name}</p>
                        <p className={`text-sm font-medium text-${brand}-600 dark:text-${brand}-400`}>{Math.round(user.minutes.total).toLocaleString()} min</p>
                      </Link>
                    );
                  })}
                </div>

                {leaderboard.length > 3 && (
                  <div className="mt-4 flex w-full flex-row gap-3 overflow-x-auto py-1">
                    {leaderboard.slice(3).map((user, index) => (
                      <Link
                        key={user._id?.toString()}
                        target="_blank"
                        href={`/workspaces/${workspace.groupId}/users/${user.user.id}`}
                        className="flex min-w-72 flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800/50"
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-${brand}-100 text-xs font-bold text-${brand}-700 dark:bg-${brand}-900/40 dark:text-${brand}-300`}>{index + 4}</span>
                        <Headshot src={user.user.thumbnail} alt={`${user.user.name}'s thumbnail`} />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold text-gray-900 dark:text-gray-100">{user.user.name}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(user.minutes.total).toLocaleString()} minutes</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <Line />
              </div>
            ) : (
              <div className='mt-6'>
                <Header>Top 50 <Small className="pl-1">This Distribution</Small></Header>
                <LoadingAnimation />
                <Line />
              </div>
            )
            }
          </>
        )}

        {upcomingBirthdays && upcomingBirthdays.length > 0 && (
          <div className="mt-6 mb-6">
            <UpcomingBirthdays birthdays={upcomingBirthdays} />
          </div>
        )}

        <Header>Feed</Header>
        <div className="mt-3">
          {(workspace.department.permissions.feed.postDepartment || workspace.department.permissions.feed.postPublic) && (
            <CreatePost workspace={workspace} />
          )}

          {posts.length == 0 && (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 px-6 py-12 text-center dark:border-gray-700">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-${brand}-100 text-${brand}-600 dark:bg-${brand}-900/40 dark:text-${brand}-300`}>
                <ChatBubbleLeftEllipsisIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-200">It&apos;s quiet here</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                  Share an update, announcement, or shout-out to start the conversation.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 mt-4 mb-4">
            {posts.map((post) => (
              <FeedPost key={post._id.toString()} post={post} />
            ))}
          </div>
        </div>


      </div>
    </>
  );
}

export function Attachment({
  attachment,
  name,
  contentType,
}: {
  attachment: string;
  /** Display name. When omitted it's parsed out of the URL (legacy feed behaviour). */
  name?: string;
  /** MIME type, used to detect images more reliably than the file extension. */
  contentType?: string;
}) {
  const [showModal, setShowModal] = useState(false);

  const fileName =
    name ||
    attachment.substring(
      // @ts-expect-error ignoring for brevity
      attachment.indexOf(attachment.split('-')[5]),
    )?.split('?')[0] ||
    'file.png';

  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const isImg =
    (contentType?.startsWith('image/') ?? false) ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);

  return (
    <>
      <div
        onClick={() => isImg && setShowModal(true)}
        className="relative cursor-pointer group w-32 border border-gray-300 dark:border-gray-700 rounded-lg hover:shadow-md transition flex flex-col items-center justify-start overflow-hidden"
      >
        {isImg ? (
          <>
            <img
              src={attachment}
              alt={fileName}
              className="w-full h-24 object-cover"
            />
            <div className="p-2 text-xs text-gray-500 text-center truncate w-full">
              {fileName}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center p-4 w-full h-24">
              <DocumentArrowDownIcon className="h-8 w-8 text-gray-400 mb-1" />
              <a
                href={attachment}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate max-w-full text-center"
              >
                {fileName}
              </a>
            </div>
          </>
        )}
      </div>

      {showModal && isImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()} // prevent closing on image click
          >
            <button
              className="absolute top-2 right-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
              onClick={() => setShowModal(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <img
              src={attachment}
              alt={fileName}
              className="rounded-lg max-h-[80vh] w-auto mx-auto object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

export function FeedPost({
  post
}: {
  post: Feed & processObjectsWithUserIdToUserDataResponse;
}): JSX.Element {
  const { data: departments } = trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({ groupId: post.groupId });
  const workspace = useWorkspace();
  const deleteMutation = trpc.workspaces.workspace.feed.deletePost.useMutation();
  const context = trpc.useUtils();

  const isRestricted = post.departments?.length !== 0;
  const restrictedDepartments = isRestricted && departments
    ? departments
      .filter(d => post.departments?.map(a => a?.toString() || '')?.includes(d?._id?.toString() || ''))
      .map(d => d.name)
      .join(', ')
    : '';

  return (
    <div className="flex items-start space-x-4 fade-in animate-in slide-in-from-left">
      <div className="shrink-0">
        <Headshot src={post.user.thumbnail} color="blue" size="normal" />
      </div>
      <div
        className={`p-2 min-w-0 flex-1 w-full rounded-lg shadow-sm transition dark:text-gray-100 dark:bg-gray-800 ${isRestricted
          ? 'ring-2 ring-inset ring-red-500 border-red-300'
          : 'ring-2 ring-inset ring-blue-300'
          }`}
      >
        {post.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 py-2">
            {post.attachments.map((attachment: string) => (
              <Attachment key={attachment} attachment={attachment} />
            ))}
          </div>
        )}
        <p className="mb-2 text-gray-700 dark:text-gray-300">
          {post.content}
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {workspace.department.permissions.admin && (
            <button
              onClick={() => {
                deleteMutation.mutateAsync({
                  postId: (post?._id || '').toString(),
                  groupId: workspace.groupId
                }).then(() => {
                  toast.success('Successfully deleted post.');
                  context.workspaces.workspace.feed.getWorkspaceFeed.invalidate({ groupId: workspace.groupId });
                });
              }}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <span>
            <ReactTimeago date={post.created} /> - <Link href={`/workspaces/${post.groupId}/users/${post.userId}`} target="_blank" className='transition hover:text-blue-500'>{post.user.name}</Link>{' '}
            {isRestricted && ` - Restricted to ${restrictedDepartments}`}
          </span>
        </div>
      </div>
    </div>
  );
}


function CreatePost({ workspace }: { workspace: RouterOutput["workspaces"]["workspace"]["getWorkspace"] }) {
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const mutation =
    trpc.workspaces.workspace.feed.postWorkspaceFeed.useMutation();
  const { data: departments } = trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({ groupId: workspace.groupId });
  const context = trpc.useUtils();

  return mutation.isPending ? (
    <LoadingPage override="Submitting feed post" />
  ) : (
    <CommentPost
      onSubmit={async (f) => {
        const target = f.target as any;
        const comment = target.comment.value;
        const files = target.files.files;

        const fileData: [string, string][] = [];
        for (const file of files) {
          const data = await ReadFile(file);
          if (data) {
            fileData.push([file.name, data.toString()]);
          }
        }

        mutation
          .mutateAsync({
            groupId: workspace.groupId,
            comment,
            departments: selectedDepartments,
            files: fileData,
          })
          .then(() => {
            context.workspaces.workspace.feed.getWorkspaceFeed.invalidate({ groupId: workspace.groupId });
            toast.success('Succesfully posted to feed.');
            // to do invaldiate and thing
          })
          .catch((e) => {
            alert(e.message);
          });
      }}
    >
      <MultiSelectDropdown placeholder='Restrict to departments' choices={departments?.map(a => ({ name: a.name, id: a._id.toString() })) || []} onSelectChoice={setSelectedDepartments} />
    </CommentPost>
  );
}

WorkspacePage.getLayout = (page: ReactElement): JSX.Element => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const workspace = useWorkspace();
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <WorkspaceWithExtraSidebarLayout
      title="Workspace Home"
      tabs={[
        {
          name: 'Home',
          href: `/workspaces/${groupId}`,
          icon: ChatBubbleLeftEllipsisIcon,
          current: true,
          canShow: true,
        },
        {
          name: 'Your Activity',
          href: `/workspaces/${groupId}/personal/activity`,
          icon: ClockIcon,
          current: false,
          canShow: true,
        },
        {
          name: 'Your Profile',
          href: `/workspaces/${groupId}/users/${workspace?.userRole?.userId || ''}`,
          icon: UserIcon,
          current: false,
          canShow: Boolean(workspace?.userRole?.userId),
        },
      ]}
      disablePadding={true}
    >{page}</WorkspaceWithExtraSidebarLayout>
  )
};
