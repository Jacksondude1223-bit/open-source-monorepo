/* eslint-disable @next/next/no-img-element */
import ReactTimeago from 'react-timeago';
import {
  BellAlertIcon,
  ArrowRightStartOnRectangleIcon,
  NoSymbolIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { PropsWithChildren, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import NotifyPlayerModal from './modals/Notify';
import KickPlayerModal from './modals/Kick';
import BanPlayerModal from './modals/Ban';
import { useWorkspace } from '~/components/contexts/workspace';
import OwnerStarBadge, { useIsWorkspaceOwner } from '~/components/ui/OwnerStarBadge';
import { trpc } from '~/utils/trpc';
import { RunningGamePlayers } from '~/services/NewMongoTypes';
import { openCallDrawer } from '~/components/ui/callDrawerBus';

export default function PlayerCard({
  groupId,
  gameId,
  serverId,
  player,
}: PropsWithChildren<{
  groupId: string;
  gameId: string;
  serverId: string;
  player: RunningGamePlayers;
}>) {
  const { data: userInfo } = trpc.roblox.getRobloxUserProcesedQuery.useQuery({
    userId: player.userId,
  });
  const router = useRouter();
  const [notifyModal, setNotifyModal] = useState(false);
  const [kickModal, setKickModal] = useState(false);
  const [banModal, setBanModal] = useState(false);
  const workspace = useWorkspace();
  const isOwner = useIsWorkspaceOwner(player.userId);

  const startCall = trpc.workspaces.workspace.calls.startCall.useMutation({
    onSuccess: ({ callId }) => {
      toast.success('Chat started');
      openCallDrawer(callId);
    },
    onError: (e) => {
      toast.error(e.message || 'Could not start chat');
    },
  });

  if (!userInfo) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 w-20 rounded bg-gray-100 dark:bg-gray-700/60" />
        </div>
      </div>
    );
  }

  const canModerate = workspace.department.permissions.games.admin;
  const canChat =
    workspace.department.permissions.admin ||
    workspace.department.permissions.calls?.manage;

  const ActionButton = ({
    icon: Icon,
    label,
    onClick,
    tone,
  }: {
    icon: any;
    label: string;
    onClick: () => void;
    tone: 'neutral' | 'blue' | 'warning' | 'danger';
  }) => {
    const tones: Record<string, string> = {
      neutral:
        'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
      blue: 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30',
      warning:
        'text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/30',
      danger:
        'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30',
    };
    return (
      <button
        type="button"
        title={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${tones[tone]}`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  };

  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <img
            src={
              userInfo?.thumbnail ||
              'https://cdn.readmin.app/readmin-public/backon-hair.png'
            }
            alt={userInfo?.name || ''}
            className={`h-12 w-12 rounded-full bg-gray-100 object-cover ring-2 dark:bg-gray-700 ${
              player.isStaff ? 'ring-blue-500' : 'ring-transparent'
            }`}
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-800" />
          {isOwner && <OwnerStarBadge size={16} position="top-right" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
              {userInfo?.name || 'Unknown'}
            </p>
            {player.isStaff && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Staff
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Joined <ReactTimeago date={player.joined} />
          </p>
        </div>
      </div>

      {(canModerate || canChat) && (
        <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2 dark:border-gray-700 sm:border-0 sm:pt-0">
          <ActionButton
            icon={ArrowTopRightOnSquareIcon}
            label="View"
            tone="neutral"
            onClick={() =>
              router.push(`/workspaces/${groupId}/users/${player.userId}`)
            }
          />
          {canChat && (
            <ActionButton
              icon={ChatBubbleLeftRightIcon}
              label={startCall.isPending ? 'Starting…' : 'Chat'}
              tone="blue"
              onClick={() => {
                if (startCall.isPending) return;
                startCall.mutate({ groupId, userId: player.userId.toString() });
              }}
            />
          )}
          {canModerate && (
            <>
              <ActionButton
                icon={BellAlertIcon}
                label="Notify"
                tone="blue"
                onClick={() => setNotifyModal(true)}
              />
              <ActionButton
                icon={ArrowRightStartOnRectangleIcon}
                label="Kick"
                tone="warning"
                onClick={() => setKickModal(true)}
              />
              <ActionButton
                icon={NoSymbolIcon}
                label="Ban"
                tone="danger"
                onClick={() => setBanModal(true)}
              />
            </>
          )}
        </div>
      )}

      <NotifyPlayerModal
        groupId={groupId}
        gameId={gameId}
        serverId={serverId}
        player={player}
        userInfo={userInfo}
        open={notifyModal}
        setOpen={setNotifyModal}
      />
      <KickPlayerModal
        groupId={groupId}
        gameId={gameId}
        serverId={serverId}
        player={player}
        userInfo={userInfo}
        open={kickModal}
        setOpen={setKickModal}
      />
      <BanPlayerModal
        groupId={groupId}
        gameId={gameId}
        serverId={serverId}
        player={player}
        userInfo={userInfo}
        open={banModal}
        setOpen={setBanModal}
      />
    </div>
  );
}
