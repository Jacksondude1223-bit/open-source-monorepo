/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceGamesNormalSidebarNavigationLayout from '~/components/page_components/workspaces/games/game/normal/WorkspaceGamesNormalSidebarNavigationLayout';
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

  const { data: game } =
    trpc.workspaces.workspace.games.game.getGameInfo.useQuery({
      groupId,
      gameId,
    });
  const { data: runningGames } =
    trpc.workspaces.workspace.games.game.getRunningGames.useQuery({
      groupId,
      gameId,
    });
  const updateSettings = trpc.workspaces.workspace.games.game.updateGameSettings.useMutation();
  const deleteGame = trpc.workspaces.workspace.games.game.deleteGame.useMutation();

  if (!game) {
    return <LoadingPage />;
  }

  const canManage = workspace.department.permissions.games.admin;
  const activeServers = runningGames?.length ?? 0;
  const lastSeen = game.lastSeen ? new Date(game.lastSeen) : null;
  const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const ranRecently = lastSeen ? lastSeen > thirtyDaysAgo : false;
  const deletable = activeServers === 0 && !ranRecently;

  let blockedReason = '';
  if (activeServers > 0) {
    blockedReason =
      'This game still has active servers. Wait until they shut down before removing it.';
  } else if (ranRecently) {
    blockedReason =
      'This game has run within the last 30 days. It can be removed once it has been inactive for 30 days.';
  }

  const handleDelete = () => {
    if (
      !confirm(
        'Remove this game from your dashboards? Its tracking data will be kept, but it will no longer be shown in your games list. This can be undone by support.',
      )
    ) {
      return;
    }
    deleteGame
      .mutateAsync({ groupId, gameId })
      .then(() => {
        toast.success('Game removed from dashboards');
        router.push(`/workspaces/${groupId}/games`);
      })
      .catch((e) => {
        toast.error(e.message);
      });
  };

  return (
    <>
      <PageHeading
        backUrl={`/workspaces/${groupId}/games/${gameId}`}
        title={`${workspace?.groupName} ${game?.placeInfo?.name || game.name} Game Settings`}
        disableDivide={true}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
          Dashboard visibility
        </h2>
        <p className="mb-4 mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Control how this game appears for members of your workspace.
        </p>
        <form className='flex flex-col gap-4' onSubmit={(f) => {
          f.preventDefault();
          const target = f.target as any;
          const viewable = target.viewable.checked;
          updateSettings.mutateAsync({
            groupId,
            gameId,
            viewable
          }).then(() => {
            toast.success('Settings updated successfully')
          }).catch(e => {
            toast.error(e.message)
          })

        }}>
          <Toggle id="viewable" title="Make viewable on workspace dashboard" description="Adds a quick link to join this game to users dashboards." value={game?.viewable} />

          <Button type="submit" variant="primary">Save Settings</Button>
        </form>
      </div>

      {canManage && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-900/50 dark:bg-gray-800/60">
          <h2 className="font-semibold text-red-600 dark:text-red-400">
            Remove game
          </h2>
          <p className="mb-4 mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Hide this game from your dashboards and games list. None of its
            tracking data is deleted. A game can only be removed when it has no
            active servers or players and hasn&apos;t run in the last 30 days.
          </p>
          {!deletable && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {blockedReason}
            </p>
          )}
          <Button
            type="button"
            variant="danger"
            disabled={!deletable || deleteGame.isPending}
            onClick={handleDelete}
          >
            {deleteGame.isPending ? 'Removing…' : 'Remove game'}
          </Button>
        </div>
      )}

    </>
  );
}


WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceGamesNormalSidebarNavigationLayout>{page}</WorkspaceGamesNormalSidebarNavigationLayout>
);
