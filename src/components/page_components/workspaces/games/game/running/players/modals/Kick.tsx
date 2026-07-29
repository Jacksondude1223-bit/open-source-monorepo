import { PropsWithChildren } from 'react';
import Modal from '~/components/ui/Modal';
import PageHeading from '~/components/layouts/PageHeading';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import { getProcessedUserObjectType } from '~/services/roblox.service';
import { RunningGamePlayers } from '~/services/NewMongoTypes';

export default function KickPlayerModal({
  open,
  setOpen,
  groupId,
  gameId,
  serverId,
  player,
  userInfo,
}: PropsWithChildren<{
  groupId: string;
  gameId: string;
  serverId: string;
  player: RunningGamePlayers;
  open: boolean;
  setOpen: any;
  userInfo: getProcessedUserObjectType;
}>) {
  const createGameAction =
    trpc.workspaces.workspace.games.game.running.createGameAction.useMutation();

  return (
    <Modal open={open} setOpen={setOpen}>
      <PageHeading title={`Kick ${userInfo.name}`} />

      <form
        className="flex flex-col gap-2"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const {
            reason: { value: reason },
          } = target;

          const action = new Promise<void>((resolve, reject) => {
            createGameAction
              .mutateAsync({
                groupId,
                userId: player.userId,
                type: 'kick',
                message: reason,
                gameId,
                serverId,
              })
              .then(() => {
                resolve();
              })
              .catch((e) => {
                reject();
              });
          });

          toast.promise(action, {
            loading: 'Kicking user',
            success: 'Successfully kicked user',
            error: 'Failed to kick user',
          });
        }}
      >
        <TextLabel required={true} id="reason" label="Reason" />
        <Button className="mt-1" variant="danger" size="medium">
          Kick User
        </Button>
      </form>
    </Modal>
  );
}
