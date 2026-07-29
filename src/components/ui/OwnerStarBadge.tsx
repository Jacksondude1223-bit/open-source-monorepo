import { StarIcon } from '@heroicons/react/20/solid';
import { useWorkspace } from '~/components/contexts/workspace';

/**
 * Returns true when the provided Roblox id matches the workspace's group owner.
 * Safe to call when the workspace context is not yet loaded.
 */
export function useIsWorkspaceOwner(robloxId?: string | number | null): boolean {
  const workspace = useWorkspace();
  if (robloxId == null || !workspace?.owner?.robloxId) return false;
  return String(workspace.owner.robloxId) === String(robloxId);
}

/**
 * A small star badge to overlay on a user's avatar indicating they own the
 * Roblox group. Render this inside a `relative` positioned wrapper alongside
 * the avatar image.
 */
export default function OwnerStarBadge({
  size = 16,
  position = 'bottom-right',
  className = '',
}: {
  size?: number;
  position?: 'bottom-right' | 'top-right';
  className?: string;
}) {
  const pos =
    position === 'top-right' ? '-top-0.5 -right-0.5' : '-bottom-0.5 -right-0.5';
  return (
    <span
      title="Roblox group owner"
      aria-label="Roblox group owner"
      className={`absolute ${pos} flex items-center justify-center rounded-full bg-amber-400 text-white shadow ring-2 ring-white dark:ring-gray-800 ${className}`}
      style={{ width: size, height: size }}
    >
      <StarIcon style={{ width: size * 0.7, height: size * 0.7 }} />
    </span>
  );
}
