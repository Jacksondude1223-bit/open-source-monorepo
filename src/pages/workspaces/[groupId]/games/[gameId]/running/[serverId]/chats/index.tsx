/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import ReactTimeago from 'react-timeago';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceGamesRunningSidebarNavigationLayout from '~/components/page_components/workspaces/games/game/running/WorkspaceGamesRunningSidebarNavigationLayout';
import ChatContextMenu, {
  ChatMenuTarget,
} from '~/components/page_components/workspaces/games/game/running/chats/ChatContextMenu';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

type ChatMessage = {
  _id: any;
  message: string;
  userId: string | number;
  date: Date | string;
  user: { name: string; thumbnail?: string };
};

const WINDOW_OPTIONS = [
  { label: 'Last hour', minutes: 60 },
  { label: 'Last 24 hours', minutes: 60 * 24 },
  { label: 'Last 7 days', minutes: 60 * 24 * 7 },
  { label: 'All time', minutes: 0 },
];

export default function WorkspacePage() {
  const router = useRouter();
  const {
    groupId,
    gameId,
    serverId,
  }: { groupId: string; gameId: string; serverId: string } =
    router.query as any;
  const workspace = useWorkspace();

  const permissions = workspace.department.permissions.games;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [menu, setMenu] = useState<{
    target: ChatMenuTarget;
    position: { x: number; y: number };
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const isSearching = debouncedSearch.trim() !== '' || windowMinutes !== 60;

  // Debounce the search box.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  if (!permissions.view) {
    router.push(`/workspaces/${groupId}/games`);
    return <></>;
  }

  const { data: game } =
    trpc.workspaces.workspace.games.game.getGameInfo.useQuery({
      groupId,
      gameId,
    });
  const { data: server } =
    trpc.workspaces.workspace.games.game.running.getRunningServer.useQuery({
      groupId,
      gameId,
      serverId,
    });

  // Initial recent history (also the live baseline).
  const { data: initialChats } =
    trpc.workspaces.workspace.games.game.running.getChats.useQuery(
      { groupId, gameId, serverId },
      { refetchOnWindowFocus: false },
    );

  // OpenSearch-backed search / time-window browse.
  const { data: searchResults, isFetching: searchFetching } =
    trpc.workspaces.workspace.games.game.running.searchChats.useQuery(
      { groupId, gameId, serverId, query: debouncedSearch, windowMinutes },
      { enabled: isSearching, refetchOnWindowFocus: false },
    );

  // Seed the live buffer from the initial history (oldest → newest).
  useEffect(() => {
    if (initialChats) {
      setLiveMessages([...(initialChats as ChatMessage[])].reverse());
    }
  }, [initialChats]);

  // Live tail via tRPC subscription (MongoDB change stream under the hood).
  trpc.workspaces.workspace.games.game.running.onNewChat.useSubscription(
    { groupId, gameId, serverId },
    {
      enabled: !isSearching,
      onData(chat: any) {
        setLiveMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(chat._id))) return prev;
          return [...prev, chat as ChatMessage];
        });
      },
    },
  );

  // Auto-scroll to newest in live mode when near the bottom.
  useEffect(() => {
    if (isSearching) return;
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [liveMessages, isSearching]);

  const displayed = useMemo(() => {
    const base: ChatMessage[] = isSearching
      ? (searchResults as ChatMessage[]) || []
      : liveMessages;
    if (!filterUserId) return base;
    return base.filter((m) => String(m.userId) === String(filterUserId));
  }, [isSearching, searchResults, liveMessages, filterUserId]);

  if (!server || !game) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        backUrl={`/workspaces/${groupId}/games/${gameId}/running/${serverId}`}
        title={`${workspace?.groupName} ${game?.placeInfo?.name || game.name} Game`}
        disableDivide={true}
      />

      <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-gray-100 p-3 dark:border-gray-700 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-gray-50 py-2 pl-3 pr-8 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.minutes} value={opt.minutes}>
                {opt.label}
              </option>
            ))}
          </select>

          {!isSearching ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <SignalIcon className="h-3.5 w-3.5 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {searchFetching ? 'Searching…' : 'History'}
            </span>
          )}
        </div>

        {/* Active user filter chip */}
        {filterUserId && (
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900/40">
            <span className="text-gray-500 dark:text-gray-400">
              Filtering to one user
            </span>
            <button
              type="button"
              onClick={() => setFilterUserId(null)}
              className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Clear <XMarkIcon className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          ref={listRef}
          className="flex max-h-[60vh] min-h-80 flex-col gap-1 overflow-y-auto p-3"
        >
          {displayed.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {isSearching ? 'No messages found' : "It's quiet in here!"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isSearching
                  ? 'Try a different search or a wider time window.'
                  : 'Messages will appear here live as they are sent.'}
              </p>
            </div>
          ) : (
            displayed.map((message) => (
              <div
                key={String(message._id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({
                    target: {
                      userId: String(message.userId),
                      name: message.user?.name || 'Unknown',
                      thumbnail: message.user?.thumbnail,
                      message: message.message,
                    },
                    position: { x: e.clientX, y: e.clientY },
                  });
                }}
                className="group flex items-start gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <img
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700"
                  src={
                    message.user?.thumbnail ||
                    'https://cdn.readmin.app/readmin-public/backon-hair.png'
                  }
                  alt={message.user?.name || 'User'}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {message.user?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">
                      <ReactTimeago date={message.date} />
                    </span>
                  </div>
                  <p className="wrap-break-word text-sm text-gray-700 dark:text-gray-300">
                    {message.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-gray-400">
        Right-click a message for actions.
      </p>

      {menu && (
        <ChatContextMenu
          groupId={groupId}
          gameId={gameId}
          serverId={serverId}
          target={menu.target}
          position={menu.position}
          onClose={() => setMenu(null)}
          onFilterUser={(userId) => setFilterUserId(userId)}
          canAdmin={permissions.admin}
          canBan={permissions.manageBans}
        />
      )}
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceGamesRunningSidebarNavigationLayout>{page}</WorkspaceGamesRunningSidebarNavigationLayout>
);
