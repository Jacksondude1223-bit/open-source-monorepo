/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactTimeago from 'react-timeago';
import { PhoneIcon, XMarkIcon, ChevronUpIcon, ExclamationTriangleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import ChatDrawer from '~/components/ui/ChatDrawer';
import { onOpenCallDrawer } from '~/components/ui/callDrawerBus';

export default function OngoingCallsWidget() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<any | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const canView =
    workspace?.department?.permissions?.calls?.view ||
    workspace?.department?.permissions?.calls?.manage ||
    workspace?.department?.permissions?.admin ||
    false;

  const { data } = trpc.workspaces.workspace.calls.getOngoingSummary.useQuery(
    { groupId },
    {
      enabled: !!groupId && !!canView,
      refetchInterval: 10000,
    }
  );

  // Allow any page (player cards, user profile, …) to pop the chat drawer for a
  // specific call without routing to the legacy /calls/[callId] page. The
  // drawer self-hydrates from the id, so we only need to hand it the _id.
  useEffect(() => {
    return onOpenCallDrawer(({ callId }) => {
      setSelectedCall({ _id: callId });
      setChatOpen(true);
    });
  }, []);

  if (!canView || !groupId) return null;

  const openChat = (call: NonNullable<typeof data>['calls'][number]) => {
    setSelectedCall({
      _id: call._id,
      status: call.status,
      type: call.type,
      reason: call.reason,
      reportedUser: call.reportedUser,
      gameId: call.gameId,
      placeId: call.placeId,
      runningGameId: call.runningGameId,
      callerInfo: { name: call.callerName, thumbnail: call.callerThumbnail },
      gameInfo: { name: call.gameName },
    });
    setChatOpen(true);
  };

  const total = data?.total || 0;
  // Hide the launcher button while on the calls page or when there is nothing ongoing,
  // but keep the chat drawer mounted so an open conversation stays available.
  const onCallsPage = router.asPath.startsWith(`/workspaces/${groupId}/calls`);
  const hideLauncher = onCallsPage || total === 0;

  return (
    <>
      {!hideLauncher && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 print:hidden">
          {open && (
            <div className="w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <PhoneIcon className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Active Calls</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {data?.open || 0} open · {data?.claimed || 0} claimed
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {data?.calls?.map((call) => (
                  <button
                    key={call._id}
                    onClick={() => openChat(call)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <img
                      src={call.callerThumbnail}
                      className="h-9 w-9 rounded-full bg-blue-500 shrink-0"
                      alt="Caller"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {call.callerName}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            call.status === 'open'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}
                        >
                          {call.status}
                        </span>
                      </div>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{call.reason}</p>
                      {call.type === 'report' && call.reportedUser && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-red-600 dark:text-red-400">
                          <ExclamationTriangleIcon className="h-3 w-3 shrink-0" />
                          {call.reportedUser}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                        <ReactTimeago date={call.created} />
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <Link
                href={`/workspaces/${groupId}/calls`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                View all calls
              </Link>
            </div>
          )}

          <button
            onClick={() => setOpen((o) => !o)}
            className="group flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-white shadow-lg transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            {open ? <ChevronUpIcon className="h-5 w-5 rotate-180" /> : <PhoneIcon className="h-5 w-5" />}
            <span className="text-sm font-semibold">{total} active call{total !== 1 && 's'}</span>
            {(data?.open || 0) > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-blue-600">
                {data?.open}
              </span>
            )}
          </button>
        </div>
      )}

      {selectedCall && (
        <ChatDrawer
          open={chatOpen}
          setOpen={setChatOpen}
          call={selectedCall}
          groupId={groupId}
        />
      )}
    </>
  );
}
