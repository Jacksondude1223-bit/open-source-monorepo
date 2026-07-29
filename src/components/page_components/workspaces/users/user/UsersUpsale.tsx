/* eslint-disable @next/next/no-img-element */
import { useWorkspace } from '~/components/contexts/workspace';
import WorkspaceUpsale from '../../settings/billing/Upsale';
import { useRouter } from 'next/router';
import { trpc } from '~/utils/trpc';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import Link from 'next/link';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceUserSidebarLayout from './WorkspaceUserSidebarLayout';
import { JSX } from 'react';

export default function UsersUpsale({ children }: { children: JSX.Element }) {
  const workspace = useWorkspace();
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;
  const { data: userInfo } =
    trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery({
      groupId,
      userId,
    });

  if (!workspace?.premium?.is) {
    return (
      <WorkspaceUserSidebarLayout>
        <div className="">
          <PageHeading
            title={`${workspace?.groupName || 'Workspace'} - ${userInfo?.robloxInfo?.name || ''} Info`}
            disableDivide={true}
          >
          </PageHeading>
          <div className="w-full">
            {!userInfo ? (
              <>
                <LoadingAnimation />
              </>
            ) : (
              <div className="mt-4 flex flex-row justify-between flex-wrap gap-4">
                <div className="flex flex-row gap-2">
                  <img
                    src={userInfo?.thumbnail || 'https://cdn.readmin.app/readmin-public/backon-hair.png'}
                    alt={`${userInfo?.robloxInfo?.name} User Icon`}
                    className="rounded-full bg-blue-500 border-blue-900 border-4 h-24 w-24"
                  />
                  <div className="self-center align-middle">
                    <Link
                      href={`https://roblox.com/users/${userInfo?.robloxInfo?.id}/profile`}
                      target="_blank"
                      className="transition hover:text-blue-500 font-bold text-2xl"
                    >
                      {userInfo?.robloxInfo?.name || 'Loading user information'}{' '}
                      {userInfo?.robloxInfo?.name !==
                        userInfo?.robloxInfo?.displayName && (
                          <span className="text-gray-300 font-semibold">
                            {' '}
                            ({userInfo?.robloxInfo?.displayName})
                          </span>
                        )}
                    </Link>
                    <p className="text-lg font-semibold text-gray-500">
                      {userInfo?.role?.name || 'Not tracked'}{' '}
                      {userInfo?.department && (
                        <span>- {userInfo?.department?.name}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className='flex flex-col gap-2 mt-2'>
            <img src="https://readmin.app/app/user-profile.png" className='self-center align-middle max-h-125  rounded-lg shadow-lg border border-gray-500' alt="activity upsale image" />
            <h1 className='my-4 text-2xl font-bold text-center'>Upgrade today and get access to top of the line activity tracking features.</h1>
            <WorkspaceUpsale />
          </div>
        </div>
      </WorkspaceUserSidebarLayout>
    );
  }

  return <WorkspaceUserSidebarLayout>{children}</WorkspaceUserSidebarLayout>;
}
