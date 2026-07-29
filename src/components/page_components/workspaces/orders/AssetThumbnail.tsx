import { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid';
import { trpc } from '~/utils/trpc';
import Spinner from '~/components/ui/Spinner';

/**
 * A debounced live thumbnail + validity preview for a Roblox image asset id.
 * Renders the asset thumbnail when the backend reports state "Completed"; any
 * other state surfaces as invalid. Doubles as inline validation of the id.
 */
export default function AssetThumbnail({
  groupId,
  assetId,
  enabled = true,
  size = 16,
  debounceMs = 400,
}: {
  groupId: string;
  assetId: string;
  enabled?: boolean;
  size?: number;
  debounceMs?: number;
}) {
  const [debounced, setDebounced] = useState(assetId);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(assetId.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [assetId, debounceMs]);

  const { data, isFetching } = trpc.workspaces.workspace.orders.products.getAssetThumbnail.useQuery(
    { groupId, assetId: debounced },
    { enabled: enabled && !!debounced, staleTime: 5 * 60 * 1000 },
  );

  const dim = `${size * 0.25}rem`;
  const valid = data?.state === 'Completed' && !!data.imageUrl;

  if (!debounced) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400 dark:border-gray-600"
        style={{ width: dim, height: dim }}
      >
        No image
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700"
        style={{ width: dim, height: dim }}
      >
        {isFetching ? (
          <Spinner size={5} />
        ) : valid ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data!.imageUrl} alt="asset preview" className="h-full w-full object-cover" />
        ) : (
          <ExclamationCircleIcon className="h-6 w-6 text-red-400" />
        )}
      </div>
      {!isFetching && (
        <span className={`flex items-center gap-1 text-xs ${valid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {valid ? <CheckCircleIcon className="h-4 w-4" /> : <ExclamationCircleIcon className="h-4 w-4" />}
          {valid ? 'Valid' : 'Invalid asset'}
        </span>
      )}
    </div>
  );
}
