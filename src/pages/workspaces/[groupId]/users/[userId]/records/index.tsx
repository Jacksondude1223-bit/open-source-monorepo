/* eslint-disable @next/next/no-img-element */
import {
  CalendarDaysIcon,
  ChatBubbleBottomCenterIcon,
  PlusIcon,
} from '@heroicons/react/20/solid';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  PlusCircleIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Dispatch, ReactElement, SetStateAction, useState } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceUserSidebarLayout from '~/components/page_components/workspaces/users/user/WorkspaceUserSidebarLayout';
import { AuthenticatedUserContext, useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import Badge from '~/components/ui/Badge';
import DateBetweenPicker from '~/components/ui/DateBetweenPicker';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import Modal from '~/components/ui/Modal';
import StatCard from '~/components/ui/StatCard';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import { trpc } from '~/utils/trpc';

function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-row items-center justify-between">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
        {typeof count === 'number' && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {count}
          </span>
        )}
      </p>
      {action}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

function CreateTimeOffModal({
  groupId,
  userId,
  isSelf,
  approveInactivity,
  open,
  setOpen,
}: {
  groupId: string;
  userId: string;
  isSelf: boolean;
  approveInactivity?: boolean;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const createMutation =
    trpc.workspaces.workspace.activity.inactivity.requestInactivity.useMutation();
  const context = trpc.useUtils();

  return (
    <Modal
      open={open}
      setOpen={(o: boolean) => {
        setOpen(o);
        if (o === false) createMutation.reset();
      }}
    >
      <PageHeading title={`${approveInactivity ? 'Create' : 'Request'} Time Off`} />
      <form
        className="flex flex-col gap-4"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          createMutation
            .mutateAsync({
              groupId,
              reason: target.reason.value,
              start: new Date(target.startdate.value),
              end: new Date(target.enddate.value),
              userId: isSelf ? 'false' : userId.toString(),
            })
            .then(() => {
              toast.success('Successfully created time off');
              setOpen(false);
              createMutation.reset();
              context.workspaces.workspace.activity.inactivity.getUserTimeOff.invalidate(
                { groupId, userId },
              );
            })
            .catch((error) => {
              toast.error(error.message);
            });
        }}
      >
        {createMutation.isPending ? (
          <LoadingPage />
        ) : (
          <>
            <TextLabel
              label="What is the reason for this time off?"
              id="reason"
              icon={ChatBubbleBottomCenterIcon}
              placeholder="Type a reason here"
            />
            <DateBetweenPicker inModal={true} />
            <Button type="submit" variant="primary">
              {approveInactivity ? 'Create' : 'Request'} Time Off
            </Button>
          </>
        )}
      </form>
    </Modal>
  );
}

function TimeOffSection({ groupId, userId }: { groupId: string; userId: string }) {
  const workspace = useWorkspace();
  const user = useUser() as AuthenticatedUserContext;
  const context = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: timeOff, isLoading } =
    trpc.workspaces.workspace.activity.inactivity.getUserTimeOff.useQuery({
      groupId,
      userId,
    });

  const updateMutation =
    trpc.workspaces.workspace.activity.inactivity.updateInactivityRequestStatus.useMutation();
  const deleteMutation =
    trpc.workspaces.workspace.activity.inactivity.deleteInactivityRequest.useMutation();

  const perms = workspace?.department?.permissions?.activity;
  const selfId = user?.user?.dbUser?.robloxId?.toString();
  const isSelf = selfId === userId.toString();
  const canCreate =
    perms?.createInactivity && (perms?.requestInactivityForOtherUsers || isSelf);
  const canManage = perms?.manageInactivity;

  const invalidate = () =>
    context.workspaces.workspace.activity.inactivity.getUserTimeOff.invalidate({
      groupId,
      userId,
    });

  return (
    <div>
      <SectionHeader
        title="Time Off"
        count={timeOff?.length}
        action={
          canCreate ? (
            <Button
              variant="blue"
              size="medium"
              icon={PlusIcon}
              onClick={() => setCreateOpen(true)}
            >
              {perms?.approveInactivity ? 'Create' : 'Request'} Time Off
            </Button>
          ) : undefined
        }
      />

      {isLoading && <LoadingAnimation />}

      {timeOff && timeOff.length === 0 && (
        <EmptyState
          title="No time off"
          description="This user has no recorded time off requests."
        />
      )}

      <div className="flex flex-col gap-3">
        {timeOff?.map((item) => {
          const request = item.request as
            | false
            | { approved: boolean; reason?: string; adminUser?: string };
          const isPending = request === false;
          const isApproved = request !== false && request.approved;
          const statusColor: 'yellow' | 'green' | 'red' = isPending
            ? 'yellow'
            : isApproved
              ? 'green'
              : 'red';
          const statusLabel = isPending
            ? 'Pending Approval'
            : isApproved
              ? 'Approved'
              : `Declined${request && request.reason ? ` - ${request.reason}` : ''}`;
          const id = (item._id || '').toString();

          return (
            <div
              key={id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-800/80"
            >
              <div className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(item.starts).toLocaleDateString()} &rarr;{' '}
                      {new Date(item.ends).toLocaleDateString()}
                    </p>
                    <Badge color={statusColor}>{statusLabel}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {item.reason}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Requested <ReactTimeago date={item.created} />
                  </p>
                </div>

                <div className="flex flex-row flex-wrap items-center gap-2">
                  {canManage && isPending && (
                    <>
                      <Button
                        variant="warning"
                        size="medium"
                        onClick={() => {
                          updateMutation
                            .mutateAsync({ groupId, id, status: 'decline' })
                            .then(() => {
                              toast.success('Declined time off');
                              invalidate();
                            })
                            .catch((e: any) => toast.error(`Something went wrong ${e}`));
                        }}
                      >
                        Decline
                      </Button>
                      <Button
                        variant="success"
                        size="medium"
                        onClick={() => {
                          updateMutation
                            .mutateAsync({ groupId, id, status: 'accept' })
                            .then(() => {
                              toast.success('Accepted time off');
                              invalidate();
                            })
                            .catch((e: any) => toast.error(`Something went wrong ${e}`));
                        }}
                      >
                        Accept
                      </Button>
                    </>
                  )}
                  {(canManage || isSelf) && (
                    <Button
                      icon={TrashIcon}
                      variant="discrete"
                      size="medium"
                      onClick={() => {
                        const deletePromise = deleteMutation
                          .mutateAsync({ groupId, id })
                          .then(() => invalidate());
                        toast.promise(deletePromise, {
                          loading: 'Deleting...',
                          success: 'Deleted!',
                          error: 'Failed to delete',
                        });
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CreateTimeOffModal
        groupId={groupId}
        userId={userId}
        isSelf={isSelf}
        approveInactivity={perms?.approveInactivity}
        open={createOpen}
        setOpen={setCreateOpen}
      />
    </div>
  );
}

function PromotionRequestsSection({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}) {
  const workspace = useWorkspace();
  const perms = workspace?.department?.permissions?.promotionRequests;
  const isAdmin = workspace?.department?.permissions?.admin;
  const canView = isAdmin || perms?.view || perms?.manage;

  const { data: requests, isLoading } =
    trpc.workspaces.workspace.promotionRequests.getForUser.useQuery(
      { groupId, userId },
      { enabled: !!canView },
    );

  if (!canView) return null;

  const statusColor = (status: string): 'yellow' | 'green' | 'red' =>
    status === 'pending' ? 'yellow' : status === 'approved' ? 'green' : 'red';

  return (
    <div>
      <SectionHeader title="Promotion Requests" count={requests?.length} />

      {isLoading && <LoadingAnimation />}

      {requests && requests.length === 0 && (
        <EmptyState
          title="No promotion requests"
          description="This user has no promotion requests on record."
        />
      )}

      <div className="flex flex-col gap-3">
        {requests?.map((req) => {
          const id = (req._id || '').toString();
          return (
            <Link
              key={id}
              href={`/workspaces/${groupId}/promotion-requests/${id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-800/80 dark:hover:border-gray-600"
            >
              <div className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {req.currentRoleName}
                      {req.requestedRoleName ? ` \u2192 ${req.requestedRoleName}` : ''}
                    </p>
                    <Badge color={statusColor(req.status)}>{req.status}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {req.reason}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Requested by {req.requestedByName} &middot;{' '}
                    <ReactTimeago date={req.created} />
                    {req.rankedTo ? ` \u00b7 Ranked to ${req.rankedTo}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    {req.votes.filter((v) => v.vote === 'support').length}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircleIcon className="h-4 w-4 text-red-500" />
                    {req.votes.filter((v) => v.vote === 'oppose').length}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationsSection({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}) {
  const workspace = useWorkspace();
  const perms = workspace?.department?.permissions?.applications;
  const canView =
    perms?.editApplications || perms?.viewApplications || perms?.readApplications;

  const { data: responses, isLoading } =
    trpc.workspaces.workspace.forms.applications.getUserResponses.useQuery(
      { groupId, userId },
      { enabled: !!canView },
    );

  if (!canView) return null;

  const statusColor = (status: string): 'yellow' | 'green' | 'red' | 'blue' =>
    status === 'pending'
      ? 'yellow'
      : status === 'passed'
        ? 'green'
        : status === 'reported'
          ? 'blue'
          : 'red';

  return (
    <div>
      <SectionHeader title="Applications" count={responses?.length} />

      {isLoading && <LoadingAnimation />}

      {responses && responses.length === 0 && (
        <EmptyState
          title="No applications"
          description="This user has not submitted any applications."
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {responses?.map((resp) => (
          <Link
            key={resp.id}
            href={`/workspaces/${groupId}/forms/application/${resp.applicationId}`}
            className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-800/80 dark:hover:border-gray-600"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <DocumentCheckIcon className="h-5 w-5 text-gray-400" />
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {resp.applicationName}
                </p>
              </div>
              <Badge color={statusColor(resp.status)}>{resp.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="capitalize">Source: {resp.source}</span>
              {typeof resp.score === 'number' && <span>Score: {resp.score}</span>}
              <span>
                <ReactTimeago date={resp.created} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CallsSection({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}) {
  const workspace = useWorkspace();
  const perms = workspace?.department?.permissions?.calls;
  const isAdmin = workspace?.department?.permissions?.admin;
  const canView = isAdmin || perms?.view || perms?.manage;
  const canViewGames =
    isAdmin || workspace?.department?.permissions?.games?.view;

  const { data: calls, isLoading } =
    trpc.workspaces.workspace.calls.getUserCalls.useQuery(
      { groupId, userId },
      { enabled: !!canView && !!groupId && !!userId },
    );

  if (!canView) return null;

  const statusColor = (status: string): 'yellow' | 'blue' | 'red' =>
    status === 'open' ? 'yellow' : status === 'claimed' ? 'blue' : 'red';

  return (
    <div>
      <SectionHeader title="Call History" count={calls?.length} />

      {isLoading && <LoadingAnimation />}

      {calls && calls.length === 0 && (
        <EmptyState
          title="No calls"
          description="This user has not made any in-game support calls."
        />
      )}

      <div className="flex flex-col gap-3">
        {calls?.map((call) => {
          const chatHref =
            canViewGames && call.placeId && call.runningGameId
              ? `/workspaces/${groupId}/games/${call?.placeId}/running/${call.runningGameId}/chats`
              : null;

          return (
            <div
              key={call._id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-800/80 dark:hover:border-gray-600"
            >
              <div className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ChatBubbleBottomCenterIcon className="h-5 w-5 text-gray-400" />
                    <p className="font-semibold capitalize text-gray-900 dark:text-gray-100">
                      {call.type} call
                    </p>
                    <Badge color={statusColor(call.status)}>{call.status}</Badge>
                    {call.gameName && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        in {call.gameName}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {call.reason}
                  </p>
                  {call.type === 'report' && call.reportedUser && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Reported user: {call.reportedUser}
                    </p>
                  )}
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      <ReactTimeago date={call.created} />
                    </span>
                    <span>
                      {call.messageCount} message{call.messageCount !== 1 ? 's' : ''}
                    </span>
                    {call.claimedByName && <span>Handled by {call.claimedByName}</span>}
                  </p>
                </div>

                {chatHref && (
                  <Link href={chatHref}>
                    <Button variant="discrete" size="medium">
                      View game chat
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankHistorySection({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}) {
  const { data: history, isLoading } =
    trpc.workspaces.workspace.activity.users.getRankHistory.useQuery(
      { groupId, userId },
      { enabled: !!groupId && !!userId },
    );

  const meta = (action: string) => {
    switch (action) {
      case 'promote':
        return {
          icon: ArrowTrendingUpIcon,
          color: 'green' as const,
          iconClass: 'text-green-500',
          label: 'Promoted',
        };
      case 'demote':
        return {
          icon: ArrowTrendingDownIcon,
          color: 'red' as const,
          iconClass: 'text-red-500',
          label: 'Demoted',
        };
      case 'join':
        return {
          icon: ArrowRightEndOnRectangleIcon,
          color: 'blue' as const,
          iconClass: 'text-blue-500',
          label: 'Joined',
        };
      // A member can hold several roles, so gaining or losing one is distinct
      // from being promoted/demoted (which track their highest rank). These need
      // explicit cases — the default below renders everything as "Left".
      case 'role.added':
        return {
          icon: PlusCircleIcon,
          color: 'green' as const,
          iconClass: 'text-green-500',
          label: 'Role added',
        };
      case 'role.removed':
        return {
          icon: MinusCircleIcon,
          color: 'yellow' as const,
          iconClass: 'text-yellow-500',
          label: 'Role removed',
        };
      default:
        return {
          icon: ArrowLeftStartOnRectangleIcon,
          color: 'light' as const,
          iconClass: 'text-gray-400',
          label: 'Left',
        };
    }
  };

  return (
    <div>
      <SectionHeader title="Rank History" count={history?.length} />

      {isLoading && <LoadingAnimation />}

      {history && history.length === 0 && (
        <EmptyState
          title="No rank history"
          description="No group rank changes have been recorded for this user yet. History is captured automatically on each membership sync."
        />
      )}

      {history && history.length > 0 && (
        <ol className="relative ml-3 flex flex-col gap-4 border-l border-gray-200 pl-6 dark:border-gray-700">
          {history.map((entry) => {
            const { icon: Icon, color, iconClass, label } = meta(entry.action);
            return (
              <li key={entry._id} className="relative">
                <span className="absolute -left-8.25 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Icon className={`h-4 w-4 ${iconClass}`} />
                </span>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={color}>{label}</Badge>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {entry.action === 'join' || entry.action === 'leave' ? (
                        <>{entry.newRoleName || entry.oldRoleName || 'Unknown role'}</>
                      ) : (
                        <>
                          {entry.oldRoleName || `Rank ${entry.oldRank}`}
                          <span className="mx-1.5 text-gray-400">&rarr;</span>
                          {entry.newRoleName || `Rank ${entry.newRank}`}
                        </>
                      )}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <ReactTimeago date={entry.date} /> &middot;{' '}
                    {new Date(entry.date).toLocaleString()}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;
  const workspace = useWorkspace();

  const { data: userInfo } =
    trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery(
      { groupId, userId },
      { enabled: !!groupId && !!userId },
    );

  const { data: timeOff } =
    trpc.workspaces.workspace.activity.inactivity.getUserTimeOff.useQuery(
      { groupId, userId },
      { enabled: !!groupId && !!userId },
    );

  if (!workspace) {
    return <LoadingPage />;
  }
  if (!workspace.department.permissions.activity.view) {
    router.push(`/workspaces/${groupId}`);
    return <></>;
  }

  const pendingTimeOff =
    timeOff?.filter((t) => t.request === false).length ?? 0;
  const approvedTimeOff =
    timeOff?.filter((t) => t.request !== false && (t.request as any).approved).length ?? 0;

  return (
    <>
      <Head>
        <title>
          {workspace?.premium?.is ? '' : 'ReAdmin '}
          {workspace?.groupName || ''} {userInfo?.robloxInfo?.name || ''} Records
        </title>
      </Head>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Time Off"
            value={timeOff?.length ?? 0}
            icon={ClipboardDocumentListIcon}
            accent="blue"
            loading={!timeOff}
          />
          <StatCard
            label="Pending Time Off"
            value={pendingTimeOff}
            icon={ClockIcon}
            accent="amber"
            loading={!timeOff}
          />
          <StatCard
            label="Approved Time Off"
            value={approvedTimeOff}
            icon={CheckCircleIcon}
            accent="green"
            loading={!timeOff}
          />
        </div>

        <div className="mt-8 flex flex-col gap-8">
          <TimeOffSection groupId={groupId} userId={userId} />
          <RankHistorySection groupId={groupId} userId={userId} />
          <PromotionRequestsSection groupId={groupId} userId={userId} />
          <ApplicationsSection groupId={groupId} userId={userId} />
          <CallsSection groupId={groupId} userId={userId} />
        </div>
      </div>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceUserSidebarLayout>{page}</WorkspaceUserSidebarLayout>
);
