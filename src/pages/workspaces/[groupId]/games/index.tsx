/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, PuzzlePieceIcon } from '@heroicons/react/24/outline';
import { trpc } from '~/utils/trpc';
import { useRouter } from 'next/router';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceGamesSidebarNavigationLayout from '~/components/page_components/workspaces/games/WorkspaceGamesSidebarNavigationLayout';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const { data: games } = trpc.workspaces.workspace.games.getGames.useQuery({
    groupId,
  });
  if ('loading' in user || user.loggedIn == false || !workspace || !games) {
    return (
      <div>
        <PageHeading title={`${workspace?.groupName} Games`} disableDivide={true} />
        <LoadingPage />
      </div>
    );
  }

  if (!workspace.department.permissions.games.view) {
    return (
      <div>
        <PageHeading title={`${workspace?.groupName} Games`} disableDivide={true} />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            You do not have permission to view games
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Contact your group administrator if you believe this is incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeading title={`${workspace?.groupName} Games`} disableDivide={true} />

      {games.length == 0 && (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            No games tracked yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            Set up the remote-admin module in your game to begin tracking data.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 mt-4">
        {games.map((game) => {
          const displayName =
            game?.placeInfo?.name || game.name || `Game ${game.placeId}`;
          const hasName = Boolean(game?.placeInfo?.name || game.name);
          const isSyncing = !hasName && !game.images?.icon;

          return (
            <Link
              href={`/workspaces/${workspace.groupId}/games/${game.placeId}`}
              key={game.gameId}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800/60"
            >
              {/* Banner */}
              <div className="relative aspect-16/9 w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                {game.images?.thumbnail ? (
                  <img
                    src={game.images.thumbnail}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    alt={`${displayName} banner`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500/20 to-purple-500/20" />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/0 to-transparent" />
                {isSyncing && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                    Syncing
                  </span>
                )}
                <div className="absolute -bottom-6 left-4">
                  {game.images?.icon ? (
                    <img
                      src={game.images.icon}
                      className="h-16 w-16 rounded-2xl border-4 border-white object-cover shadow-md dark:border-gray-800"
                      alt={`${displayName} icon`}
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gray-200 shadow-md dark:border-gray-800 dark:bg-gray-700">
                      <PuzzlePieceIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col px-4 pb-4 pt-8">
                <h3
                  className={`truncate text-base font-semibold transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 ${
                    hasName
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400 italic dark:text-gray-500'
                  }`}
                >
                  {displayName}
                </h3>
                {game?.placeInfo?.builder && (
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    by {game.placeInfo.builder}
                  </p>
                )}
                {game?.placeInfo?.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                    {game.placeInfo.description}
                  </p>
                ) : (
                  isSyncing && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-400 dark:text-gray-500">
                      We&apos;re still fetching this game&apos;s details from
                      Roblox.
                    </p>
                  )
                )}
                <div className="mt-auto flex items-center gap-1.5 pt-3 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <span>View game</span>
                  <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceGamesSidebarNavigationLayout>{page}</WorkspaceGamesSidebarNavigationLayout>
);
