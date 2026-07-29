'use client';

import { UserPlusIcon } from '@heroicons/react/20/solid';
import { NoSymbolIcon, ClockIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useState, PropsWithChildren, ReactElement } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspacGameBanUserModal from '~/components/page_components/workspaces/games/game/workspace.games.ban.create.modal';
import WorkspaceGamesSidebarNavigationLayout from '~/components/page_components/workspaces/games/WorkspaceGamesSidebarNavigationLayout';
import MediaObject from '~/components/ui/MediaObject';
import Modal from '~/components/ui/Modal';
import Badge from '~/components/ui/Badge';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import TextLabel from '~/components/forms/TextLabel';
import React from 'react';
import NoSSR from '~/components/NoSSR';
import { Attachment } from '../..';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const [creatingBan, setCreatingBan] = useState(false);
  const [username, setUsername] = useState<string | undefined>(undefined);


  const {
    data: bans,
    fetchNextPage,
    isPending,
    isFetchingNextPage,
    hasNextPage
  } = trpc.workspaces.workspace.games.bans.getBans.useInfiniteQuery(
    {
      groupId,
      search: username
    },
    {
      getNextPageParam: (lastPage: any) => {
        if (!lastPage) {
          return null;
        }
        if (lastPage[lastPage.length - 1]?.hasNextPage == false) {
          return null;
        }
        return lastPage[lastPage.length - 1]?._id.toString();
      },
    },
  );

  if (!workspace.department.permissions.games.manageBans) {
    return (
      <div>
        <PageHeading title={`${workspace?.groupName} Bans`} disableDivide={true} />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            You do not have permission to manage bans
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Contact your group administrator if you believe this is incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <NoSSR>
      <PageHeading title={`${workspace?.groupName} Bans`} disableDivide={true}>
        <Button
          size="medium"
          onClick={() => {
            setCreatingBan(true);
          }}
          icon={UserPlusIcon}
          variant="danger"
        >
          Ban User
        </Button>
      </PageHeading>

      <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
        Banned users are blocked from every game using the ReAdmin Remote-Admin
        tracking system. Attach evidence so your team has a clear record of each
        ban.
      </p>

      <div className="mt-4">
        <TextLabel
          label="Search for a user"
          id="search"
          placeholder="Type a username"
          onChange={(value) => {
            setUsername(value)
          }}
        />
      </div>

      {bans?.pages?.length == 0 && (
        <div className="mt-6 flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
          <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <NoSymbolIcon className="size-6 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            No banned users
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Banning users will ban them from all games which use the ReAdmin
            Remote-Admin tracking system.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">

        {bans?.pages?.map((page, i) => (
          <React.Fragment key={`${i}-frag`}>
            {' '}
            {/*  These buttons are being appended to hmtl dom and not _nexts */}
            {page?.map((ban) => (
              <BanCard key={ban.userId} ban={ban} />
            ))}
          </React.Fragment>
        ))}
      </div>


      {isPending || (isFetchingNextPage && <LoadingPage />)}

      {bans?.pages?.length !== 0 && bans?.pages && hasNextPage && (
        <Button
          variant="primary"
          className="w-full mt-4"
          size="medium"
          onClick={() => {
            fetchNextPage();
          }}
        >
          Load More
        </Button>
      )}

      <WorkspacGameBanUserModal
        open={creatingBan}
        setOpen={setCreatingBan}
        groupId={groupId}
      />
    </NoSSR>
  );
}

function BanCard({
  ban,
}: PropsWithChildren<{
  ban: any;
}>) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const unbanMutation = trpc.workspaces.workspace.games.bans.delete.useMutation();
  const context = trpc.useUtils();

  const isExpired = ban.expires && new Date(ban.expires) < new Date();
  const evidence: string[] = Array.isArray(ban.evidence) ? ban.evidence : [];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isExpired ? (
              <Badge color="yellow">Expired</Badge>
            ) : ban.expires ? (
              <Badge color="red">Temporary ban</Badge>
            ) : (
              <Badge color="red">Permanent ban</Badge>
            )}
            {evidence.length > 0 && (
              <Badge color="light">
                {evidence.length} {evidence.length === 1 ? 'attachment' : 'attachments'}
              </Badge>
            )}
          </div>

          <MediaObject
            src={ban.user.thumbnail || ''}
            title={ban.user.name}
            description={`Banned by ${ban.disciplinarian.name} for ${ban.reason}`}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <ShieldExclamationIcon className="size-3.5" />
              Banned <ReactTimeago date={ban.created} />
            </span>
            {ban.expires && (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-3.5" />
                {isExpired ? 'Expired' : 'Expires'} <ReactTimeago date={ban.expires} />
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={() => {
            setDeleteOpen(true);
          }}
          variant="light_danger"
          className="h-min w-min shrink-0 self-start whitespace-nowrap"
          size="medium"
        >
          Unban User
        </Button>
      </div>

      {evidence.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Evidence
          </p>
          <div className="flex flex-wrap gap-2">
            {evidence.map((attachment) => (
              <Attachment key={attachment} attachment={attachment} />
            ))}
          </div>
        </div>
      )}

      <Modal open={deleteOpen} setOpen={setDeleteOpen}>
        <PageHeading title={`Are you sure that you want to unban this user?`} />
        <p className="text-md">
          They were banned by {ban.disciplinarian.name}{' '}
          <ReactTimeago date={ban.created} />.
        </p>

        <div className="flex flex-row gap-2 mt-2">
          <Button
            size="medium"
            onClick={() => {
              setDeleteOpen(false);
            }}
            className="w-full"
            variant="blue"
          >
            Cancel
          </Button>
          <Button
            size="medium"
            className="w-full"
            variant="light_danger"
            onClick={async () => {
              const action = new Promise<void>((resolve, reject) => {
                unbanMutation.mutateAsync({
                  groupId: ban.groupId as string,
                  banId: ban._id.toString()
                }).then(() => {
                  resolve();
                  setDeleteOpen(false);
                  context.workspaces.workspace.games.bans.getBans.invalidate({ groupId: ban.groupId })
                }).catch(e => {
                  reject(e);
                })
              })

              toast.promise(action, {
                loading: 'Unbanning user',
                success: 'Successfully unbanned user',
                error: 'Failed to unban user',
              });
            }}
          >
            Unban User
          </Button>
        </div>
      </Modal>
    </div>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceGamesSidebarNavigationLayout>{page}</WorkspaceGamesSidebarNavigationLayout>
);
