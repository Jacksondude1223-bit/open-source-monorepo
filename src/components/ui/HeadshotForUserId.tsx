/* eslint-disable @next/next/no-img-element */
import { trpc } from '~/utils/trpc';
import OwnerStarBadge, { useIsWorkspaceOwner } from '~/components/ui/OwnerStarBadge';

const FALLBACK = 'https://cdn.readmin.app/readmin-public/backon-hair.png';

export default function HeadshotForUserId({ userId, size = 36 }: { userId: string; size?: number }) {
  const { data: user } = trpc.roblox.getRobloxUserProcesedQuery.useQuery(
    { userId: userId || '0' },
    { enabled: !!userId && userId !== '0', staleTime: 5 * 60 * 1000 },
  );
  const isOwner = useIsWorkspaceOwner(userId);

  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <img
        src={user?.thumbnail || FALLBACK}
        alt={user?.name || 'User'}
        style={{ width: size, height: size }}
        className="rounded-full object-cover bg-gray-200 dark:bg-gray-700"
      />
      {isOwner && <OwnerStarBadge size={Math.max(12, Math.round(size * 0.4))} />}
    </span>
  );
}
