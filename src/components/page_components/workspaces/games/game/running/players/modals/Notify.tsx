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
      <PageHeading title={`Notify ${userInfo.name}`} />

      <form
        className="flex flex-col gap-2"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const {
            message: { value: message },
          } = target;

          const action = new Promise<void>((resolve, reject) => {

            createGameAction
              .mutateAsync({
                groupId,
                userId: player.userId,
                type: 'notify',
                message,
                gameId,
                serverId,
              })
              .then(() => {
                resolve();
              })
              .catch((e) => {
                reject(e);
              });
          });

          toast.promise(action, {
            loading: 'Please wait while we notify user',
            success: 'Successfully notified user',
            error: 'Failed to notify user',
          })
        }}
      >
        <TextLabel required={true} id="message" label="Message to user" />
        <Button className="mt-1" variant="primary" size="medium">
          Notify User
        </Button>
      </form>
    </Modal>
  );
}
