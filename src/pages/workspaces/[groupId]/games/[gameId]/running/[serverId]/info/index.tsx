'use client';

import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import ReactTimeago from 'react-timeago';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
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
    });

  if (!game || !server) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        backUrl={`/workspaces/${groupId}/games/${gameId}/running/${serverId}`}
        title={`${workspace?.groupName} ${game?.placeInfo?.name || game.name} Game`}
        disableDivide={true}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Players
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {server.players.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Last pinged
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <ReactTimeago date={server.server.lastPing} />
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Started
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <ReactTimeago date={server.server.created} />
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Job ID
          </p>
          <p className="mt-1 truncate font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
            {server.server.jobId}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Internal identifiers
        </p>
        <dl className="mt-2 flex flex-col gap-2 text-sm">
          <div className="flex flex-row justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">ReAdmin ID</dt>
            <dd className="truncate font-mono font-semibold text-gray-900 dark:text-gray-100">
              {server.server.internalGameId}
            </dd>
          </div>
          <div className="flex flex-row justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">Next Gen ID</dt>
            <dd className="truncate font-mono font-semibold text-gray-900 dark:text-gray-100">
              {server.server._id.toString()}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceGamesRunningSidebarNavigationLayout>{page}</WorkspaceGamesRunningSidebarNavigationLayout>
);
