/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/router";
import { PropsWithChildren } from "react";
import LoadingAnimation from "~/components/ui/LoadingAnimation";
import { useWorkspace } from "~/components/contexts/workspace";
import OwnerStarBadge, { useIsWorkspaceOwner } from "~/components/ui/OwnerStarBadge";
import DepartmentBadge from "~/components/ui/DepartmentBadge";
import { trpc } from "~/utils/trpc";

export default function UserHeaderImage({ children }: PropsWithChildren<{}>) {
  const router = useRouter();
  const workspace = useWorkspace();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;
  const { data: userInfo } = trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery({ groupId, userId });
  const isOwner = useIsWorkspaceOwner(userInfo?.robloxInfo?.id ?? userId);

  return (

    <div className="w-full">
      {!userInfo ? (
        <>
          <LoadingAnimation />
        </>
      ) : (
        <div className='flex flex-row justify-between flex-wrap gap-4'>
          <div className="flex flex-row gap-2">
            <div className="relative shrink-0">
              <img src={userInfo?.thumbnail || 'https://cdn.readmin.app/readmin-public/backon-hair.png'} alt={`${userInfo?.robloxInfo?.name} User Icon`} className={`rounded-full bg-${workspace?.brandColor || 'blue'}-500 border-${workspace?.brandColor || 'blue'}-900 border-4 h-24 w-24`} />
              {isOwner && <OwnerStarBadge size={32} />}
            </div>
            <div className='self-center align-middle'>
              <Link href={`https://roblox.com/users/${userInfo?.robloxInfo?.id}/profile`} target="_blank" className={`transition hover:text-${workspace?.brandColor || 'blue'}-500 font-bold text-2xl`}>{userInfo?.robloxInfo?.name || 'Loading user information'} {userInfo?.robloxInfo?.name !== userInfo?.robloxInfo?.displayName && (
                <span className="text-gray-300 font-semibold"> ({userInfo?.robloxInfo?.displayName})</span>
              )}</Link>
              <p className="text-lg font-semibold text-gray-500">{userInfo?.role?.name || 'Not tracked'} {userInfo?.department && (<DepartmentBadge name={userInfo.department.name} color={userInfo.department.color} className="ml-1" />)}</p>
            </div>
          </div>
          {children}
        </div>
      )}
    </div>
  )
}