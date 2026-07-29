'use client';

import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import Link from 'next/link';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { RouterOutput, trpc } from '~/utils/trpc';
import ReactTimeago from 'react-timeago';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import Button from '~/components/forms/Button';
import { useUser } from '~/components/contexts/user';
import toast from 'react-hot-toast';
import { ArrayToValueType } from '~/server/routers/_app';
import Modal from '~/components/ui/Modal';
import Card from '~/components/ui/Card';
import SlideOutDrawer from '~/components/ui/SlideOutDrawer';
import ChatDrawer from '~/components/ui/ChatDrawer';
import { ChatBubbleLeftRightIcon, UserIcon, PlayIcon, ClockIcon, ExclamationTriangleIcon, CheckCircleIcon, MagnifyingGlassIcon, FunnelIcon, ArrowTopRightOnSquareIcon, NoSymbolIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const user = useUser();
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'claimed' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  const { data: allTickets } = trpc.workspaces.workspace.calls.getAllTickets.useQuery({
    groupId,
    status: statusFilter
  }, {
    refetchInterval: 5000
  })

  const { data: bans } = trpc.workspaces.workspace.calls.getBans.useQuery({
    groupId,
  }, {
    refetchInterval: 10000
  })

  const claimCallMutation = trpc.workspaces.workspace.calls.claimCall.useMutation();
  const releaseCallMutation = trpc.workspaces.workspace.calls.releaseCall.useMutation();
  const closeCallMutation = trpc.workspaces.workspace.calls.closeCall.useMutation();
  const banUserMutation = trpc.workspaces.workspace.calls.banUser.useMutation();
  const deleteBanMutation = trpc.workspaces.workspace.calls.deleteBan.useMutation();

  const [closingCall, setClosingCall] = useState<false | ArrayToValueType<RouterOutput["workspaces"]["workspace"]["calls"]["getOngoingTickets"]>>(false);
  const [banningCall, setBanningCall] = useState<false | ArrayToValueType<RouterOutput["workspaces"]["workspace"]["calls"]["getAllTickets"]>>(false);
  const [banReason, setBanReason] = useState('');
  const [showBans, setShowBans] = useState(false);
  const [selectedCall, setSelectedCall] = useState<ArrayToValueType<RouterOutput["workspaces"]["workspace"]["calls"]["getOngoingTickets"]> | null>(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  const context = trpc.useUtils();

  if (!('user' in user)) {
    return <></>;
  }

  const canManage = workspace?.department?.permissions?.calls?.manage || workspace?.department?.permissions?.admin || false;
  const canDeleteBans = workspace?.department?.permissions?.calls?.deleteBans || workspace?.department?.permissions?.admin || false;
  const canViewUsers = workspace?.department?.permissions?.activity?.view || workspace?.department?.permissions?.admin || false;
  const canViewGames = workspace?.department?.permissions?.games?.view || workspace?.department?.permissions?.admin || false;

  // Filter and sort tickets
  const filteredAndSortedTickets = allTickets
    ?.filter(ticket => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        ticket.callerInfo?.name?.toLowerCase().includes(searchLower) ||
        ticket.callerInfo?.id?.toString().includes(searchTerm) ||
        ticket.reportedUser?.toLowerCase().includes(searchLower) ||
        ticket.reason?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    }) || [];

  const handleCallAction = async (call: ArrayToValueType<RouterOutput["workspaces"]["workspace"]["calls"]["getOngoingTickets"]>, action: 'claim' | 'release') => {
    const mutation = action === 'claim' ? claimCallMutation : releaseCallMutation;
    try {
      await mutation.mutateAsync({ groupId, callId: call._id.toString() });
      context.workspaces.workspace.calls.getAllTickets.invalidate({ groupId });
      toast.success(`Call ${action}d successfully`);
    } catch (error) {
      toast.error(`Failed to ${action} call`);
    }
  };

  const openChat = (call: ArrayToValueType<RouterOutput["workspaces"]["workspace"]["calls"]["getOngoingTickets"]>) => {
    setSelectedCall(call);
    setChatDrawerOpen(true);
  };

  const openChatById = (callId: string) => {
    setSelectedCall({ _id: callId } as any);
    setChatDrawerOpen(true);
  };

  const submitBan = async () => {
    if (banningCall === false) return;
    const reason = banReason.trim();
    if (!reason) {
      toast.error('A reason is required');
      return;
    }
    try {
      await banUserMutation.mutateAsync({
        groupId,
        userId: (banningCall.callerInfo?.id ?? banningCall.callerId).toString(),
        reason,
        linkedCallId: banningCall._id.toString(),
      });
      toast.success('User banned from calls');
      setBanningCall(false);
      setBanReason('');
      context.workspaces.workspace.calls.getBans.invalidate({ groupId });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to ban user');
    }
  };

  const removeBan = async (banId: string) => {
    try {
      await deleteBanMutation.mutateAsync({ groupId, banId });
      toast.success('Ban removed');
      context.workspaces.workspace.calls.getBans.invalidate({ groupId });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove ban');
    }
  };

  const joinGame = (call: ArrayToValueType<RouterOutput["workspaces"]["workspace"]["calls"]["getOngoingTickets"]>) => {
    if (call?.gameInfo?.placeId) {
      window.open(
        `https://www.roblox.com/games/start?placeId=${call.gameInfo.placeId}&launchData=ReAdmin-Support`,
        '_blank'
      );
    } else {
      toast.error('Game information not available');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'claimed': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
      case 'closed': return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'report': return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'support': return <UserIcon className="h-5 w-5 text-blue-500" />;
      default: return <UserIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Support Calls`}
        description="View, claim, and respond to in-game support calls and reports."
        disableDivide={false}
      />

      {/* Toolbar */}
      <div className="mb-4 space-y-3">
        {/* Status tabs with counts */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: 'all', label: 'All', count: allTickets?.length || 0, dot: 'bg-gray-400' },
            { key: 'open', label: 'Open', count: allTickets?.filter(c => c.status === 'open').length || 0, dot: 'bg-yellow-500' },
            { key: 'claimed', label: 'Claimed', count: allTickets?.filter(c => c.status === 'claimed').length || 0, dot: 'bg-blue-500' },
            { key: 'closed', label: 'Closed', count: allTickets?.filter(c => c.status === 'closed').length || 0, dot: 'bg-green-500' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition border ${statusFilter === tab.key
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${tab.dot}`} />
              {tab.label}
              <span className="text-xs text-gray-400 dark:text-gray-500">{tab.count}</span>
            </button>
          ))}
          <button
            onClick={() => setShowBans((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition border ${showBans
              ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
          >
            <NoSymbolIcon className="w-4 h-4" />
            Banned Users
            <span className="text-xs text-gray-400 dark:text-gray-500">{bans?.length || 0}</span>
          </button>
        </div>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search by username, user ID, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="block py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {searchTerm && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredAndSortedTickets.length} result{filteredAndSortedTickets.length !== 1 && 's'} for &ldquo;{searchTerm}&rdquo;
          </p>
        )}
      </div>

      {showBans ? (
        !bans || bans.length === 0 ? (
          <Card className="text-center py-12">
            <NoSymbolIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              No banned users
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Users you ban from creating calls will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {bans.map((ban) => (
              <Card key={ban._id} className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img
                    src={ban.userThumbnail}
                    className="w-12 h-12 rounded-full bg-red-500 shrink-0"
                    alt="User thumbnail"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{ban.userName}</p>
                      <a
                        href={`https://www.roblox.com/users/${ban.userId}/profile`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-blue-500 transition shrink-0"
                        title="Open Roblox profile"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </a>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                      <span className="text-gray-500 dark:text-gray-500">Reason: </span>{ban.reason}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Banned by {ban.bannedByName || 'Unknown'} · <ReactTimeago date={ban.created} />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ban.linkedCallId && (
                    <Button
                      variant="discrete"
                      size="small"
                      onClick={() => openChatById(ban.linkedCallId!)}
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                      View Chat Log
                    </Button>
                  )}
                  {canDeleteBans && (
                    <Button
                      variant="light_danger"
                      size="small"
                      onClick={() => removeBan(ban._id)}
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Remove Ban
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : !filteredAndSortedTickets || filteredAndSortedTickets.length === 0 ? (
        <Card className="text-center py-12">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {searchTerm ? 'No calls match your search' : 'No calls found'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search terms or filters.' : 'When users create support tickets, they\'ll appear here.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedTickets.map((call) => (
            <Card key={call._id.toString()} className="hover:shadow-xl transition-shadow duration-300">
              {/* Header with caller info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={call?.callerInfo?.thumbnail}
                    className="w-12 h-12 rounded-full bg-blue-500"
                    alt="User thumbnail"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{call?.callerInfo?.name}</p>
                      <a
                        href={`https://www.roblox.com/users/${call?.callerInfo?.id}/profile`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-blue-500 transition"
                        title="Open Roblox profile"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </a>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {call?.callerInfo?.id}</p>
                    {canViewUsers && (
                      <Link
                        href={`/workspaces/${groupId}/users/${call?.callerInfo?.id}`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View staff profile
                      </Link>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                  {call.status}
                </span>
              </div>

              {/* Call details */}
              <div className="space-y-3 mb-4">
                {/* Creation Time */}
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Created </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <ReactTimeago date={call.created} />
                    </span>
                  </div>
                </div>

                {/* Type and Reason */}
                <div className="flex items-start space-x-2">
                  {getTypeIcon(call.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {call.type === 'report' ? 'Report' : 'Support Request'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{call.reason}</p>
                  </div>
                </div>

                {/* Game Info */}
                <div className="flex items-center space-x-2">
                  <PlayIcon className="h-4 w-4 text-gray-400" />
                  {canViewGames && call?.gameId && call?.runningGameId && call.serverInfo && call.status !== 'closed' ? (
                    <Link
                      href={`/workspaces/${groupId}/games/${call.placeId}/running/${call.runningGameId.toString()}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {call?.gameInfo?.name || 'Unknown Game'} — view server
                    </Link>
                  ) : canViewGames && call?.gameId ? (
                    <Link
                      href={`/workspaces/${groupId}/games/${call.placeId}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {call?.gameInfo?.name || 'Unknown Game'}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {call?.gameInfo?.name || 'Unknown Game'}
                    </span>
                  )}
                </div>

                {/* Reported User (Suspect) */}
                {call.reportedUser && (
                  <div className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    <div className="flex items-center space-x-2 min-w-0">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Suspect: </span>
                        <span className="text-sm font-medium text-red-700 dark:text-red-400 break-words">
                          {call.reportedUser}
                        </span>
                      </div>
                    </div>
                    {canViewGames && call?.gameId && call?.runningGameId && call.serverInfo && call.status !== 'closed' && (
                      <Link
                        href={`/workspaces/${groupId}/games/${call.placeId}/running/${call.runningGameId.toString()}`}
                        className="shrink-0 inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 hover:underline whitespace-nowrap"
                        title="Find this user in the server"
                      >
                        <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                        Find in server
                      </Link>
                    )}
                  </div>
                )}

                {/* Claimed By Agent */}
                {call.claimedByInfo && (
                  <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                    <UserIcon className="h-4 w-4 text-blue-500" />
                    <div className="flex-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Agent: </span>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                        {call.claimedByInfo.name}
                      </span>
                    </div>
                  </div>
                )}

                {/* Closed Status */}
                {call.status === 'closed' && call.closed && (
                  <div className="flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    <div className="flex-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Closed by: </span>
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        {call.closed.user}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {(() => {
                // The running_games doc is deleted when a server ends, so a missing
                // serverInfo means the server is gone and any links into it (e.g.
                // the live game chat page) would 404. Gate those actions on it.
                const serverRunning = !!call.serverInfo;
                const isMine = call?.claimedBy === parseInt(user?.user?.dbUser?.robloxId || '0');
                const isClosed = (call.status as string) === 'closed';
                const canClose = canManage && isMine && call.status === 'claimed';
                return (
                  <div className="space-y-2">
                    {/* Primary action */}
                    <Button
                      variant="blue"
                      size="small"
                      className="w-full"
                      onClick={() => openChat(call)}
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                      View Call
                    </Button>

                    {/* Secondary actions */}
                    {(canManage && !isClosed) || (serverRunning && !isClosed) ? (
                      <div className="flex flex-wrap gap-2">
                        {canManage && !isClosed && (
                          <Button
                            variant={call.status === 'claimed' ? 'danger' : 'discrete'}
                            size="small"
                            className="flex-1"
                            disabled={call?.status === 'claimed' && (!isMine && workspace.department.permissions.admin === false)}
                            onClick={() => handleCallAction(call, call.status === 'claimed' ? 'release' : 'claim')}
                          >
                            {call.status === 'claimed' ? 'Release' : 'Claim'}
                          </Button>
                        )}

                        {serverRunning && call?.gameInfo?.placeId && !isClosed && (
                          <Button
                            variant="discrete"
                            size="small"
                            onClick={() => joinGame(call)}
                            className="flex-1"
                          >
                            <PlayIcon className="h-4 w-4 mr-1" />
                            Join Game
                          </Button>
                        )}

                        {canViewGames && serverRunning && call?.placeId && call?.runningGameId && (
                          <Link
                            href={`/workspaces/${groupId}/games/${call.placeId}/running/${call.runningGameId.toString()}/chats`}
                            className="flex-1"
                          >
                            <Button variant="discrete" size="small" className="w-full">
                              <MagnifyingGlassIcon className="h-4 w-4 mr-1" />
                              Game Chat
                            </Button>
                          </Link>
                        )}
                      </div>
                    ) : null}

                    {/* Destructive actions */}
                    {(canClose || canManage) && (
                      <div className="flex flex-wrap gap-2">
                        {canClose && (
                          <Button
                            variant="light_danger"
                            size="small"
                            onClick={() => setClosingCall(call)}
                            className="flex-1"
                          >
                            Close Call
                          </Button>
                        )}

                        {canManage && (
                          <Button
                            variant="light_danger"
                            size="small"
                            onClick={() => { setBanningCall(call); setBanReason(''); }}
                            className="flex-1"
                          >
                            <NoSymbolIcon className="h-4 w-4 mr-1" />
                            Ban from Calls
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          ))}
        </div>
      )}

      {/* Chat Drawer */}
      <ChatDrawer
        open={chatDrawerOpen}
        setOpen={setChatDrawerOpen}
        call={selectedCall}
        groupId={groupId}
      />

      {/* Close Call Modal */}
      <Modal
        open={closingCall !== false}
        setOpen={() => setClosingCall(false)}
      >
        {closingCall !== false && (
          <>
            <PageHeading title={`Close call with ${closingCall?.callerInfo?.name}?`} disableDivide={false} />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This action will close the support call and mark it as resolved. The user will be notified.
            </p>
            <div className="flex flex-row gap-2">
              <Button className='w-full' variant="blue" onClick={() => setClosingCall(false)}>
                Cancel
              </Button>
              <Button className='w-full' variant="light_danger" onClick={() => {
                if (closingCall) {
                  toast.promise(
                    closeCallMutation.mutateAsync({
                      groupId,
                      callId: closingCall._id.toString(),
                      reason: 'closedByUser'
                    }),
                    {
                      loading: 'Closing call',
                      success: 'Call closed',
                      error: 'Failed to close call'
                    }
                  );
                  setClosingCall(false);
                  context.workspaces.workspace.calls.getAllTickets.invalidate({ groupId });
                }
              }}>
                Close Call
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Ban User Modal */}
      <Modal
        open={banningCall !== false}
        setOpen={() => { setBanningCall(false); setBanReason(''); }}
      >
        {banningCall !== false && (
          <>
            <PageHeading title={`Ban ${banningCall?.callerInfo?.name} from calls?`} disableDivide={false} />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This user will no longer be able to create support calls or reports in this workspace. This ban is linked to the current call so you can review what was said.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                placeholder="Explain why this user is being banned from calls..."
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
              />
            </div>
            <div className="flex flex-row gap-2">
              <Button className='w-full' variant="blue" onClick={() => { setBanningCall(false); setBanReason(''); }}>
                Cancel
              </Button>
              <Button
                className='w-full'
                variant="light_danger"
                disabled={!banReason.trim() || banUserMutation.isPending}
                onClick={submitBan}
              >
                Ban from Calls
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceLayout>{page}</WorkspaceLayout>
);
