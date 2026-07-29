/* eslint-disable @next/next/no-img-element */

import { trpc } from '~/utils/trpc';
import Modal from '~/components/ui/Modal';
import {
  CheckIcon,
  XMarkIcon,
  CheckCircleIcon,
  EnvelopeOpenIcon,
} from '@heroicons/react/24/solid';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import MediaObject from '~/components/ui/MediaObject';
import ReactTimeago from 'react-timeago';
import { UserInfo } from '~/services/types/roblox.types';
import { useWorkspace } from '~/components/contexts/workspace';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Response } from '~/services/NewMongoTypes';
import { JSX } from 'react';
import {
  getEnabledStatuses,
  getStatusMeta,
} from '~/components/page_components/workspaces/forms/formsMeta';
import type { ResponseStatus } from '~/services/NewMongoTypes/Application.type';
import Badge from '~/components/ui/Badge';

type ApplicationResponseFromQuery = Response & {
  thumbnail: string;
  userInfo: UserInfo;
};

export default function ResponseModal({
  reviewingApplication,
  setReviewingApplication,
  query,
}: {
  reviewingApplication: ApplicationResponseFromQuery | false;
  setReviewingApplication: any;
  query: any;
}) {
  const workspace = useWorkspace();

  const { data: application } =
    trpc.workspaces.workspace.forms.applications.application.getApplication.useQuery(
      {
        groupId: workspace.groupId,
        //@ts-expect-error guarded below
        applicationId: reviewingApplication?.applicationId,
      },
      { enabled: reviewingApplication !== false },
    );

  const { data: comments } = trpc.workspaces.workspace.forms.applications.application.responses.getComments.useQuery(
    {
      groupId: workspace.groupId,
      //@ts-expect-error dont be gay
      applicationId: reviewingApplication?.applicationId,
      //@ts-expect-error dont be gay
      responseId: reviewingApplication?._id?.toString(),
    },
  )
  const { data: userInfo } = trpc.workspaces.workspace.forms.applications.application.responses.getUserInfo.useQuery(
    {
      groupId: workspace.groupId,
      //@ts-expect-error dont be gay
      applicationId: reviewingApplication?.applicationId,
      //@ts-expect-error dont be gay
      responseId: reviewingApplication?._id?.toString(),
    },
  );
  const context = trpc.useUtils();

  const setStatusMutation = trpc.workspaces.workspace.forms.applications.application.responses.setResponseStatus.useMutation();
  const sendCommentMutation = trpc.workspaces.workspace.forms.applications.application.responses.commentOnApplication.useMutation();
  const markReadMutation = trpc.workspaces.workspace.forms.applications.application.responses.markResponseRead.useMutation();

  const { readApplications } = workspace.department.permissions.applications;

  if (reviewingApplication == false) {
    return (<></>);
  }

  const enabledStatuses = getEnabledStatuses(application?.statusOptions);
  const currentStatus = getStatusMeta(reviewingApplication.status);

  function setStatus(status: ResponseStatus) {
    if (reviewingApplication == false) return;
    setStatusMutation.mutateAsync({
      groupId: workspace.groupId,
      applicationId: reviewingApplication.applicationId,
      responseId: reviewingApplication?._id ? reviewingApplication?._id.toString() : '',
      status,
    }).then(() => {
      toast.success('Successfully updated response');
      context.workspaces.workspace.forms.applications.application.responses.getResponses.invalidate(query)
      context.workspaces.workspace.forms.applications.application.responses.getResponsesCount.invalidate(query)
      context.workspaces.workspace.forms.applications.application.responses.getComments.invalidate({
        groupId: workspace.groupId,
        applicationId: reviewingApplication.applicationId,
        responseId: reviewingApplication?._id ? reviewingApplication?._id.toString() : '',
      })
      setReviewingApplication({ ...reviewingApplication, status });
    }).catch(e => {
      toast.error(`Something went wrong ${e}`)
    })
  }

  function markRead(read: boolean) {
    if (reviewingApplication == false) return;
    markReadMutation.mutateAsync({
      groupId: workspace.groupId,
      applicationId: reviewingApplication.applicationId,
      responseId: reviewingApplication?._id ? reviewingApplication?._id.toString() : '',
      read,
    }).then(() => {
      toast.success(read ? 'Marked as read' : 'Marked as unread');
      context.workspaces.workspace.forms.applications.application.responses.getResponses.invalidate(query);
      setReviewingApplication({ ...reviewingApplication, read });
    }).catch(e => toast.error(`Something went wrong ${e}`));
  }

  function sendComment(message: string) {
    if (reviewingApplication == false) return;
    sendCommentMutation.mutateAsync({
      groupId: workspace.groupId,
      applicationId: reviewingApplication.applicationId,
      responseId: reviewingApplication?._id ? reviewingApplication?._id.toString() : '',
      message
    }).then(() => {
      toast.success('Successfully sent message');
      context.workspaces.workspace.forms.applications.application.responses.getComments.invalidate({
        groupId: workspace.groupId,
        applicationId: reviewingApplication.applicationId,
        responseId: reviewingApplication?._id ? reviewingApplication?._id.toString() : '',
      })
    }).catch(e => {
      toast.error(`Something went wrong ${e}`)
    })
  }

  return (
    <Modal
      //@ts-expect-error dont be gay
      open={(reviewingApplication !== false)}
      setOpen={() => {
        setReviewingApplication(false);
      }}
      sizeOverride="5xl"
    >
      {
        //@ts-expect-error dont be gay
        (reviewingApplication !== false) && (
          <div>
            {/* Header ---------------------------------------------------- */}
            <div className="flex flex-row flex-wrap gap-3 items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex flex-row gap-3 items-center min-w-0">
                <img
                  src={reviewingApplication.thumbnail}
                  className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700"
                  alt="user icon"
                />
                <div className="min-w-0">
                  <h1 className="font-bold text-xl truncate">
                    <Link
                      target="__blank"
                      href={`https://roblox.com/users/${reviewingApplication.userId}/profile`}
                      className="transition hover:text-blue-500"
                    >
                      {reviewingApplication.userInfo.name}
                    </Link>
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {reviewingApplication.source === 'online' ? 'Submitted online' : 'Submitted in-game'}
                    {' · '}
                    <ReactTimeago date={reviewingApplication.created} />
                  </p>
                </div>
              </div>
              <div className="flex flex-row items-center gap-2">
                {reviewingApplication.score !== undefined && reviewingApplication.score !== null && (
                  <Badge color="blue">{reviewingApplication.score.toString().split('.')[0]}%</Badge>
                )}
                <Badge color={currentStatus.badge}>{currentStatus.label}</Badge>
                {reviewingApplication.read && <Badge color="green">Read</Badge>}
              </div>
            </div>

            <div className="mt-4 flex flex-row flex-wrap gap-6">
              <div className="flex flex-col gap-2 grow min-w-[280px]">
                {reviewingApplication.responseBody
                  .sort((a, b) => a.position - b.position)
                  .map((question, i) => {
                    const Insert = (): JSX.Element => {
                      if (question.type == 'text_response') {
                        return (
                          <p className="px-3 bg-gray-50 py-2 rounded-md transition dark:bg-gray-900 dark:border-gray-700 border-gray-200 text-gray-900 dark:text-gray-100 mt-2 border">
                            {question.answer}
                          </p>
                        );
                      } else if (question.type == 'multiple_choice') {
                        if (question.allow_multiple_selections) {
                          return (
                            <div className="flex flex-col gap-1 mt-2">
                              {
                                //@ts-expect-error its ok
                                question.answer.map((choice: string) => (
                                  <p
                                    key={choice}
                                    className="px-3 bg-gray-50 py-2 rounded-md transition dark:bg-gray-900 dark:border-gray-700 border-gray-200 text-gray-900 dark:text-gray-100 border"
                                  >
                                    {choice}
                                  </p>
                                ))
                              }
                            </div>
                          );
                        }
                        return (
                          <p className="px-3 bg-gray-50 py-2 rounded-md transition dark:bg-gray-900 dark:border-gray-700 border-gray-200 text-gray-900 dark:text-gray-100 mt-2 border">
                            {question.answer}
                          </p>
                        );
                      } else if (question.type == 'scaled_response') {
                        return (
                          <p className="px-3 bg-gray-50 py-2 rounded-md transition dark:bg-gray-900 dark:border-gray-700 border-gray-200 text-gray-900 dark:text-gray-100 mt-2 border">
                            {question.answer}
                          </p>
                        );
                      } else if (question.type == 'typing_speed_test') {
                        return (
                          <>
                            <p className="px-3 bg-gray-50 py-2 rounded-md transition dark:bg-gray-900 dark:border-gray-700 border-gray-200 text-gray-900 dark:text-gray-100 mt-2 border">
                              {question.answer} words per minute
                            </p>
                            <small className="-mt-1 text-gray-500">
                              Tested via ReAdmin Typing Speed Test
                            </small>
                          </>
                        );
                      }
                      return <></>;
                    };
                    return (
                      <div
                        className="px-3 py-3 border rounded-xl border-gray-200 transition dark:bg-gray-800/40 dark:border-gray-700"
                        key={question.id}
                      >
                        <div className="flex flex-row gap-2 items-center">
                          {question.correct == true && (
                            <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-500" />
                          )}
                          {question.correct == false && (
                            <XMarkIcon className="h-5 w-5 shrink-0 text-red-500" />
                          )}
                          <h1 className="font-semibold text-gray-700 dark:text-gray-200">
                            {(i + 1).toLocaleString()}. {question.questionText}
                          </h1>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Insert />
                        </div>
                      </div>
                    );
                  })}

                {readApplications && (
                  <div className="flex flex-col gap-2 border border-gray-200 transition dark:bg-gray-800/40 dark:border-gray-700 rounded-xl px-3 py-3 mt-1">
                    <div className="flex flex-row items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">Update status</p>
                      <Button
                        size="small"
                        variant={reviewingApplication.read ? 'success' : 'discrete'}
                        icon={reviewingApplication.read ? CheckIcon : EnvelopeOpenIcon}
                        onClick={() => markRead(!reviewingApplication.read)}
                      >
                        {reviewingApplication.read ? 'Read' : 'Mark read'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {enabledStatuses.map((status) => (
                        <Button
                          key={status.id}
                          size="medium"
                          className="w-full"
                          variant={
                            reviewingApplication.status === status.id
                              ? status.button
                              : 'discrete'
                          }
                          onClick={() => setStatus(status.id)}
                        >
                          {status.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 grow w-min min-w-[240px]">
                <div className="flex flex-col gap-1 border border-gray-200 transition dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-100 rounded-xl px-3 py-3">
                  <h1 className="font-bold text-lg">User Info</h1>
                  {!userInfo && <LoadingAnimation />}
                  {userInfo?.map((info) => (
                    <div key={info.name} className="flex flex-row gap-1">
                      <p className="font-bold text-left">{info.name} - <span className={`${info.name == 'Groups' ? 'text-sm' : ''} font-normal`}>{
                        info?.value || ''}</span></p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1 border border-gray-200 transition dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-100 rounded-xl px-3 py-3">
                  <h1 className="font-bold text-lg">Timeline &amp; Comments</h1>
                  {comments?.map((responseComment: any) => (
                    <div
                      key={responseComment.created.toString()}
                      className="border border-gray-200 transition dark:border-gray-700 px-2 py-1 rounded-lg"
                    >
                      <MediaObject
                        src={responseComment?.thumbnail}
                        title={
                          <div className="flex flex-row justify-between gap-1">
                            <p>{responseComment?.name}</p>
                            <p className="font-normal text-sm pl-1">
                              <ReactTimeago
                                date={new Date(responseComment.created)}
                              />
                            </p>
                          </div>
                        }
                        description={responseComment.message}
                        smaller={true}
                      ></MediaObject>
                    </div>
                  ))}
                  {readApplications && (
                    <form
                      className="mb-2 mt-2 flex flex-row gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const target = e.target as any;
                        const message = target.message.value;
                        sendComment(message);
                        target.message.value = '';
                      }}
                    >
                      <TextLabel
                        className="w-full"
                        placeholder="Type comment here"
                        id="message"
                      />
                      <Button variant="discrete" className="w-full max-w-[85px]">
                        Post
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </Modal>
  );
}
