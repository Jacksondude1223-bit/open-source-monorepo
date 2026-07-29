/* eslint-disable @next/next/no-img-element */
import { Skeleton } from "@mui/material";
import { trpc } from "~/utils/trpc";

export default function TextReturnForUserId({
  userId,
  includeImage = false,
  prefix = '',
  showSkeleton = true
}: {
  userId: string;
  includeImage?: boolean;
  prefix?: string;
  showSkeleton?: boolean;
}) {
  const { data: processedUser, isPending: isLoadingProcessedUser } = trpc.roblox.getRobloxUserProcesedQuery.useQuery({
    userId: userId || '0',
  }, {
    enabled: !!userId && userId !== '0',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoadingProcessedUser) {
    if (!includeImage) {
      return showSkeleton ? <Skeleton width={80} height={20} variant="text" /> : '...';
    }
    return showSkeleton ? (
      <div className="flex flex-row gap-2 items-center">
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton width={100} height={20} variant="text" />
      </div>
    ) : <></>;
  }

  if (!includeImage) {
    return `${prefix}${processedUser?.name || 'Unknown User'}`;
  }

  return (
    <div className="flex flex-row gap-2 items-center">
      <img
        src={processedUser?.thumbnail || 'https://cdn.readmin.app/readmin-public/backon-hair.png'}
        alt={`${processedUser?.name || 'Unknown User'} thumbnail`}
        className="bg-blue-500 rounded-full w-8 h-8 object-cover"
      />
      <span className="text-sm font-medium">{prefix}{processedUser?.name || 'Unknown User'}</span>
    </div>
  );
}