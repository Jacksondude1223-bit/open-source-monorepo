/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from 'next/router';
import { JSX, ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSessionSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSessionSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { formatFullDateInTimezone, formatTimeInTimezone } from '~/utils/DateUtils';
import { DocumentArrowDownIcon, PlayIcon, TrashIcon, UserIcon } from '@heroicons/react/20/solid';
import Button from '~/components/forms/Button';
import toast from 'react-hot-toast';
import { SessionClaim, SessionClaimV2, SessionCommentType, SessionServerType } from '~/services/NewMongoTypes/Session.type';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import ReactTimeago from 'react-timeago';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import { DocumentPlusIcon, LinkIcon } from '@heroicons/react/24/solid';
import NoSSR from '~/components/NoSSR';
import CommentPost from '~/components/forms/CommentPost';
import { UserInfo } from '~/services/types/roblox.types';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import ReadFile from "~/utils/FileReader";
import { Attachment } from '../../..';
import Badge from '~/components/ui/Badge';
import { ChatBubbleLeftRightIcon, ServerStackIcon } from '@heroicons/react/24/outline';

const SESSION_STATE_META: Record<
  'soon' | 'notify' | 'ongoing' | 'ended',
  { label: string; color: 'blue' | 'green' | 'yellow' | 'red' | 'light' }
> = {
  soon: { label: 'Scheduled', color: 'light' },
  notify: { label: 'Starting soon', color: 'yellow' },
  ongoing: { label: 'Ongoing', color: 'green' },
  ended: { label: 'Ended', color: 'red' },
};

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, sessionId }: { groupId: string; sessionId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const utils = trpc.useUtils();
  const { data: sessionData } =
    trpc.workspaces.workspace.sessions.v2.getSessionData.useQuery({
      groupId,
      sessionId,
    });
  const { data: comments } =
    trpc.workspaces.workspace.sessions.v2.getSessionComments.useQuery({ groupId, sessionId });

  const claimSessionRoleForServer =
    trpc.workspaces.workspace.sessions.v2.claimSessionRoleForServer.useMutation();
  const removeUserSessionClaimForServer =
    trpc.workspaces.workspace.sessions.v2.removeUserSessionClaimForServer.useMutation();
  const createServer = trpc.workspaces.workspace.sessions.v2.createSessionServer.useMutation();
  const updateSessionServerName = trpc.workspaces.workspace.sessions.v2.updateSessionServerName.useMutation();
  const deleteSessionServer = trpc.workspaces.workspace.sessions.v2.deleteSessionServer.useMutation();
  const updateClaimSessionRoleForServer = trpc.workspaces.workspace.sessions.v2.updateClaimSessionRoleForServer.useMutation();
  const linkSessionServerToUsersServer = trpc.workspaces.workspace.sessions.v2.linkSessionServerToUsersServer.useMutation();

  const permissions = workspace.department.permissions.sessions;


  const startTime = sessionData?.session?.date || new Date();
  const now = new Date();
  const endTime = new Date(new Date(startTime).getTime() + (sessionData?.session?.template?.sessionDuration || 0) * 60 * 1000);
  const notifyTime = new Date(new Date(startTime).getTime() - (sessionData?.session?.template?.appearsMinutesBefore || 0) * 60 * 1000);

  const state = endTime < now ? 'ended' : startTime < now ? 'ongoing' : notifyTime < now ? 'notify' : 'soon';

  if (!permissions.view) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-lg font-bold">You don&apos;t have permission to view other sessions</p>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            If you believe this is a mistake, contact one of your group admins.
          </p>
        </div>
      </>
    );
  }

  if (!sessionData) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <LoadingPage />
      </>
    );
  }

  return (
    <>
      <NoSSR>
        <PageHeading
          title={`${workspace?.groupName} - ${sessionData.session.template.name}`}
          description={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {formatFullDateInTimezone(sessionData.session.date, userTimezone)}
              </span>
              <span className="text-gray-400">·</span>
              <span>
                {formatTimeInTimezone(sessionData.session.date, userTimezone)} – {formatTimeInTimezone(endTime, userTimezone)}
              </span>
              <span className="text-gray-400">·</span>
              <span className="font-mono text-xs text-gray-400">{sessionData.session.id}</span>
            </span>
          }
          disableDivide={true}
          backUrl={`/workspaces/${groupId}/sessions`}
        >
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge color={SESSION_STATE_META[state].color}>
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${state === 'ongoing'
                    ? 'bg-green-500 animate-pulse'
                    : state === 'notify'
                      ? 'bg-yellow-500'
                      : state === 'ended'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`}
                />
                {SESSION_STATE_META[state].label}
              </span>
            </Badge>
            {state !== 'ended' && (
              <Badge color="light">
                {state === 'ongoing' ? (
                  <>ends <ReactTimeago date={endTime} /></>
                ) : (
                  <>starts <ReactTimeago date={startTime} /></>
                )}
              </Badge>
            )}
            <Badge color="light">
              {Object.keys(sessionData.session.servers || {}).length} server{Object.keys(sessionData.session.servers || {}).length === 1 ? '' : 's'}
            </Badge>
          </div>
        </PageHeading>
      </NoSSR>

      {Object.keys(sessionData.session.servers || {}).length == 0 && (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-lg font-bold">No servers have been added to this session yet</p>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Click the button below to add servers to this session
          </p>
          <Button
            variant="primary"
            onClick={() => {
              createServer.mutateAsync({ groupId, sessionId }).then(() => {
                toast.success('Server added');
                utils.workspaces.workspace.sessions.v2.getSessionData.invalidate({ groupId, sessionId });
              }).catch(e => {
                toast.error('Error creating server');
              })
            }}
            className="mt-4"
          >
            Add Servers
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-2">
        {Object.keys(sessionData.session.servers).map((serverKey) => {
          const server = sessionData.session.servers[
            serverKey
          ] as SessionServerType;

          const serverLinked = server?.linkedServerJobId;

          return (
            <div
              key={serverKey}
              className="rounded-xl w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0 grow">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${serverLinked
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      }`}
                    title={serverLinked ? 'Linked to a live server' : 'Not linked to a live server'}
                  >
                    <ServerStackIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 grow">
                    <input
                      type="text"
                      className="text-lg font-semibold w-full bg-transparent rounded-md px-2 py-1 -ml-2 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:text-gray-100 transition dark:placeholder:text-gray-500"
                      placeholder={`Server ${serverKey}`}
                      defaultValue={server?.nickname}
                      onBlur={(value) => {
                        updateSessionServerName.mutateAsync({ groupId, sessionId, serverId: serverKey, name: value.target.value }).then(() => {
                          toast.success('Server name updated');
                          utils.workspaces.workspace.sessions.v2.getSessionData.invalidate({ groupId, sessionId });
                        }).catch(e => {
                          toast.error('Error updating server name');
                        })
                      }} />
                    <p className="text-xs text-gray-400 px-0.5 mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono">#{serverKey}</span>
                      {serverLinked && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">Linked</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-row gap-2 shrink-0">
                  <Button variant="success" icon={PlayIcon} title="Join this server" href={`https://www.roblox.com/games/start?placeId=${sessionData?.session?.template?.placeId}${serverLinked ? `&launchData=ReAdmin-${serverLinked}` : ''}`} target="_blank">Join</Button>
                  {(workspace?.runningGame && workspace?.runningGame?.placeId == sessionData?.session?.template?.placeId) && (
                    <Button variant="primary" icon={LinkIcon} title="Link this server to the one you are in" onClick={() => {
                      linkSessionServerToUsersServer.mutateAsync({ groupId, sessionId, serverId: serverKey }).then(() => {
                        toast.success('Server linked');
                        utils.workspaces.workspace.sessions.v2.getSessionData.invalidate({ groupId, sessionId });
                      }).catch(e => {
                        toast.error('Error linking server');
                      })
                    }}>{serverLinked ? 'Re-Link' : 'Link'}</Button>
                  )}
                  <Button icon={TrashIcon} variant="light_danger" title="Delete this server" onClick={() => {
                    deleteSessionServer.mutateAsync({ groupId, sessionId, serverId: serverKey }).then(() => {
                      toast.success('Server deleted');
                      utils.workspaces.workspace.sessions.v2.getSessionData.invalidate({ groupId, sessionId });
                    }).catch(e => {
                      toast.error('Error deleting server');
                    })
                  }} />
                </div>
              </div>

              <div className="flex flex-col gap-5 px-5 py-4">
                {' '}
                {/* Session Roles */}
                {sessionData.roles.map((role_template) => {
                  return (
                    <div
                      key={role_template.id}
                      className="flex flex-col gap-3"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {role_template.name}
                      </p>
                      <div className="flex flex-col gap-3">
                        {role_template.roles.map((role) => {
                          const { maxUsers, minRank, claimOnce } = role;
                          const newClaimSystem = sessionData.session.newClaimingSystem;

                          const thisRoleClaims = newClaimSystem ? (server.claims as SessionClaimV2[]).filter(a => a.claimedRole == role.id) : Object.keys(
                            server?.claims || {},
                          ).filter(
                            (userId) =>
                              (server.claims as { [userId: string]: SessionClaim })[userId]?.claimedRole == role.id,
                          );
                          // The role is not "over-claimed", and the user is above the minimum role to claim
                          const userRequirement = maxUsers == 0 ? true : thisRoleClaims.length < maxUsers;
                          const canCreateNotAdmin = userRequirement && (minRank == 0 ? true : workspace?.userRole?.rankId || 0 >= minRank);
                          const canCreate = workspace.department.permissions
                            .admin
                            ? userRequirement
                              ? true
                              : false
                            : canCreateNotAdmin;

                          const isFull = maxUsers !== 0 && thisRoleClaims.length >= maxUsers;

                          return (
                            <div key={role.id} className="flex flex-col gap-3 sm:flex-row sm:gap-4 rounded-lg bg-gray-50/70 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700/50 p-3">
                              <div className="sm:w-48 shrink-0">
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {role.name}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <Badge color={isFull ? 'green' : 'light'}>
                                    {thisRoleClaims.length}{maxUsers ? `/${maxUsers}` : ''} claimed
                                  </Badge>
                                  {minRank !== 0 && (
                                    <Badge color="light">min rank {minRank}</Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2 w-full">
                                <div className="flex flex-col gap-2">
                                  {newClaimSystem ? (thisRoleClaims as SessionClaimV2[]).map((claimData) => {

                                    return (
                                      <div
                                        key={`${claimData.userId}-${serverKey}`}
                                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2"
                                      >
                                        <RobloxUserSearch
                                          defaultUser={claimData.userId}
                                          color="blue"
                                          size="small"
                                          className="col-span-2"
                                          groupId={groupId}
                                          enableIcon={true}
                                          easySelf={true}
                                          onSelectUser={async (userId) => {
                                            const action = updateClaimSessionRoleForServer
                                              .mutateAsync({
                                                groupId,
                                                sessionId: sessionId,
                                                serverId: serverKey,
                                                roleId: role_template.id,
                                                subroleId: role.id,
                                                oldUserId: claimData.userId,
                                                userId,
                                                claimId: claimData.claimId,
                                              })
                                              .then(() => {
                                                utils.workspaces.workspace.sessions.v2.getSessionData.invalidate(
                                                  { groupId, sessionId },
                                                );
                                              });

                                            toast.promise(action, {
                                              loading: 'Claiming role',
                                              success: 'Successfully claimed role',
                                              error: 'Failed to claim role',
                                            });

                                            await action.catch(() => {});
                                          }}
                                        />

                                        <div className="flex flex-col gap-0.5 text-sm text-gray-500 dark:text-gray-400 sm:items-end sm:text-right grow">
                                          <span>
                                            claimed <ReactTimeago
                                              date={
                                                claimData?.claimedAt || new Date()
                                              }
                                            />
                                          </span>
                                          <TextReturnForUserId
                                            userId={claimData?.claimedBy || ''}
                                            includeImage={true}
                                            prefix="claimed by "
                                          />
                                        </div>

                                        <div className="flex flex-row gap-2 shrink-0">
                                          <Button variant="primary" icon={UserIcon} title="View who claimed this" onClick={() => {
                                            router.push(`/workspaces/${groupId}/users/${claimData?.claimedBy}`)
                                          }} />
                                          {(workspace.department.permissions.admin || workspace.department.permissions.sessions.manage) && (
                                            <Button
                                              icon={TrashIcon}
                                              variant="danger"
                                              onClick={() => {
                                                const action = new Promise<void>((resolve, reject) => {
                                                  removeUserSessionClaimForServer
                                                    .mutateAsync({
                                                      groupId,
                                                      sessionId: sessionId,
                                                      serverId: serverKey,
                                                      userId: claimData.userId,
                                                      claimId: claimData.claimId,
                                                    })
                                                    .then(() => {
                                                      resolve();
                                                      utils.workspaces.workspace.sessions.v2.getSessionData.invalidate(
                                                        { groupId, sessionId },
                                                      );
                                                    })
                                                    .catch((e) => {
                                                      reject(e);
                                                    });
                                                });
                                                toast.promise(action, {
                                                  loading: 'Removing claim',
                                                  success: 'Successfully removed claim',
                                                  error: 'Failed to remove claim',
                                                });
                                              }}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }) : (thisRoleClaims as string[]).map((claimedUserId) => {
                                    const claimData =
                                      (server?.claims as { [userId: string]: SessionClaim })[claimedUserId];

                                    return (
                                      <div
                                        key={`${claimedUserId}-${serverKey}`}
                                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2"
                                      >
                                        <RobloxUserSearch
                                          defaultUser={claimedUserId}
                                          color="blue"
                                          size="small"
                                          className="col-span-2"
                                          groupId={groupId}
                                          enableIcon={true}
                                          easySelf={true}
                                          onSelectUser={(userId) => {
                                            const action = new Promise<void>((resolve, reject) => {
                                              updateClaimSessionRoleForServer
                                                .mutateAsync({
                                                  groupId,
                                                  sessionId: sessionId,
                                                  serverId: serverKey,
                                                  roleId: role_template.id,
                                                  subroleId: role.id,
                                                  oldUserId: claimedUserId,
                                                  userId,
                                                })
                                                .then(() => {
                                                  resolve();
                                                  utils.workspaces.workspace.sessions.v2.getSessionData.invalidate(
                                                    { groupId, sessionId },
                                                  );
                                                })
                                                .catch((e) => {
                                                  reject(e);
                                                });
                                            });

                                            toast.promise(action, {
                                              loading: 'Claiming role',
                                              success: 'Successfully claimed role',
                                              error: 'Failed to claim role',
                                            });
                                          }}
                                        />
                                        <div className="flex flex-col gap-0.5 text-sm text-gray-500 dark:text-gray-400 sm:items-end sm:text-right grow">
                                          <span>
                                            claimed <ReactTimeago
                                              date={
                                                claimData?.claimedAt || new Date()
                                              }
                                            />
                                          </span>
                                          <TextReturnForUserId
                                            userId={claimData?.claimedBy || ''}
                                            includeImage={true}
                                            prefix="claimed by "
                                          />
                                        </div>

                                        <div className="flex flex-row gap-2 shrink-0">
                                          <Button variant="primary" icon={UserIcon} title="View who claimed this" onClick={() => {
                                            router.push(`/workspaces/${groupId}/users/${claimData?.claimedBy}`)
                                          }} />
                                          {(workspace.department.permissions.admin || workspace.department.permissions.sessions.manage) && (
                                            <Button
                                              icon={TrashIcon}
                                              variant="danger"
                                              onClick={() => {
                                                const action = new Promise<void>((resolve, reject) => {
                                                  removeUserSessionClaimForServer
                                                    .mutateAsync({
                                                      groupId,
                                                      sessionId: sessionId,
                                                      serverId: serverKey,
                                                      userId: claimedUserId,
                                                    })
                                                    .then(() => {
                                                      resolve();
                                                      utils.workspaces.workspace.sessions.v2.getSessionData.invalidate(
                                                        { groupId, sessionId },
                                                      );
                                                    })
                                                    .catch((e) => {
                                                      reject(e);
                                                    });
                                                });
                                                toast.promise(action, {
                                                  loading: 'Removing claim',
                                                  success: 'Successfully removed claim',
                                                  error: 'Failed to remove claim',
                                                });
                                              }}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {thisRoleClaims.length === 0 && !canCreate && (
                                    <p className="text-sm italic text-gray-400 dark:text-gray-500 py-1">
                                      {isFull ? 'This role is full.' : 'No one has claimed this role yet.'}
                                    </p>
                                  )}

                                  {canCreate && (
                                    <RobloxUserSearch
                                      color="blue"
                                      size="small"
                                      className="col-span-2"
                                      placeholder={'Select user'}
                                      groupId={groupId}
                                      enableIcon={false}
                                      easySelf={true}
                                      onSelectUser={async (userId) => {
                                        const action = claimSessionRoleForServer
                                          .mutateAsync({
                                            groupId,
                                            sessionId: sessionId,
                                            serverId: serverKey,
                                            roleId: role_template.id,
                                            subroleId: role.id,
                                            userId,
                                          })
                                          .then(() => {
                                            utils.workspaces.workspace.sessions.v2.getSessionData.invalidate(
                                              { groupId, sessionId },
                                            );
                                          });

                                        toast.promise(action, {
                                          loading: 'Claiming role',
                                          success: 'Successfully claimed role',
                                          error: (e: any) => `Something went wrong while claiming a session: ${e.message}`
                                        });

                                        await action.catch(() => {});
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {Object.keys(sessionData.session.servers || {}).length != 0 && (
          <EmptyCardCreateState icon={DocumentPlusIcon} buttonText='Create Server' cbFunction={() => {
            createServer.mutateAsync({ groupId, sessionId }).then(() => {
              toast.success('Server added');
              utils.workspaces.workspace.sessions.v2.getSessionData.invalidate({ groupId, sessionId });
            }).catch(e => {
              toast.error('Error creating server');
            })
          }} />
        )}
      </div>

      <div className="mt-8 border-t border-gray-200 dark:border-gray-800 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold dark:text-gray-100">
            Session notes
            {comments && comments.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">{comments.length}</span>
            )}
          </h2>
        </div>

        <div>
          <CreatePost sessionId={sessionId} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {!comments && (
            <LoadingAnimation />
          )}
          {comments && comments.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              No notes yet. Add the first one above.
            </p>
          )}
          {comments && (
            <>
              {comments.map(comment => (
                //@ts-expect-error shut up
                <Post key={comment.id.toString()} post={comment} />
              ))}
            </>
          )}
        </div>
      </div>

    </>
  );
}



function Post({
  post,
}: {
  post: SessionCommentType & { authorInfo: UserInfo, thumbnail: string; };
}): JSX.Element {


  return (
    <>
      <div className={`flex items-start space-x-4 fade-in animate-in slide-in-from-left`}>
        <div className="flex shrink-0 justify-center">
          <img
            className="inline-block h-12 w-12 self-center align-middle rounded-full bg-blue-500 border shadow-lg"
            src={post?.thumbnail}
            alt="User icon"
          />
        </div>
        <div
          className={`p-3 min-w-0 flex-1 w-full bg-white overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition dark:text-gray-100 dark:bg-gray-800`}
        >
          <p>{post.note}</p>
          {post.attachments.length !== 0 && (
            <div className="flex flex-row gap-2 py-2">
              {post.attachments.map((attachment) => (
                <Attachment key={attachment} attachment={attachment} />
              ))}
            </div>
          )}
          <p className="text-sm font-medium text-gray-500">
            <ReactTimeago date={post.created} /> - {post?.authorInfo?.name}
          </p>
        </div>
      </div>
    </>
  );
}

function CreatePost({ sessionId }: { sessionId: string }) {
  const workspace = useWorkspace();
  const mutation =
    trpc.workspaces.workspace.sessions.v2.postSessionComment.useMutation();
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
            sessionId,
            comment,
            files: fileData,
          })
          .then(() => {

            toast.success('Succesfully posted user note.');
            context.workspaces.workspace.sessions.v2.getSessionComments.invalidate({ groupId: workspace.groupId, sessionId });
          })
          .catch((e) => {
            alert(e.message);
          });
      }}
    >
    </CommentPost>
  );
}


DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSessionSidebarNavigationLayout>{page}</WorkspaceSessionsSessionSidebarNavigationLayout>
);
