'use client';

import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceGamesNormalSidebarNavigationLayout from '~/components/page_components/workspaces/games/game/normal/WorkspaceGamesNormalSidebarNavigationLayout';
import PlayerCard from '~/components/page_components/workspaces/games/game/running/players/PlayerCard';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, gameId }: { groupId: string; gameId: string } =
    router.query as any;
  const workspace = useWorkspace();

  if (!workspace.department.permissions.games.view) {
    router.push(`/workspaces/${groupId}/games`)
    return (<></>)
  }

  const { data: players } =
    trpc.workspaces.workspace.games.game.getPlayers.useQuery({
      groupId,
      gameId,
    });
  const { data: game } =
    trpc.workspaces.workspace.games.game.getGameInfo.useQuery({
      groupId,
      gameId,
    });

  if (!game || !players) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        backUrl={`/workspaces/${groupId}/games/${gameId}`}
        title={`${workspace?.groupName} ${game?.placeInfo?.name || game.name} Game`}
        disableDivide={true}
      />

      {players.length == 0 ? (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-lg font-bold">
            There are no players right now
          </p>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Get some players in your game!</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {players.length.toLocaleString()}
            </span>
            player{players.length !== 1 && 's'} across all servers
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {players
              .sort((a, b) => {
                return a.isStaff && !b.isStaff ? -1 : 0;
              })
              .map((player) => (
                <PlayerCard
                  key={player._id.toString()}
                  groupId={groupId}
                  gameId={gameId}
                  serverId={player.runningGameId?.toString() || ''}
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
  <WorkspaceGamesNormalSidebarNavigationLayout>{page}</WorkspaceGamesNormalSidebarNavigationLayout>
);
