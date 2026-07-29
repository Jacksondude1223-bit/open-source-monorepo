import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon, PaperAirplaneIcon, UserIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { trpc } from '~/utils/trpc';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import TextLabel from '~/components/forms/TextLabel';
import Button from '~/components/forms/Button';
import toast from 'react-hot-toast';
import { getProcessedUserObjectType } from '~/services/roblox.service';
import Link from 'next/link';
import ReactTimeago from 'react-timeago';

interface ChatDrawerProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    call: any;
    groupId: string;
}

export default function ChatDrawer({ open, setOpen, call, groupId }: ChatDrawerProps) {
    const user = useUser();
    const workspace = useWorkspace();
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const canManage = workspace?.department?.permissions?.calls?.manage || workspace?.department?.permissions?.admin || false;
    const canViewGames = workspace?.department?.permissions?.games?.view || workspace?.department?.permissions?.admin || false;
    const canViewUsers = workspace?.department?.permissions?.activity?.view || workspace?.department?.permissions?.admin || false;

    const { data: callData, refetch } = trpc.workspaces.workspace.calls.getCallById.useQuery({
        groupId,
        callId: call?._id?.toString() || ''
    }, {
        enabled: open && !!call?._id,
        refetchInterval: 1000
    });

    // The drawer can be opened either with a fully-hydrated `call` (from the
    // ongoing-calls widget) or with just an `_id` (e.g. right after starting a
    // chat from a player/user page). Fall back to the fetched record so the
    // header and quick-actions render correctly in both cases.
    const fetched = callData?.call;
    const view = {
        _id: call?._id,
        status: call?.status ?? fetched?.status,
        type: call?.type ?? fetched?.type,
        reason: call?.reason ?? fetched?.reason,
        reportedUser: call?.reportedUser ?? fetched?.reportedUser,
        created: call?.created ?? fetched?.created,
        placeId: call?.placeId ?? fetched?.placeId,
        runningGameId: call?.runningGameId ?? fetched?.runningGameId,
        callerInfo: call?.callerInfo ?? (callData?.callerInfo
            ? { id: callData.callerInfo.id, name: callData.callerInfo.name, thumbnail: callData.callerInfo.thumbnail }
            : undefined),
        gameInfo: {
            name: call?.gameInfo?.name ?? callData?.gameInfo?.name,
            placeId: call?.gameInfo?.placeId ?? callData?.gameInfo?.placeId,
        },
    };

    const serverUrl = view?.placeId && view?.runningGameId
        ? `/workspaces/${groupId}/games/${view.placeId}/running/${view.runningGameId.toString()}`
        : null;

    const sendMessageMutation = trpc.workspaces.workspace.calls.sendMessage.useMutation();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [callData?.call?.messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !call) return;

        try {
            await sendMessageMutation.mutateAsync({
                groupId,
                callId: call._id.toString(),
                message: messageText
            });
            setMessageText('');
            refetch();
        } catch (error) {
            toast.error('Failed to send message');
        }
    };

    const renderMessage = (message: any, index: number) => {
        const userInfo = (message as any)?.userInfo as getProcessedUserObjectType;

        switch (message.origin) {
            case 'agent':
                return (
                    <div key={index} className="flex justify-end mb-4">
                        <div className="flex items-end space-x-2 max-w-xs lg:max-w-md">
                            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg rounded-br-none">
                                <p className="text-sm">{message.message}</p>
                            </div>
                            <img
                                src={userInfo?.thumbnail}
                                className="w-8 h-8 rounded-full"
                                alt="Agent avatar"
                            />
                        </div>
                    </div>
                );

            case 'user':
                return (
                    <div key={index} className="flex justify-start mb-4">
                        <div className="flex items-end space-x-2 max-w-xs lg:max-w-md">
                            <img
                                src={userInfo?.thumbnail}
                                className="w-8 h-8 rounded-full"
                                alt="User avatar"
                            />
                            <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg rounded-bl-none">
                                <p className="text-sm">{message.message}</p>
                            </div>
                        </div>
                    </div>
                );

            case 'systemMessage':
                return (
                    <div key={index} className="flex justify-center mb-4">
                        <div className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full text-xs">
                            {message.message}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (!call) return null;

    return (
        <Transition show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={setOpen}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-25"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-25"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black opacity-50" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed bottom-0 right-0 flex max-w-full pl-10">
                            <TransitionChild
                                as={Fragment}
                                enter="transform transition ease-in-out duration-300"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-300"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <DialogPanel className="pointer-events-auto w-screen max-w-md">
                                    <div className="flex h-full max-h-[80vh] flex-col bg-white dark:bg-gray-900 shadow-xl rounded-t-lg border border-gray-200 dark:border-gray-700">
                                        {/* Header */}
                                        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-t-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <img
                                                        src={view?.callerInfo?.thumbnail}
                                                        className="w-10 h-10 rounded-full"
                                                        alt="User avatar"
                                                    />
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                                            {view?.callerInfo?.name}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            {view.reason}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    onClick={() => setOpen(false)}
                                                >
                                                    <XMarkIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            {/* Call metadata */}
                                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                {canViewGames && serverUrl && view?.status !== 'closed' ? (
                                                    <Link href={serverUrl} className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 hover:underline">
                                                        {view?.gameInfo?.name || 'Unknown Game'}
                                                    </Link>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                                                        {view?.gameInfo?.name || 'Unknown Game'}
                                                    </span>
                                                )}
                                                {view.type === 'report' && view.reportedUser && (
                                                    canViewGames && serverUrl && view?.status !== 'closed' ? (
                                                        <Link href={serverUrl} title="Find this user in the server" className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 hover:underline">
                                                            <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                                                            {view.reportedUser}
                                                        </Link>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200">
                                                            <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                                                            {view.reportedUser}
                                                        </span>
                                                    )
                                                )}
                                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                    <ReactTimeago date={view.created} />
                                                </span>
                                            </div>
                                        </div>

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                                            {callData?.call?.messages?.length ? (
                                                callData.call.messages.map((message, index) => renderMessage(message, index))
                                            ) : (
                                                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                                                    <UserIcon className="mx-auto h-12 w-12 mb-2" />
                                                    <p>No messages yet. Start the conversation!</p>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Message input */}
                                        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                                            {canManage && view?.status !== 'closed' ? (
                                                <form onSubmit={handleSendMessage} className="flex space-x-2">
                                                    <TextLabel
                                                        value={messageText}
                                                        onChange={(value) => setMessageText(value)}
                                                        placeholder="Type your message..."
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        type="submit"
                                                        variant="blue"
                                                        disabled={!messageText.trim() || sendMessageMutation.isPending}
                                                        className="px-3"
                                                    >
                                                        <PaperAirplaneIcon className="h-5 w-5" />
                                                    </Button>
                                                </form>
                                            ) : (
                                                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                                                    {view?.status === 'closed' ? 'This call is closed.' : 'You do not have permission to reply.'}
                                                </p>
                                            )}
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800">
                                            <div className="flex flex-wrap gap-2">
                                                <Link
                                                    href={`https://roblox.com/users/${view?.callerInfo?.id}/profile`}
                                                    target="_blank"
                                                    className="flex-1 min-w-30"
                                                >
                                                    <Button variant="discrete" size="small" className="w-full">
                                                        Roblox Profile
                                                    </Button>
                                                </Link>

                                                {canViewUsers && (
                                                    <Link
                                                        href={`/workspaces/${groupId}/users/${view?.callerInfo?.id}`}
                                                        className="flex-1 min-w-30"
                                                    >
                                                        <Button variant="discrete" size="small" className="w-full">
                                                            Staff Profile
                                                        </Button>
                                                    </Link>
                                                )}

                                                {canViewGames && serverUrl && (
                                                    <Link href={`${serverUrl}/chats`} className="flex-1 min-w-30">
                                                        <Button variant="discrete" size="small" className="w-full">
                                                            Game Chat
                                                        </Button>
                                                    </Link>
                                                )}

                                                {canViewGames && serverUrl && view?.status !== 'closed' && (
                                                    <Link href={serverUrl} className="flex-1 min-w-30">
                                                        <Button variant="discrete" size="small" className="w-full">
                                                            View Server
                                                        </Button>
                                                    </Link>
                                                )}

                                                {view?.gameInfo?.placeId && view?.status !== 'closed' && (
                                                    <Button
                                                        variant="discrete"
                                                        size="small"
                                                        className="flex-1 min-w-30"
                                                        onClick={() => {
                                                            window.open(
                                                                `https://www.roblox.com/games/start?placeId=${view.gameInfo.placeId}&launchData=ReAdmin-Support`,
                                                                '_blank'
                                                            );
                                                        }}
                                                    >
                                                        Join Game
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
