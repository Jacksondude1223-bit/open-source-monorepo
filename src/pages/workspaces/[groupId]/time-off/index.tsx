'use client';

import { ChatBubbleBottomCenterIcon, PlusIcon, CheckIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { Dispatch, ReactElement, SetStateAction, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import DateBetweenPicker from '~/components/ui/DateBetweenPicker';
import Modal from '~/components/ui/Modal';
import { AuthenticatedUserContext, useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import Badge from '~/components/ui/Badge';
import { Inactivity } from '~/services/NewMongoTypes';
import { ChatBubbleOvalLeftIcon, TrashIcon, CalendarDaysIcon, ClockIcon, UserCircleIcon, MagnifyingGlassIcon, ListBulletIcon, ViewColumnsIcon } from '@heroicons/react/24/outline';
import React, { useMemo } from 'react';
import ReactTimeago from 'react-timeago';
import Link from 'next/link';
import { Skeleton } from '@mui/material';
import { keepPreviousData } from '@tanstack/react-query';

export function CreateInactivityModal({ approveInactivity, createInactivityOpen, setCreateInactivityOpen }: { approveInactivity?: boolean; createInactivityOpen: boolean, setCreateInactivityOpen: Dispatch<SetStateAction<boolean>> }) {
  const createMutation = trpc.workspaces.workspace.activity.inactivity.requestInactivity.useMutation();
  const workspace = useWorkspace();
  const userInfo = useUser() as AuthenticatedUserContext;
  const context = trpc.useUtils();

  // useWorkspace() is typed as always-present but is really the tRPC query's
  // `data`, so it is undefined until the workspace loads. The page renders this
  // modal unconditionally, and the body dereferences workspace.groupId during
  // render — which crashed the whole page on first paint.
  if (!workspace?.groupId) return null;

  return (

    <Modal
      open={createInactivityOpen}
      setOpen={(o: boolean) => {
        setCreateInactivityOpen(o);
        if (o == false) {
          createMutation.reset();
        }
      }}
    >
      <PageHeading
        title={`${approveInactivity ? 'Create' : 'Request'} Time Off`}
      />
      <form
        className="flex flex-col gap-4"
        onSubmit={async (f) => {
          f.preventDefault();
          const target: any = f.target as any;

          createMutation
            .mutateAsync({
              groupId: workspace.groupId,
              reason: target.reason.value,
              start: new Date(target.startdate.value),
              end: new Date(target.enddate.value),
              ...(target.user ? { userId: target.user.value.toString() } : { userId: 'false' }),
            })
            .then(() => {
              toast.success('Successfully created inactivity');
              setCreateInactivityOpen(false);
              createMutation.reset();
              context.workspaces.workspace.activity.inactivity.getTimeOff.invalidate({ groupId: workspace.groupId });
              context.workspaces.workspace.activity.inactivity.getTimeOffTimeline.invalidate({ groupId: workspace.groupId });
            })
            .catch((error) => {
              alert(error.message);
            });
        }}
      >
        {createMutation.isPending || createMutation.isSuccess ? (
          <>
            <LoadingPage />
          </>
        ) : createMutation.error ? (
          <>
            <p>
              Something went wrong while trying to create an inactivity
              request
            </p>
            <p>{createMutation.error.message}</p>
          </>
        ) : createMutation.isSuccess ? (
          <>
            <p>Successfully created inactivity request!</p>
          </>
        ) : (
          <>
            {workspace?.department?.permissions?.activity
              .requestInactivityForOtherUsers && (
                <RobloxUserSearch
                  label="Who is this for?"
                  id="user"
                  placeholder="Search for a user"
                  groupId={workspace.groupId}
                  defaultUser={userInfo?.user?.dbUser?.robloxId}
                />
              )}
            <TextLabel
              label={`What is the reason for ${workspace?.department?.permissions?.activity?.requestInactivityForOtherUsers ? 'this' : 'your'} inactivity`}
              id="reason"
              icon={ChatBubbleBottomCenterIcon}
              placeholder="Type a reason here"
            />
            <DateBetweenPicker inModal={true} />
            <Button type="submit" variant="primary">
              {approveInactivity ? 'Create' : 'Request'} Inactivity
            </Button>
          </>
        )}
      </form>
    </Modal >
  )
}

type StatusKey = 'pending' | 'approved' | 'declined';

type RequestStatus = {
  label: string;
  color: 'green' | 'yellow' | 'red';
  key: StatusKey;
  declineReason?: string;
};

type UserContext = {
  total: number;
  pending: number;
  approvedDaysLast90: number;
  lastEnded?: Date | string | null;
  activeNow: boolean;
};

const STATUS_BAR: Record<StatusKey, string> = {
  approved: 'bg-emerald-500',
  pending: 'bg-amber-400',
  declined: 'bg-rose-400',
};

function getStatus(request: Inactivity['request']): RequestStatus {
  if (request === false) return { label: 'Pending approval', color: 'yellow', key: 'pending' };
  if (request.approved) return { label: 'Approved', color: 'green', key: 'approved' };
  return { label: 'Declined', color: 'red', key: 'declined', declineReason: request.reason };
}

function formatRange(start: Date | string, end: Date | string) {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(s.getFullYear() !== e.getFullYear() ? { year: 'numeric' } : {}),
  });
  const endStr = e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function rangeInDays(start: Date | string, end: Date | string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function isActiveNow(inactivity: Inactivity) {
  const now = Date.now();
  return (
    getStatus(inactivity.request).key === 'approved' &&
    new Date(inactivity.starts).getTime() <= now &&
    now <= new Date(inactivity.ends).getTime()
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function daysInMonthOf(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function pct(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function RequestActions({
  inactivity,
  onActionDone,
}: {
  inactivity: Inactivity;
  onActionDone?: () => void;
}) {
  const workspace = useWorkspace();
  const user = useUser() as AuthenticatedUserContext;
  const context = trpc.useUtils();
  const [deleting, setDeleting] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const updateMutation = trpc.workspaces.workspace.activity.inactivity.updateInactivityRequestStatus.useMutation();
  const deleteMutation = trpc.workspaces.workspace.activity.inactivity.deleteInactivityRequest.useMutation();
  const { manageInactivity } = workspace?.department?.permissions?.activity || { manageInactivity: false };
  const groupId = workspace.groupId;
  const id = inactivity._id!.toString();
  const isOwn = inactivity.userId === user?.user?.dbUser?.robloxId?.toString();
  const isPending = inactivity.request === false;
  const canDelete = manageInactivity || isOwn;

  const invalidate = () => {
    context.workspaces.workspace.activity.inactivity.getTimeOff.invalidate({ groupId });
    context.workspaces.workspace.activity.inactivity.getTimeOffTimeline.invalidate({ groupId });
  };

  if (!canDelete) return null;

  return (
    <div className="flex flex-row flex-wrap items-center gap-1.5">
      {manageInactivity && isPending && (
        <>
          <Button
            variant="success"
            size="small"
            icon={CheckIcon}
            onClick={() => {
              updateMutation
                .mutateAsync({ groupId, id, status: 'accept' })
                .then(() => {
                  toast.success('Request approved');
                  invalidate();
                  onActionDone?.();
                })
                .catch((e: any) => toast.error(`Something went wrong ${e}`));
            }}
          >
            Approve
          </Button>
          <Button variant="warning" size="small" icon={XMarkIcon} onClick={() => setDeclineOpen(true)}>
            Decline
          </Button>
        </>
      )}
      {canDelete && (
        <Button
          icon={TrashIcon}
          size="small"
          variant={deleting ? 'danger' : 'discrete'}
          onClick={() => {
            if (deleting) {
              const deletePromise = deleteMutation
                .mutateAsync({ groupId, id })
                .then(() => {
                  invalidate();
                  onActionDone?.();
                });
              toast.promise(deletePromise, {
                loading: 'Deleting...',
                success: 'Deleted!',
                error: 'Failed to delete',
              });
            } else {
              setDeleting(true);
              setTimeout(() => setDeleting(false), 1500);
            }
          }}
        >
          {deleting ? 'Are you sure?' : ''}
        </Button>
      )}
      <Modal open={declineOpen} setOpen={setDeclineOpen}>
        <PageHeading title="Decline time-off request" />
        <form
          className="flex flex-col gap-2"
          onSubmit={async (f) => {
            f.preventDefault();
            const target = f.target as any;
            const reason = target.reason.value;
            updateMutation
              .mutateAsync({ groupId, id, reason, status: 'decline' })
              .then(() => {
                toast.success('Request declined');
                invalidate();
                setDeclineOpen(false);
                onActionDone?.();
              })
              .catch((e: any) => toast.error(`Something went wrong ${e}`));
          }}
        >
          <TextLabel
            id="reason"
            label="Reason for declining request"
            icon={ChatBubbleOvalLeftIcon}
            placeholder="Type here"
          />
          <p className="-mt-1.5 text-sm text-gray-500">
            Note that the user will be able to see this reason.
          </p>
          <div className="flex flex-row justify-end gap-2">
            <Button variant="discrete" size="medium" type="button" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="medium" type="submit">
              Decline
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** Compact one-line-ish list row. */
function RequestRow({
  inactivity,
  groupId,
  canManage,
  context,
}: {
  inactivity: Inactivity;
  groupId: string;
  canManage: boolean;
  context?: UserContext;
}) {
  const status = getStatus(inactivity.request);
  const activeNow = isActiveNow(inactivity);
  const days = rangeInDays(inactivity.starts, inactivity.ends);
  const reviewer = inactivity.request ? inactivity.request.adminUser : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/40 dark:hover:border-gray-700">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`/workspaces/${groupId}/users/${inactivity.userId}`}
          target="_blank"
          className="min-w-0 shrink-0 transition hover:opacity-80"
        >
          <TextReturnForUserId userId={inactivity.userId} includeImage={true} />
        </Link>

        <Badge color={status.color}>{status.label}</Badge>
        {activeNow && <Badge color="blue">Out now</Badge>}

        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <CalendarDaysIcon className="h-4 w-4 shrink-0" />
          {formatRange(inactivity.starts, inactivity.ends)}
          <span className="text-gray-400 dark:text-gray-600">·</span>
          {days}d
        </span>

        {inactivity.reason ? (
          <span
            className="hidden min-w-0 flex-1 truncate text-xs text-gray-500 sm:block dark:text-gray-400"
            title={inactivity.reason}
          >
            {inactivity.reason}
          </span>
        ) : inactivity.reasonHidden ? (
          <span className="hidden min-w-0 flex-1 truncate text-xs italic text-gray-400 sm:block dark:text-gray-500">
            Reason hidden
          </span>
        ) : null}

        <div className="ml-auto shrink-0">
          <RequestActions inactivity={inactivity} />
        </div>
      </div>

      {inactivity.reason ? (
        <p className="mt-1 truncate text-xs text-gray-500 sm:hidden dark:text-gray-400">{inactivity.reason}</p>
      ) : inactivity.reasonHidden ? (
        <p className="mt-1 truncate text-xs italic text-gray-400 sm:hidden dark:text-gray-500">Reason hidden</p>
      ) : null}

      {status.key === 'declined' && status.declineReason && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          <span className="font-medium">Declined:</span> {status.declineReason}
        </p>
      )}

      {reviewer && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
          <UserCircleIcon className="h-3.5 w-3.5 shrink-0" />
          {status.key === 'approved' ? 'Approved' : 'Declined'} by{' '}
          <Link
            href={`/workspaces/${groupId}/users/${reviewer}`}
            target="_blank"
            className="font-medium text-gray-500 hover:underline dark:text-gray-300"
          >
            <TextReturnForUserId userId={reviewer} />
          </Link>
        </p>
      )}

      {context && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
            {context.total} request{context.total === 1 ? '' : 's'} made
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 ${
              context.approvedDaysLast90 >= 14
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {context.approvedDaysLast90}d off in last 90d
          </span>
          {context.activeNow && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              currently out
            </span>
          )}
          {context.lastEnded && (
            <span>
              last back {new Date(context.lastEnded).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Details + actions modal opened from a timeline bar. */
function RequestDetailsModal({
  inactivity,
  groupId,
  canSeeAll,
  open,
  setOpen,
}: {
  inactivity: Inactivity;
  groupId: string;
  canSeeAll: boolean;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const status = getStatus(inactivity.request);
  const adminUser = inactivity.request ? inactivity.request.adminUser : null;
  const days = rangeInDays(inactivity.starts, inactivity.ends);

  return (
    <Modal open={open} setOpen={setOpen}>
      <PageHeading title="Time off request" />
      <div className="flex flex-col gap-3">
        <Link
          href={`/workspaces/${groupId}/users/${inactivity.userId}`}
          target="_blank"
          className="w-min transition hover:opacity-80"
        >
          <TextReturnForUserId userId={inactivity.userId} includeImage={true} />
        </Link>

        <div className="flex items-center gap-2">
          <Badge color={status.color}>{status.label}</Badge>
          {isActiveNow(inactivity) && <Badge color="blue">Out now</Badge>}
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDaysIcon className="h-4 w-4 shrink-0" />
            {formatRange(inactivity.starts, inactivity.ends)} · {days} day{days === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <ClockIcon className="h-4 w-4 shrink-0" />
            Requested <ReactTimeago date={inactivity.created} />
          </span>
          {canSeeAll && adminUser && (
            <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <UserCircleIcon className="h-4 w-4 shrink-0" />
              Reviewed by{' '}
              <Link
                href={`/workspaces/${groupId}/users/${adminUser}`}
                target="_blank"
                className="font-medium text-gray-700 hover:underline dark:text-gray-300"
              >
                <TextReturnForUserId userId={adminUser} />
              </Link>
            </span>
          )}
        </div>

        {inactivity.reason ? (
          <p className="wrap-break-word rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
            {inactivity.reason}
          </p>
        ) : inactivity.reasonHidden ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm italic text-gray-400 dark:bg-gray-800/60 dark:text-gray-500">
            Reason hidden — you don’t have permission to view it.
          </p>
        ) : null}

        {status.key === 'declined' && status.declineReason && (
          <p className="text-xs text-red-600 dark:text-red-400">
            <span className="font-medium">Decline reason:</span> {status.declineReason}
          </p>
        )}

        <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
          <RequestActions inactivity={inactivity} onActionDone={() => setOpen(false)} />
        </div>
      </div>
    </Modal>
  );
}

/** Month Gantt: rows = users, bars = time-off periods coloured by status. */
function TimeOffTimeline({
  inactivities,
  groupId,
  monthStart,
  onPrev,
  onNext,
  onToday,
  onSelect,
}: {
  inactivities: Inactivity[];
  groupId: string;
  monthStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (i: Inactivity) => void;
}) {
  const startMs = monthStart.getTime();
  const monthEnd = addMonths(monthStart, 1);
  const endMs = monthEnd.getTime();
  const span = endMs - startMs || 1;
  const numDays = daysInMonthOf(monthStart);
  const now = Date.now();
  const nowPct = now >= startMs && now < endMs ? ((now - startMs) / span) * 100 : null;

  const rows = useMemo(() => {
    const map = new Map<string, Inactivity[]>();
    for (const i of inactivities) {
      const s = new Date(i.starts).getTime();
      const e = new Date(i.ends).getTime();
      if (e <= startMs || s >= endMs) continue;
      const arr = map.get(i.userId) || [];
      arr.push(i);
      map.set(i.userId, arr);
    }
    return Array.from(map.entries())?.map(([userId, items]) => ({
        userId,
        items,
        hasPending: items.some((it) => getStatus(it.request).key === 'pending'),
        earliest: Math.min(...items?.map((it) => new Date(it.starts).getTime())),
      }))
      .sort((a, b) => Number(b.hasPending) - Number(a.hasPending) || a.earliest - b.earliest);
  }, [inactivities, startMs, endMs]);

  const labelWidth = 168;
  const minWidth = labelWidth + numDays * 30;
  const rangeLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="rounded-md border border-gray-200 p-1 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
            {rangeLabel}
          </span>
          <button
            onClick={onNext}
            className="rounded-md border border-gray-200 p-1 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onToday}
            className="ml-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Approved</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Pending</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Declined</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          {/* Day header */}
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            <div className="sticky left-0 z-20 shrink-0 bg-white dark:bg-gray-900" style={{ width: labelWidth }} />
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${numDays}, minmax(0, 1fr))` }}>
              {Array.from({ length: numDays })?.map((_, i) => {
                const dayDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1);
                const weekend = [0, 6].includes(dayDate.getDay());
                const isToday = sameDay(dayDate, new Date());
                return (
                  <div
                    key={i}
                    className={`py-1 text-center text-[10px] ${
                      isToday
                        ? 'font-bold text-blue-600 dark:text-blue-400'
                        : weekend
                          ? 'text-gray-300 dark:text-gray-600'
                          : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No time off this month.</div>
          ) : (
            rows?.map((row) => (
              <div
                key={row.userId}
                className="flex items-center border-b border-gray-50 last:border-0 dark:border-gray-800/60"
              >
                <Link
                  href={`/workspaces/${groupId}/users/${row.userId}`}
                  target="_blank"
                  className="sticky left-0 z-20 flex shrink-0 items-center overflow-hidden bg-white px-3 py-1.5 transition hover:opacity-80 dark:bg-gray-900"
                  style={{ width: labelWidth }}
                >
                  <TextReturnForUserId userId={row.userId} includeImage={true} />
                </Link>

                <div className="relative h-9 flex-1">
                  {/* Gridlines + weekend shading */}
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${numDays}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: numDays })?.map((_, i) => {
                      const dayDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1);
                      const weekend = [0, 6].includes(dayDate.getDay());
                      return (
                        <div
                          key={i}
                          className={`${i > 0 ? 'border-l border-gray-100 dark:border-gray-800/60' : ''} ${
                            weekend ? 'bg-gray-50 dark:bg-gray-800/30' : ''
                          }`}
                        />
                      );
                    })}
                  </div>

                  {nowPct !== null && (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-rose-400/80"
                      style={{ left: pct(nowPct) }}
                    />
                  )}

                  {row?.items?.map((it, idx) => {
                    const st = getStatus(it.request);
                    const s = new Date(it.starts).getTime();
                    const e = new Date(it.ends).getTime();
                    const cs = Math.max(s, startMs);
                    const ce = Math.min(e, endMs);
                    const left = ((cs - startMs) / span) * 100;
                    const width = ((ce - cs) / span) * 100;
                    const clipL = s < startMs;
                    const clipR = e > endMs;
                    const activeNow = isActiveNow(it);
                    const rounded = `${clipL ? 'rounded-l-none' : 'rounded-l-[3px]'} ${
                      clipR ? 'rounded-r-none' : 'rounded-r-[3px]'
                    }`;
                    return (
                      <button
                        key={it._id?.toString() || idx}
                        onClick={() => onSelect(it)}
                        title={`${st.label} · ${formatRange(it.starts, it.ends)}${it.reason ? ` · ${it.reason}` : it.reasonHidden ? ' · Reason hidden' : ''}`}
                        className={`absolute top-1.5 bottom-1.5 z-1 ${STATUS_BAR[st.key]} ${rounded} ${
                          activeNow ? 'animate-pulse' : ''
                        } opacity-90 transition hover:opacity-100 hover:ring-2 hover:ring-blue-400/40`}
                        style={{ left: pct(left), width: `max(6px, ${pct(width)})` }}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const [createInactivityOpen, setCreateInactivityOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusKey>('all');
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const [monthStart, setMonthStart] = useState<Date>(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Inactivity | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsername(usernameInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [usernameInput]);

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(0);
  }, [statusFilter, username]);
  const PAGE_SIZE = 20;

  const { approveInactivity } = workspace?.department?.permissions?.activity || { approveInactivity: false };
  const canManage = !!workspace?.department?.permissions?.activity?.manageInactivity;
  const canSeeAll = !!(workspace?.department?.permissions?.activity?.view || canManage);

  const listQuery = trpc.workspaces.workspace.activity.inactivity.getTimeOff.useQuery(
    { groupId, username, status: statusFilter, page, limit: PAGE_SIZE },
    { enabled: !!groupId && view === 'list', placeholderData: keepPreviousData },
  );

  const timelineQuery = trpc.workspaces.workspace.activity.inactivity.getTimeOffTimeline.useQuery(
    {
      groupId,
      username,
      year: monthStart.getFullYear(),
      month: monthStart.getMonth(),
      status: statusFilter,
    },
    { enabled: !!groupId && view === 'timeline', placeholderData: keepPreviousData },
  );

  const isLoading = view === 'list' ? listQuery.isLoading : timelineQuery.isLoading;

  const counts =
    (view === 'list' ? listQuery.data?.counts : timelineQuery.data?.counts) ?? {
      all: 0,
      pending: 0,
      approved: 0,
      declined: 0,
    };
  const contexts = listQuery.data?.contexts ?? {};
  const requests = listQuery.data?.requests ?? [];
  const timelineRequests = timelineQuery.data?.requests ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterTabs: { key: typeof statusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'declined', label: 'Declined' },
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{workspace?.groupName} Time Off</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage inactivity requests and time-off for your team.
          </p>
        </div>
        <Button
          variant="blue"
          onClick={() => setCreateInactivityOpen(true)}
          icon={PlusIcon}
          className="w-full whitespace-nowrap sm:w-auto"
        >
          {approveInactivity ? 'Create' : 'Request'} Time Off
        </Button>
      </div>

      {canSeeAll && (
        <div className="mb-4">
          <TextLabel
            label="Search for a user"
            id="search"
            placeholder="Type a username"
            icon={MagnifyingGlassIcon}
            onChange={(value) => {
              setUsernameInput(value);
            }}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterTabs?.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                  statusFilter === tab.key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="inline-flex shrink-0 rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === 'list'
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <ListBulletIcon className="h-4 w-4" /> List
          </button>
          <button
            type="button"
            onClick={() => setView('timeline')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === 'timeline'
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <ViewColumnsIcon className="h-4 w-4" /> Timeline
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800">
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="text" width={120} height={20} />
              <Skeleton variant="rounded" width={90} height={22} />
              <Skeleton variant="text" width={140} height={16} />
            </div>
          ))}
        </div>
      ) : view === 'timeline' ? (
        <TimeOffTimeline
          inactivities={timelineRequests}
          groupId={groupId}
          monthStart={monthStart}
          onPrev={() => setMonthStart((m) => addMonths(m, -1))}
          onNext={() => setMonthStart((m) => addMonths(m, 1))}
          onToday={() => setMonthStart(startOfMonth(new Date()))}
          onSelect={(i) => setSelected(i)}
        />
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700">
          <CalendarDaysIcon className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            No time-off requests {statusFilter !== 'all' ? `marked ${statusFilter}` : 'yet'}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {statusFilter !== 'all'
              ? 'Try a different filter.'
              : 'Requests will appear here once they are created.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {requests.map((inactivity) => (
              <RequestRow
                key={inactivity._id?.toString()}
                inactivity={inactivity}
                groupId={groupId}
                canManage={canManage}
                context={contexts[inactivity.userId]}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {total.toLocaleString()} request{total === 1 ? '' : 's'} · Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="discrete"
                  size="small"
                  icon={ChevronLeftIcon}
                  disabled={page <= 0 || listQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="discrete"
                  size="small"
                  icon={ChevronRightIcon}
                  disabled={page >= totalPages - 1 || listQuery.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateInactivityModal approveInactivity={approveInactivity} createInactivityOpen={createInactivityOpen} setCreateInactivityOpen={setCreateInactivityOpen} />

      {selected && (
        <RequestDetailsModal
          inactivity={selected}
          groupId={groupId}
          canSeeAll={canSeeAll}
          open={!!selected}
          setOpen={(o) => {
            if (!o) setSelected(null);
          }}
        />
      )}
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
