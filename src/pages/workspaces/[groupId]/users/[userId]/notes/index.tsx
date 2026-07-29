/* eslint-disable @next/next/no-img-element */
import { TrashIcon } from '@heroicons/react/20/solid';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { JSX, ReactElement } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import CommentPost from '~/components/forms/CommentPost';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import WorkspaceUserSidebarLayout from '~/components/page_components/workspaces/users/user/WorkspaceUserSidebarLayout';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import { UserNote } from '~/services/NewMongoTypes';
import { UserInfo } from '~/services/types/roblox.types';
import ReadFile from "~/utils/FileReader";
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { Attachment } from '../../..';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const { data: userInfo, isLoading: userIsLoading } = trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery({ groupId, userId });
  const { data: notes, isLoading: notesLoading } = trpc.workspaces.workspace.activity.users.notes.get.useQuery({ groupId, userId });

  if (!workspace) {
    return <LoadingPage />;
  }
  if (!workspace.department.permissions.activity.view) {
    router.push(`/workspaces/${groupId}`)
    return <></>;
  }

  return (
    <>
      <Head>
        <title>{workspace?.premium?.is ? '' : 'ReAdmin '}{workspace?.groupName || ''} {userInfo?.robloxInfo?.name || ''} Notes</title>
      </Head>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
        <div className="mt-4">
          <CreatePost userId={userId} />
        </div>
        <div className="mt-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Notes
            {notes && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{notes.length}</span>
            )}
          </p>
          <div className="flex flex-col gap-3">
            {!notes && (
              <LoadingAnimation />
            )}
            {notes && notes.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-gray-100">No notes yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">Use the box above to leave the first note about this user.</p>
              </div>
            )}
            {notes && (
              <>
                {notes.map(note => (
                  //@ts-expect-error this is ok
                  <Post key={note._id.toString()} post={note} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


function Post({
  post,
}: {
  post: UserNote & { authorInfo: UserInfo & { thumbnail: string; } };
}): JSX.Element {
  const workspace = useWorkspace();
  const context = trpc.useUtils();
  const deleteMutation = trpc.workspaces.workspace.activity.users.notes.delete.useMutation();
  const { data: departments } = trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({ groupId: post.groupId });

  return (
    <>
      <div className="flex items-start space-x-4">
        <div className="shrink-0">
          <img
            className="inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-gray-800"
            src={post?.authorInfo?.thumbnail}
            alt="User icon"
          />
        </div>
        <div
          className={`${post.adminOnly
            ? 'border-l-4 border-red-500'
            : ''
            } min-w-0 w-full flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700/80 dark:bg-gray-800/80`}
        >
          {post.adminOnly && (
            <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400">
              Private note
            </span>
          )}
          {post.attachments.length !== 0 && (
            <div className="flex flex-row gap-2 py-2">
              {post.attachments.map((attachment) => (
                <Attachment key={attachment} attachment={attachment} />
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{post.note}</p>

          <div className="mt-2 flex flex-row items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-700/60">
            {workspace.department.permissions.admin && (
              <button onClick={() => {
                deleteMutation.mutateAsync({ postId: (post?._id || '').toString(), groupId: workspace.groupId }).then(() => {
                  toast.success('Succesfully deleted post.');
                  context.workspaces.workspace.activity.users.notes.get.invalidate({ groupId: workspace.groupId });
                })
              }}>
                <TrashIcon className="h-4 w-4 text-gray-500 transition hover:text-red-500 dark:hover:text-red-400" />
              </button>
            )}
            <p className="text-sm font-medium text-gray-500">
              <ReactTimeago date={post.created} /> · {post?.authorInfo?.name}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function CreatePost({ userId }: { userId: string }) {
  const workspace = useWorkspace();
  const mutation =
    trpc.workspaces.workspace.activity.users.notes.post.useMutation();
  const context = trpc.useUtils();

  return mutation.isPending ? (
    <LoadingPage override="Submitting note" />
  ) : (
    <CommentPost
      onSubmit={async (f) => {
        const target = f.target as any;
        const comment = target.comment.value;
        const files = target.files.files;

        const fileData: [string, string][] = [];
        for (const file of files) {
          const data = await ReadFile(file);
          if (data) {
            fileData.push([file.name, data.toString()]);
          }
        }

        mutation
          .mutateAsync({
            groupId: workspace.groupId,
            userId,
            comment,
            admin: target.adminRestriction.checked == true,
            files: fileData,
          })
          .then(() => {
            context.workspaces.workspace.activity.users.notes.get.invalidate({ groupId: workspace.groupId, userId });
            toast.success('Succesfully posted user note.');
            // to do invaldiate and thing
          })
          .catch((e) => {
            alert(e.message);
          });
      }}
    >

      <Toggle id="adminRestriction" title="Restrict to activity admins" description={''} />
    </CommentPost>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceUserSidebarLayout>{page}</WorkspaceUserSidebarLayout>
);
