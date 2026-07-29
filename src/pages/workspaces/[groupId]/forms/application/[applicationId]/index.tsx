/* eslint-disable @next/next/no-img-element */
'use client';

import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import ReactTimeago from 'react-timeago';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceFormsApplicationSidebarNavigationLayout from '~/components/page_components/workspaces/forms/WorkspaceFormsApplicationSidebarNavigationLayout';
import Card from '~/components/ui/Card';
import Badge from '~/components/ui/Badge';
import { UserInfo } from '~/services/types/roblox.types';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import ResponseModal from '~/components/page_components/workspaces/forms/ResponseModal';
import { getStatusMeta } from '~/components/page_components/workspaces/forms/formsMeta';
import { Response } from '~/services/NewMongoTypes';
import { NoSsr } from '~/components/NoSSR';
import { InboxIcon } from '@heroicons/react/24/outline';

type ApplicationResponseFromQuery = Response & {
  thumbnail: string;
  userInfo: UserInfo;
};

type StatusFilter =
  | 'all'
  | 'pending'
  | 'passed'
  | 'failed'
  | 'reported'
  | 'received'
  | 'read'
  | 'completed'
  | 'denied'
  | 'review';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, applicationId }: { groupId: string; applicationId: string } =
    router.query as any;
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [username, setUsername] = useState<string>('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [reviewingApplication, setReviewingApplication] = useState<
    false | ApplicationResponseFromQuery
  >(false);
  const q: {
    groupId: string;
    applicationId: string;
    username?: string;
    sort: 'newest' | 'oldest';
    status: StatusFilter;
    cursor?: string;
    limit: number;
  } = {
    groupId,
    applicationId,
    username,
    sort,
    status,
    limit: 10,
  };
  if (cursor !== undefined) {
    q.cursor = cursor;
  }

  const {
    data: responses,
    fetchNextPage,
    isPending,
    isFetchingNextPage,
  } = trpc.workspaces.workspace.forms.applications.application.responses.getResponses.useInfiniteQuery(
    q,
    {
      getNextPageParam: (lastPage: any) =>
        lastPage !== undefined
          ? lastPage[lastPage.length - 1]?._id.toString()
          : null,
    },
  );
  const { data: totalResponses } =
    trpc.workspaces.workspace.forms.applications.application.responses.getResponsesCount.useQuery(
      q,
    );
  const { data: application, isPending: applicationIsLoading } =
    trpc.workspaces.workspace.forms.applications.application.getApplication.useQuery(
      { groupId, applicationId },
    );
  const workspace = useWorkspace();
  // The workspace loads asynchronously. Until it resolves (always the case on
  // reload / cold navigation, and slower on mobile), don't evaluate the
  // permission check or it will redirect away before access can be confirmed.
  if (!workspace?.department) {
    return <LoadingPage />;
  }
  if (!workspace.department.permissions?.applications?.viewApplications) {
    if (typeof window !== 'undefined') router.push(`/workspaces/${groupId}/forms`);
    return (<></>)
  }

  if (applicationIsLoading) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        title={`${application?.name} Responses`}
        description={
          totalResponses !== undefined
            ? `${totalResponses.toLocaleString()} response${totalResponses === 1 ? '' : 's'}`
            : 'Review and triage submissions to this form.'
        }
        disableDivide={true}
      />

      <div className="flex flex-row justify-between flex-wrap gap-2">
        <TextLabel
          className="w-full max-w-xs"
          placeholder="Search by name"
          defaultValue={username}
          onChange={(uname) => {
            setUsername(uname);
            setCursor('');
          }}
        />
        <div className="flex flex-row gap-2">
          <Dropdown
            className="w-full"
            choices={[
              { id: 'newest', name: 'Newest → Oldest' },
              { id: 'oldest', name: 'Oldest → Newest' },
            ]}
            defaultValue={sort}
            onChange={(v) => {
              setSort(v);
              setCursor('');
            }}
          />
          <Dropdown
            className="w-full"
            choices={[
              { id: 'all', name: 'All Responses' },
              { id: 'received', name: 'Received' },
              { id: 'read', name: 'Read' },
              { id: 'pending', name: 'Pending' },
              { id: 'review', name: 'Review' },
              { id: 'completed', name: 'Completed' },
              { id: 'passed', name: 'Passed' },
              { id: 'denied', name: 'Denied' },
              { id: 'failed', name: 'Failed' },
              { id: 'reported', name: 'Reported' },
            ]}
            defaultValue={status}
            onChange={(v) => {
              setStatus(v);
              setCursor('');
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 w-full">
        <NoSsr>
          {(responses?.pages?.length == 0 || responses?.pages[0]?.length == 0) && (
            <Card className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <InboxIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-bold text-lg text-gray-600 dark:text-gray-300">No responses yet</p>
              <p className="text-sm text-gray-500 max-w-sm">
                Responses to this form will appear here as they come in.
              </p>
            </Card>
          )}
          {responses?.pages.map((page, i) => (
            <div key={`${i}`} className="flex flex-col gap-2 w-full">
              {
                //@ts-expect-error
                page?.map((response: ApplicationResponseFromQuery) => {
                  const meta = getStatusMeta(response.status);
                  const minutes = Math.floor(response.timeTakenSeconds / 1000 / 60);
                  const seconds = Math.floor((response.timeTakenSeconds % 60000) / 1000);
                  return (
                    <button
                      key={!response?._id ? '' : response._id.toString()}
                      onClick={() => {
                        setReviewingApplication(response);
                      }}
                      className="text-left"
                    >
                      <Card className="transition hover:shadow-lg border-2 hover:border-blue-100 dark:hover:border-blue-900/40">
                        <div className="flex flex-row justify-between items-center gap-3">
                          <div className="flex flex-row gap-3 items-center min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={response.thumbnail}
                                alt=""
                                className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${meta.dot}`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-row items-center gap-2 flex-wrap">
                                <p className="font-semibold truncate">{response?.userInfo?.name}</p>
                                <Badge color={meta.badge}>{meta.label}</Badge>
                                {response.read && <Badge color="green">Read</Badge>}
                                {response?.score && response.score !== undefined && response.score !== null && !isNaN(response.score) && (
                                  <Badge color="blue">{response.score.toString().split('.')[0]}%</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {response.source == 'online' ? 'Online' : 'In-game'}
                                {' · '}
                                <ReactTimeago date={response.created} />
                                {' · '}Took {minutes}m {seconds}s
                              </p>
                            </div>
                          </div>
                          <Button size="medium" variant="primary" className="self-center shrink-0">
                            View
                          </Button>
                        </div>
                      </Card>
                    </button>
                  );
                })}
            </div>
          ))}
        </NoSsr>

        {isPending || (isFetchingNextPage && <LoadingPage />)}

        {responses?.pages?.length !== 0 &&
          responses?.pages.reduce((a, b) => (b?.length || 0) + a, 0) !==
          totalResponses && (
            <Button
              variant="discrete"
              className="w-full"
              size="medium"
              onClick={() => {
                fetchNextPage();
              }}
            >
              Load More
            </Button>
          )}
      </div>

      <ResponseModal reviewingApplication={reviewingApplication} setReviewingApplication={setReviewingApplication} query={q} />
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceFormsApplicationSidebarNavigationLayout>{page}</WorkspaceFormsApplicationSidebarNavigationLayout>
);
