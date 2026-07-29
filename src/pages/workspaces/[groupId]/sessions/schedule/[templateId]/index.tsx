'use client';

import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';
import Button from '~/components/forms/Button';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';

export default function DashboardPage() {
    const router = useRouter();
    const { groupId }: { groupId: string } = router.query as any;
    const workspace = useWorkspace();

    // Redirect to main schedule page for better UX with inline editing
    useEffect(() => {
        const timer = setTimeout(() => {
            router.push(`/workspaces/${groupId}/sessions/schedule`);
        }, 3000);

        return () => clearTimeout(timer);
    }, [router, groupId]);

    const permissions = workspace.department.permissions.sessions;

    if (!permissions.manage) {
        return (
            <>
                <PageHeading
                    title={`${workspace?.groupName} Sessions`}
                    disableDivide={true}
                />
                <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <p className="text-lg font-bold">You don&apos;t have permission to manage sessions</p>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">If you believe this is a mistake, contact one of your group admins.</p>
                </div>
            </>
        );
    }

    return (
        <>
            <PageHeading
                title={`${workspace?.groupName} Sessions`}
                disableDivide={true}
                backUrl={`/workspaces/${groupId}/sessions/schedule`}
            />

            <div className="max-w-md mx-auto text-center py-12">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Improved Template Management
                    </h2>
                    <p className="text-blue-700 dark:text-blue-300 mb-4">
                        We've improved the template management experience! You can now edit and delete templates directly from the main schedule page using convenient inline modals.
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                        Redirecting you to the main schedule page in a few seconds...
                    </p>
                </div>

                <Button
                    variant="primary"
                    size="medium"
                    icon={ArrowLeftIcon}
                    onClick={() => router.push(`/workspaces/${groupId}/sessions/schedule`)}
                >
                    Go to Schedule Page
                </Button>
            </div>
        </>
    );
}

DashboardPage.getLayout = (page: ReactElement) => (
    <WorkspaceSessionsSidebarNavigationLayout>{page}</WorkspaceSessionsSidebarNavigationLayout>
);
