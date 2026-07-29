'use client';

import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import PlayerCard from '~/components/page_components/workspaces/games/game/running/players/PlayerCard';
import WorkspaceGamesRunningSidebarNavigationLayout from '~/components/page_components/workspaces/games/game/running/WorkspaceGamesRunningSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function WorkspacePage() {
  const router = useRouter();
  const {
    groupId,
    gameId,
    serverId,
  }: { groupId: string; gameId: string; serverId: string } =
    router.query as any;
  const workspace = useWorkspace();

  if (!workspace.department.permissions.games.view) {
    router.push(`/workspaces/${groupId}/games`)
    return (<></>)
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
    }, {
      refetchInterval: 10000
    });

  if (!game || !server) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        backUrl={`/workspaces/${groupId}/games/${gameId}`}
        title={`${workspace?.groupName} ${game?.placeInfo?.name || game.name} Game`}
        disableDivide={true}
      />

      {server.players.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            No players in this server
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Players will appear here as soon as they join.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {server.players.length.toLocaleString()}
            </span>
            player{server.players.length !== 1 && 's'} online
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {server.players
              .sort((a, b) => {
                return a.isStaff && !b.isStaff ? -1 : 0;
              })
              .map((player) => (
                <PlayerCard
                  key={player._id.toString()}
                  groupId={groupId}
                  gameId={gameId}
                  serverId={serverId}
                  player={player}
                />
              ))}
          </div>
        </>
      )}
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceGamesRunningSidebarNavigationLayout>{page}</WorkspaceGamesRunningSidebarNavigationLayout>
);
