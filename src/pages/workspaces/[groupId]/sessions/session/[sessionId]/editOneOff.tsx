/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSessionSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSessionSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { formatFullDateInTimezone, formatTimeInTimezone } from '~/utils/DateUtils';
import Button from '~/components/forms/Button';
import Modal from '~/components/ui/Modal';
import toast from 'react-hot-toast';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/20/solid';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, sessionId }: { groupId: string; sessionId: string; } = router.query as any;
  const workspace = useWorkspace();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: sessionData } =
    trpc.workspaces.workspace.sessions.v2.getSessionData.useQuery({ groupId, sessionId });
  const deleteSessionMutation =
    trpc.workspaces.workspace.sessions.v2.deleteSession.useMutation();

  const permissions = workspace.department.permissions.sessions;

  if (!permissions.view) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">You don&apos;t have permission to view other sessions</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            If you believe this is a mistake, contact one of your group admins.
          </p>
        </div>
      </>
    );
  }

  if (!sessionData) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <LoadingPage />
      </>
    );
  }

  const endTime = new Date(
    new Date(sessionData.session.date).getTime() +
    (sessionData.session.template?.sessionDuration || 0) * 60 * 1000,
  );
  const isOneOff = sessionData.session.oneOffSession;
  const canDelete =
    workspace.department.permissions.admin ||
    workspace.department.permissions.sessions.manage;

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} - ${sessionData.session.template.name}`}
        description={(
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {formatFullDateInTimezone(sessionData.session.date, userTimezone)}
            </span>
            <span className="text-gray-400">·</span>
            <span>{formatTimeInTimezone(sessionData.session.date, userTimezone)}</span>
            <span className="text-gray-400">·</span>
            <span className="font-mono text-xs text-gray-400">{sessionData.session.id}</span>
          </span>
        )}
        disableDivide={true}
        backUrl={`/workspaces/${groupId}/sessions`}
      />

      {!isOneOff ? (
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <LockClosedIcon className="h-6 w-6 text-gray-400" />
          </div>
          <p className="mt-4 font-semibold text-gray-900 dark:text-gray-100">
            This is a recurring session
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Recurring sessions are managed through their template. Edit it from the
            Schedule page to change its details.
          </p>
          <Button
            variant="discrete"
            size="medium"
            className="mt-5"
            href={`/workspaces/${groupId}/sessions/schedule`}
          >
            Go to Schedule
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {/* Session details */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40 px-5 py-3">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Session details</h2>
            </div>
            <dl className="divide-y divide-gray-100 dark:divide-gray-700/60">
              <DetailRow icon={CalendarIcon} label="Date">
                {formatFullDateInTimezone(sessionData.session.date, userTimezone)}
              </DetailRow>
              <DetailRow icon={ClockIcon} label="Time">
                {formatTimeInTimezone(sessionData.session.date, userTimezone)} – {formatTimeInTimezone(endTime, userTimezone)}
                <span className="ml-2 text-xs text-gray-400">
                  ({sessionData.session.template?.sessionDuration || 0} min)
                </span>
              </DetailRow>
              <DetailRow icon={MapPinIcon} label="Game">
                {sessionData.session.template?.name}
              </DetailRow>
              <DetailRow icon={ServerStackIcon} label="Servers">
                {Object.keys(sessionData.session.servers || {}).length}
              </DetailRow>
            </dl>
          </div>

          {/* Danger zone */}
          {canDelete && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-300">Delete this session</p>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80">
                      Permanently removes this one-time session and all of its claims. This cannot be undone.
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="medium"
                  icon={TrashIcon}
                  className="shrink-0"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete Session
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={confirmingDelete} setOpen={setConfirmingDelete} sizeOverride="md">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Delete Session
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Are you sure you want to delete this session? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="discrete"
              size="medium"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="medium"
              disabled={deleteSessionMutation.isPending}
              onClick={() => {
                const action = deleteSessionMutation
                  .mutateAsync({ groupId, sessionId })
                  .then(() => {
                    router.push(`/workspaces/${groupId}/sessions`);
                  });

                toast.promise(action, {
                  loading: 'Deleting session',
                  success: 'Session deleted',
                  error: 'Failed to delete session',
                });
              }}
            >
              Delete Session
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Icon className="h-5 w-5 shrink-0 text-gray-400" />
      <dt className="w-28 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSessionSidebarNavigationLayout>{page}</WorkspaceSessionsSessionSidebarNavigationLayout>
);
