import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { User } from '~/services/NewMongoTypes';
import { trpc } from '~/utils/trpc';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import { Fragment } from 'react';
import ReactTimeago from 'react-timeago';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface UserDetailsModalProps {
    open: boolean;
    onClose: () => void;
    userId: string | null;
}

export default function UserDetailsModal({ open, onClose, userId }: UserDetailsModalProps) {
    const { data: user, isLoading, error } = trpc.admin.users.getUserDetails.useQuery(
        { userId: userId || '' },
        { enabled: Boolean(userId) }
    );

    const refreshRobloxInfo = trpc.admin.users.refreshRobloxInfo.useMutation();

    const handleRefreshRobloxInfo = async () => {
        if (!user?.robloxId) return;
        try {
            const result = await refreshRobloxInfo.mutateAsync({ robloxId: user.robloxId.toString() });
            if (result.success) {
                toast.success('Roblox info refreshed');
            } else if (result.status === 'no_oauth') {
                toast.error('No OAuth-linked workspace available to sync this user');
            } else {
                toast.error('Failed to refresh Roblox info');
            }
        } catch {
            toast.error('Failed to refresh Roblox info');
        }
    };

    if (!userId) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                <div className="flex items-center justify-between gap-4">
                    <span>User Details</span>
                    {user?.robloxId && (
                        <Button
                            onClick={handleRefreshRobloxInfo}
                            disabled={refreshRobloxInfo.isPending}
                            variant="primary"
                            className="flex items-center gap-2"
                        >
                            <ArrowPathIcon className={`w-4 h-4 ${refreshRobloxInfo.isPending ? 'animate-spin' : ''}`} />
                            {refreshRobloxInfo.isPending ? 'Refreshing...' : 'Refresh Roblox Info'}
                        </Button>
                    )}
                </div>
            </DialogTitle>
            <DialogContent>
                {isLoading && (
                    <div className="flex justify-center py-8">
                        <LoadingAnimation />
                    </div>
                )}

                {error && (
                    <div className="text-red-600 dark:text-red-400 p-4 text-center">
                        Error loading user details: {error.message}
                    </div>
                )}

                {user && (
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div className="bg-gray-800 rounded-lg p-4">
                            <h3 className="font-semibold text-lg mb-3">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                                    <p className="font-medium">{user.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Roblox ID</label>
                                    <Link
                                        href={`https://roblox.com/users/${user.robloxId}/profile`}
                                        target="_blank"
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        {user.robloxId}
                                    </Link>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Stripe ID</label>
                                    <p className="font-medium">{user.stripeId || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                                    <p className="font-medium">
                                        <ReactTimeago date={user.created} />
                                        <span className="text-sm text-gray-500 ml-1">
                                            ({new Date(user.created).toLocaleString()})
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Account Status */}
                        <div className="bg-gray-800 rounded-lg p-4">
                            <h3 className="font-semibold text-lg mb-3">Account Status</h3>
                            {user.isModerated ? (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <div className="flex items-center mb-2">
                                        <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded-full text-sm font-medium">
                                            {user.isModerated.type === 'ban' ? 'Banned' : 'Warning'}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-sm font-medium text-red-700 dark:text-red-300">Reason</label>
                                            <p className="text-red-800 dark:text-red-200">{user.isModerated.reason}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-red-700 dark:text-red-300">Moderated By</label>
                                            <p className="text-red-800 dark:text-red-200">{user.isModerated.bannedBy}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-sm font-medium">
                                        Active
                                    </span>
                                    <p className="text-green-700 dark:text-green-300 mt-2">Account is in good standing</p>
                                </div>
                            )}
                        </div>

                        {/* Additional Information */}
                        {(user.role || user.discordId) && (
                            <div className="bg-gray-800 rounded-lg p-4">
                                <h3 className="font-semibold text-lg mb-3">Additional Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {user.role && (
                                        <div>
                                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</label>
                                            <p className="font-medium">{user.role}</p>
                                        </div>
                                    )}
                                    {user.discordId && (
                                        <div>
                                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Discord ID</label>
                                            <p className="font-medium">{user.discordId}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
