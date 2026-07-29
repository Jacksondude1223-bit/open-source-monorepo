/* eslint-disable @next/next/no-img-element */
'use client';

import { useRouter } from 'next/router';
import { ReactElement, useState, useRef, useEffect } from 'react';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import LoadingPage from '~/components/layouts/LoadingPage';
import TextLabel from '~/components/forms/TextLabel';
import Button from '~/components/forms/Button';
import toast from 'react-hot-toast';
import { getProcessedUserObjectType } from '~/services/roblox.service';
import Link from 'next/link';
import { useUser } from '~/components/contexts/user';
import { ArrayToValueType, RouterOutput } from '~/server/routers/_app';
import Modal from '~/components/ui/Modal';
import { PaperAirplaneIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
    const router = useRouter();
    const { groupId, callId }: { groupId: string; callId: string } = router.query as any;
    const workspace = useWorkspace();
    const user = useUser();
    const { data: ongoingCall, isLoading } = trpc.workspaces.workspace.calls.getCallById.useQuery({
        groupId,
        callId
    }, {
        refetchInterval: 5000
    })

    const context = trpc.useUtils();
    const claimCallMutation = trpc.workspaces.workspace.calls.claimCall.useMutation();
    const releaseCallMutation = trpc.workspaces.workspace.calls.releaseCall.useMutation();
    const closeCallMutation = trpc.workspaces.workspace.calls.closeCall.useMutation();
    const sendMessageMutation = trpc.workspaces.workspace.calls.sendMessage.useMutation();

    const [closingCall, setClosingCall] = useState<false | ArrayToValueType<RouterOutput["workspaces"]["workspace"]["calls"]["getOngoingTickets"]>>(false);
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const messages = ongoingCall && 'call' in ongoingCall ? ongoingCall?.call?.messages : undefined;
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages?.length]);

    if (!('user' in user)) {
        return <></>;
    }

    if (isLoading) {
        return <LoadingPage />
    }
    if (ongoingCall == null) {
        if (typeof window !== 'undefined') {
            router.push(`/workspaces/${groupId}/calls`)
        }
        return (<></>);
    }
    if (ongoingCall.call == null) {
        if (typeof window !== 'undefined') {
            router.push(`/workspaces/${groupId}/calls`)
        }
        return (<></>);
    }


    const canManage = workspace?.department?.permissions?.calls?.manage || workspace?.department?.permissions?.admin || false;
    const canViewGames = workspace?.department?.permissions?.games?.view || workspace?.department?.permissions?.admin || false;
    const canViewUsers = workspace?.department?.permissions?.activity?.view || workspace?.department?.permissions?.admin || false;
    const gameId = ongoingCall?.call?.gameId;
    const runningGameId = ongoingCall?.call?.runningGameId?.toString();
    const serverUrl = gameId && runningGameId ? `/workspaces/${groupId}/games/${gameId}/running/${runningGameId}` : null;

    const handleSend = () => {
        if (!messageText.trim()) return;
        const message = messageText.trim();
        setMessageText('');
        toast.promise(
            sendMessageMutation.mutateAsync({ groupId, callId, message }).then(() => {
                context.workspaces.workspace.calls.getCallById.invalidate({ groupId, callId });
            }),
            {
                loading: 'Sending message',
                success: 'Message sent',
                error: 'Failed to send message'
            }
        );
    };

    return (
        <>
            <PageHeading
                title={`${workspace?.groupName} Call with ${ongoingCall?.callerInfo?.name}`}
                description={`Call ID: ${callId}`}
                disableDivide={false}
                backUrl={`/workspaces/${groupId}/calls`}
            >
            </PageHeading>

            <div className='flex flex-row gap-2 justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex-wrap'>
                <div className='flex flex-row gap-2 flex-wrap'>
                    <div className='flex flex-row gap-2'>
                        <img src={ongoingCall?.callerInfo?.thumbnail} className='w-12 h-12 rounded-full bg-[#0989ea]' alt={`User thumbnail`} />
                        <div>
                            <Link href={`https://roblox.com/users/${ongoingCall.callerInfo.id}/profile`} target='_blank'>
                                <p className="hover:text-blue-500 transition">{ongoingCall?.callerInfo?.name}</p>
                                <p className="text-sm text-gray-500">{ongoingCall?.callerInfo?.id}</p>
                            </Link>
                            {canViewUsers && (
                                <Link
                                    href={`/workspaces/${groupId}/users/${ongoingCall.callerInfo.id}`}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    View staff profile
                                </Link>
                            )}
                        </div>
                    </div>
                    <div>
                        <p>Reason: {ongoingCall?.call?.reason}</p>
                        <p className="text-sm text-gray-500">Type: {ongoingCall?.call?.type}</p>
                        <p className="text-sm text-gray-500">
                            Game:{' '}
                            {canViewGames && serverUrl && ongoingCall?.call?.status !== 'closed' ? (
                                <Link href={serverUrl} className="text-blue-600 dark:text-blue-400 hover:underline">
                                    {ongoingCall?.gameInfo?.name || 'Unknown Game'} — view server
                                </Link>
                            ) : canViewGames && gameId ? (
                                <Link href={`/workspaces/${groupId}/games/${gameId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                    {ongoingCall?.gameInfo?.name || 'Unknown Game'}
                                </Link>
                            ) : (
                                <span>{ongoingCall?.gameInfo?.name || 'Unknown Game'}</span>
                            )}
                        </p>
                        {ongoingCall?.call?.reportedUser && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                Suspect: {ongoingCall.call.reportedUser}
                                {canViewGames && serverUrl && ongoingCall?.call?.status !== 'closed' && (
                                    <>
                                        {' '}
                                        <Link href={serverUrl} className="underline">
                                            (find in server)
                                        </Link>
                                    </>
                                )}
                            </p>
                        )}
                    </div>
                </div>
                <div className='flex flex-row gap-2 flex-wrap self-center align-middle justify-self-end'>
                    {ongoingCall?.gameInfo?.placeId && ongoingCall?.call?.status !== 'closed' && (
                        <Button variant="discrete" onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(`https://www.roblox.com/games/start?placeId=${ongoingCall.gameInfo!.placeId}&launchData=ReAdmin-Support`, '_blank');
                        }}>Join Game</Button>
                    )}
                    {canManage && ongoingCall?.call?.status !== 'closed' && (
                        <Button variant="blue"
                            disabled={ongoingCall?.call?.status == 'claimed' && (ongoingCall?.call?.claimedBy !== parseInt(user?.user?.dbUser?.robloxId || '0') && workspace.department.permissions.admin == false)}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const action = (mutation: typeof releaseCallMutation | typeof claimCallMutation) => {
                                    return new Promise<void>((resolve, reject) => {
                                        mutation.mutateAsync({ groupId, callId: ongoingCall?.call._id.toString() }).then(() => {
                                            resolve();
                                            context.workspaces.workspace.calls.getOngoingTickets.invalidate({ groupId });
                                        }).catch((e: any) => {
                                            reject(e);
                                        })
                                    });
                                }
                                if (ongoingCall?.call?.status == 'claimed') {
                                    toast.promise(action(releaseCallMutation), {
                                        loading: 'Releasing call',
                                        success: 'Call released',
                                        error: 'Failed to release call'
                                    });
                                } else {
                                    toast.promise(action(claimCallMutation), {
                                        loading: 'Claiming call',
                                        success: 'Call claimed',
                                        error: 'Failed to claim call'
                                    });
                                }
                            }}>{ongoingCall?.call?.status == 'claimed' ? 'Release' : 'Claim'}</Button>
                    )}
                    {canManage && ongoingCall?.call?.claimedBy == parseInt(user?.user?.dbUser?.robloxId || '0') && ongoingCall?.call?.status == 'claimed' && (<Button variant="danger" onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setClosingCall(ongoingCall.call);
                    }}>Close</Button>)}
                </div>

            </div >

            <div className='mt-3 flex flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden'>
                <div className='flex flex-col gap-1 h-[60vh] min-h-[400px] overflow-y-auto overflow-x-hidden p-4'>
                    {!ongoingCall?.call?.messages?.length ? (
                        <div className='flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500'>
                            <ChatBubbleLeftRightIcon className='h-12 w-12 mb-2' />
                            <p className='text-sm'>No messages yet.</p>
                        </div>
                    ) : (
                        ongoingCall?.call?.messages?.map((message, index) => {
                            const userInfo = (message as any)?.userInfo as getProcessedUserObjectType;
                            const time = message?.created ? new Date(message.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                            if (message.origin === 'systemMessage') {
                                return (
                                    <div key={message.id || index} className='flex justify-center my-2'>
                                        <span className='text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 rounded-full px-3 py-1'>
                                            {message.message}
                                        </span>
                                    </div>
                                );
                            }
                            const isAgent = message.origin === 'agent';
                            return (
                                <div key={message.id || index} className={`flex items-end gap-2 mb-2 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <img src={userInfo?.thumbnail} className={`w-8 h-8 rounded-full shrink-0 ${isAgent ? 'bg-[#1ec357]' : 'bg-[#0989ea]'}`} alt='User thumbnail' />
                                    <div className={`flex flex-col max-w-[75%] ${isAgent ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-3 py-2 rounded-2xl text-sm text-white break-words ${isAgent ? 'bg-[#1ec357] rounded-br-sm' : 'bg-[#0989ea] rounded-bl-sm'}`}>
                                            {message.message}
                                        </div>
                                        <span className='text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 px-1'>
                                            {userInfo?.name}{time && ` · ${time}`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {canManage && ongoingCall?.call?.status !== 'closed' ? (
                    <form
                        className='flex flex-row gap-2 items-center border-t border-gray-200 dark:border-gray-800 p-3 bg-white dark:bg-gray-900'
                        onSubmit={(f) => {
                            f.preventDefault();
                            handleSend();
                        }}
                    >
                        <TextLabel
                            id="message"
                            className='w-full'
                            placeholder="Type a message here"
                            value={messageText}
                            onChange={(value: string) => setMessageText(value)}
                        />
                        <Button type="submit" variant="blue" className='px-3 shrink-0' disabled={!messageText.trim() || sendMessageMutation.isPending}>
                            <PaperAirplaneIcon className='h-5 w-5' />
                        </Button>
                    </form>
                ) : (
                    <p className="text-center text-sm text-gray-500 p-3 border-t border-gray-200 dark:border-gray-800">
                        {ongoingCall?.call?.status === 'closed' ? 'This call is closed.' : 'You do not have permission to reply to this call.'}
                    </p>
                )}
            </div>

            <Modal
                open={closingCall !== false}
                setOpen={() => setClosingCall(false)}
            >
                {closingCall !== false && (<>
                    <PageHeading title={`Do you really want to close this call by ${ongoingCall.callerInfo.name}`} disableDivide={false} />
                    <div className="flex flex-row gap-2">
                        <Button className='w-full' variant="blue" onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setClosingCall(false);
                        }}>Cancel Closing</Button>
                        <Button className='w-full' variant="light_danger" onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toast.promise(closeCallMutation.mutateAsync({ groupId, callId: closingCall._id.toString(), reason: 'closedByUser' }), {
                                loading: 'Closing call',
                                success: 'Call closed',
                                error: 'Failed to close call'
                            });
                            setClosingCall(false);
                        }}>Close Call</Button>
                    </div>
                </>)}
            </Modal>

        </>
    );
}

DashboardPage.getLayout = (page: ReactElement) => (
    <WorkspaceLayout>{page}</WorkspaceLayout>
);
