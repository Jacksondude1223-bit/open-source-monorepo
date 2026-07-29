/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  FunnelIcon,
  NoSymbolIcon,
  BellAlertIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from '~/components/ui/Modal';
import PageHeading from '~/components/layouts/PageHeading';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import DatePicker from '~/components/ui/DatePicker';
import { trpc } from '~/utils/trpc';

export interface ChatMenuTarget {
  userId: string;
  name: string;
  thumbnail?: string;
  message: string;
}

type ActiveModal = null | 'ban' | 'kick' | 'notify';

/**
 * Right-click context menu for a chat message. Renders a floating menu at the
 * cursor and, for the moderation actions, a small reason-capture modal. All
 * destructive actions are gated on the caller-provided permission flags.
 */
export default function ChatContextMenu({
  groupId,
  gameId,
  serverId,
  target,
  position,
  onClose,
  onFilterUser,
  canAdmin,
  canBan,
}: {
  groupId: string;
  gameId: string;
  serverId: string;
  target: ChatMenuTarget;
  position: { x: number; y: number };
  onClose: () => void;
  onFilterUser: (userId: string) => void;
  canAdmin: boolean;
  canBan: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const createGameAction =
    trpc.workspaces.workspace.games.game.running.createGameAction.useMutation();
  const createBan = trpc.workspaces.workspace.games.bans.createBan.useMutation();

  // Close on outside click / escape while a modal isn't capturing input.
  useEffect(() => {
    if (activeModal) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [activeModal, onClose]);

  // Keep the menu inside the viewport.
  const [coords, setCoords] = useState(position);
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
    setCoords({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [position]);

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    danger,
  }: {
    icon: any;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/60'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <>
      {!activeModal && (
        <div
          ref={menuRef}
          style={{ top: coords.y, left: coords.x }}
          className="fixed z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
            <img
              src={target.thumbnail || 'https://cdn.readmin.app/readmin-public/backon-hair.png'}
              alt={target.name}
              className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-700"
            />
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {target.name}
            </span>
          </div>

          <MenuItem
            icon={ClipboardDocumentIcon}
            label="Copy message"
            onClick={() => {
              navigator.clipboard
                .writeText(target.message)
                .then(() => toast.success('Message copied'))
                .catch(() => toast.error('Could not copy'));
              onClose();
            }}
          />
          <MenuItem
            icon={FunnelIcon}
            label="Filter chat to this user"
            onClick={() => {
              onFilterUser(target.userId);
              onClose();
            }}
          />
          <MenuItem
            icon={ArrowTopRightOnSquareIcon}
            label="View Roblox profile"
            onClick={() => {
              window.open(
                `https://www.roblox.com/users/${target.userId}/profile`,
                '_blank',
                'noopener,noreferrer',
              );
              onClose();
            }}
          />

          {canAdmin && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              <MenuItem
                icon={BellAlertIcon}
                label="Notify user"
                onClick={() => setActiveModal('notify')}
              />
              <MenuItem
                icon={ArrowRightStartOnRectangleIcon}
                label="Kick user"
                danger
                onClick={() => setActiveModal('kick')}
              />
            </>
          )}
          {canBan && (
            <MenuItem
              icon={NoSymbolIcon}
              label="Ban user"
              danger
              onClick={() => setActiveModal('ban')}
            />
          )}
        </div>
      )}

      {/* Notify */}
      <Modal open={activeModal === 'notify'} setOpen={() => onClose()}>
        <PageHeading title={`Notify ${target.name}`} />
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const message = (e.target as any).message.value as string;
            if (!message) return;
            toast.promise(
              createGameAction.mutateAsync({
                groupId,
                gameId,
                serverId,
                userId: target.userId,
                type: 'notify',
                message,
              }),
              {
                loading: 'Sending notification',
                success: 'Notification sent',
                error: 'Failed to notify user',
              },
            );
            onClose();
          }}
        >
          <TextLabel required id="message" label="Message" />
          <Button className="mt-1" variant="primary" size="medium">
            Send Notification
          </Button>
        </form>
      </Modal>

      {/* Kick */}
      <Modal open={activeModal === 'kick'} setOpen={() => onClose()}>
        <PageHeading title={`Kick ${target.name}`} />
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const message = (e.target as any).message.value as string;
            if (!message) return;
            toast.promise(
              createGameAction.mutateAsync({
                groupId,
                gameId,
                serverId,
                userId: target.userId,
                type: 'kick',
                message,
              }),
              {
                loading: 'Kicking user',
                success: 'User kicked',
                error: 'Failed to kick user',
              },
            );
            onClose();
          }}
        >
          <TextLabel required id="message" label="Reason" />
          <Button className="mt-1" variant="danger" size="medium">
            Kick User
          </Button>
        </form>
      </Modal>

      {/* Ban */}
      <Modal open={activeModal === 'ban'} setOpen={() => onClose()}>
        <PageHeading title={`Ban ${target.name}`} />
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = e.target as any;
            const reason = t.reason.value as string;
            const expires = t.expires.value as string;
            if (!reason) return;
            const action = createBan
              .mutateAsync({
                groupId,
                userId: target.userId,
                reason,
                ...(expires !== '' ? { expires: new Date(expires) } : {}),
              })
              .then(() =>
                createGameAction
                  .mutateAsync({
                    groupId,
                    gameId,
                    serverId,
                    userId: target.userId,
                    type: 'kick',
                    message: `You were banned for ${reason}`,
                  })
                  .catch(() => {
                    // The ban is recorded even if the live kick fails (user may
                    // have already left the server) — don't surface as an error.
                  }),
              );
            toast.promise(action, {
              loading: 'Banning user',
              success: 'User banned',
              error: 'Failed to ban user',
            });
            onClose();
          }}
        >
          <TextLabel required id="reason" label="Reason" />
          <DatePicker label="Expiry date" id="expires" />
          <p className="-mt-1 text-sm font-medium text-gray-500">
            Leave blank to permanently ban user.
          </p>
          <Button className="mt-1" variant="danger" size="medium">
            Ban User
          </Button>
        </form>
      </Modal>
    </>
  );
}
