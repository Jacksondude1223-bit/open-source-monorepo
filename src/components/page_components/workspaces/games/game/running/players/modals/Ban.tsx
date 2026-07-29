import { PropsWithChildren } from 'react';
import Modal from '~/components/ui/Modal';
import PageHeading from '~/components/layouts/PageHeading';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import DatePicker from '~/components/ui/DatePicker';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import { getProcessedUserObjectType } from '~/services/roblox.service';
import { RunningGamePlayers } from '~/services/NewMongoTypes';

export default function BanPlayerModal({
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
  const createBan =
    trpc.workspaces.workspace.games.bans.createBan.useMutation();

  return (
    <Modal open={open} setOpen={setOpen}>
      <PageHeading title={`Ban ${userInfo.name}`} />

      <form
        className="flex flex-col gap-2"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const {
            reason: { value: reason },
            expires: { value: expires },
          } = target;

          const action = new Promise<void>((resolve, reject) => {
            createBan
              .mutateAsync({
                groupId,
                userId: player.userId,
                reason,
                ...(expires !== '' ? { expires: new Date(expires) } : {}),
              })
              .then(() => {
                createGameAction
                  .mutateAsync({
                    groupId,
                    userId: player.userId,
                    type: 'kick',
                    message: `You were banned for ${reason}`,
                    gameId,
                    serverId,
                  })
                  .then(() => {
                    resolve();
                  })
                  .catch((e) => {
                    reject(e);
                  });
              }).catch((e) => {
                reject(e);
              });
          });

          toast.promise(action, {
            loading: 'Banning user',
            success: 'Successfully banned user',
            error: 'Failed to ban user',
          });

        }}
      >
        <TextLabel required={true} id="reason" label="Reason" />
        <DatePicker label="Expiry date" id="expires" />
        <p className="-mt-1 text-sm font-medium text-gray-500">
          Leave blank to permently ban user.
        </p>
        <Button className="mt-1" variant="danger" size="medium">
          Ban User
        </Button>
      </form>
    </Modal>
  );
}
