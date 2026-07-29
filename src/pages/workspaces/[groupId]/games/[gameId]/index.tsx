/* eslint-disable @next/next/no-img-element */
import { UserIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PropsWithChildren, useState, ReactElement } from 'react';
import ReactTimeago from 'react-timeago';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceGamesNormalSidebarNavigationLayout from '~/components/page_components/workspaces/games/game/normal/WorkspaceGamesNormalSidebarNavigationLayout';
import { ExtendedRunningGames } from '~/server/routers/workspaces/workspace/games/game';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { RunningGamePlayers } from '~/services/NewMongoTypes';
import { ArrayToValueType, RouterOutput } from '~/server/routers/_app';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, gameId }: { groupId: string; gameId: string } =
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
  const { data: running } =
    trpc.workspaces.workspace.games.game.getRunningGames.useQuery({
      groupId,
      gameId,
    }, {
      refetchInterval: 10000
    });
  if (!game || !running) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        backUrl={`/workspaces/${groupId}/games`}
        title={`${workspace?.groupName} ${game?.placeInfo?.name || game.name} Game`}
        disableDivide={true}
      />

      {running.length == 0 && (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            No running servers
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get some players in your game to see active servers here.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {running.map((game, i) => (
          <GameData
            key={game?._id ? game._id.toString() : ''}
            game={game}
            groupId={groupId}
            gameId={gameId}
            i={i}
          />
        ))}
      </div>
    </>
  );
}

function GamePlayer({
  player
}: {
  player: ArrayToValueType<RouterOutput["workspaces"]["workspace"]["games"]["game"]["running"]["getPlayers"]>
}) {

  if (!player.user) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500">
        <UserIcon className="h-7 w-7 text-gray-100" />
      </div>
    )
  }

  return (
    <PlayerIcon player={{
      ...player,
      ...player.user
    }} />
  )
}

function GameData({
  game,
  groupId,
  gameId,
  i,
}: PropsWithChildren<{
  game: ExtendedRunningGames;
  groupId: string;
  gameId: string;
  i: number;
}>) {
  const { data: players } =
    trpc.workspaces.workspace.games.game.running.getPlayers.useQuery({
      groupId,
      gameId,
      serverId: game._id.toString(),
    });

  return (
    <Link
      key={game._id.toString()}
      href={`/workspaces/${groupId}/games/${game.placeId}/running/${game._id}`}
      className="group block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60"
    >
      <div className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            #{i + 1}
          </span>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              Server #{i + 1}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {game.staff.length} staff · {game.players.length} player
              {game.players.length !== 1 && 's'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {game.privateServerId !== '' &&
            game.privateServerId !== undefined && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                Personal Server
              </span>
            )}
          <p className="text-xs text-gray-400">
            Started <ReactTimeago date={game.created} />
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-row flex-wrap gap-1.5">
        {players !== undefined ? (
          <>
            {players
              .sort((a, b) => {
                return a.isStaff && !b.isStaff ? -1 : 0;
              })
              .map((player) => (
                <GamePlayer key={player.userId} player={player} />
              ))}
          </>
        ) : (
          <>
            {Array(game.players.length)
              .fill('a')
              .map((a, idx) => (
                <div
                  key={`${a}-${idx}`}
                  className="h-11 w-11 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
                />
              ))}
          </>
        )}
      </div>

      {!(
        game.privateServerId !== '' && game.privateServerId !== undefined
      ) && (
        <>
          {game.jobId !== '' && (
            <button
              onClick={(a) => {
                a.preventDefault();
                window.open(
                  `https://www.roblox.com/games/start?placeId=${game.placeId}&launchData=ReAdmin-${game.jobId}`,
                  '__blank',
                );
              }}
              className="mt-3 w-full rounded-lg bg-blue-100 py-2 px-3 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            >
              Join Server
            </button>
          )}
        </>
      )}
    </Link>
  );
}

function PlayerIcon({ player }: { player: any }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div key={player.userId} className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500">
        <UserIcon className="h-7 w-7 text-gray-100" />
      </div>
    );
  }
  return (
    <img
      key={player.userId}
      src={player.user.thumbnail || 'https://cdn.readmin.app/readmin-public/backon-hair.png'}
      alt={player.user.name}
      title={player.user.name}
      onError={() => {
        setError(true);
      }}
      className={`h-11 w-11 rounded-full object-cover ring-2 ${player.isStaff ? 'bg-blue-500 ring-blue-500' : 'bg-blue-200 ring-transparent'}`}
    />
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceGamesNormalSidebarNavigationLayout>{page}</WorkspaceGamesNormalSidebarNavigationLayout>
);
