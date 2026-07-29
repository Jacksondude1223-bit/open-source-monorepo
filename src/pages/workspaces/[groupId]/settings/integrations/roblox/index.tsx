/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { PropsWithChildren, ReactElement, useEffect } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import { trpc } from '~/utils/trpc';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import toast from 'react-hot-toast';
import { GetServerSideProps } from 'next';
import { createAuthedCaller } from '~/server/routers/_app';


export const getServerSideProps: GetServerSideProps = async (context) => {
    return new Promise(async (resolve) => {
        const { req, res } = context;
        const caller = await createAuthedCaller(context);
        if (caller === false) {
            return resolve({
                redirect: {
                    destination: '/',
                    permanent: false,
                },
            });
        }
        const { code, groupId, returnTo } = context.query as { code: string; groupId: string; returnTo?: string; };
        if (!code) {
            return resolve({
                redirect: {
                    destination: '/',
                    permanent: false,
                },
            });
        }

        caller.workspaces.workspace.settings.integrations.roblox_oauth({ code, groupId })
            .then((resp) => {
                console.log(resp)

                // If the link was kicked off from the workspace creation flow, return
                // there so it can show the "finished" screen once the first sync runs.
                if (returnTo === 'create') {
                    return resolve({
                        redirect: {
                            destination: `/workspaces/create?resume_finish_creating=${groupId}&oauth_linked=true`,
                            permanent: false,
                        },
                    });
                }

                return resolve({
                    props: { success: true },
                });
            })
            .catch((err) => {
                console.log(err)
                return resolve({
                    props: { errMsg: err.message },
                });
            });
    });
};

export default function DashboardPage(props: PropsWithChildren<{ success: boolean } | { errMsg: string }>) {
    const { success, errMsg } = props as any;
    const router = useRouter();

    const workspace = useWorkspace();

    if (!workspace) {
        return <LoadingPage />;
    }
    useEffect(() => {
        if (typeof (workspace) == 'undefined' || !router?.isReady) {
            return;
        }
        if (success == true) {
            toast.success('Roblox account linked successfully');
            router.push(`/workspaces/${workspace.groupId}/settings/integrations`);
        }
        if (errMsg) {
            toast.error(errMsg);
            router.push(`/workspaces/${workspace.groupId}/settings/integrations`);
        }

    }, [success, errMsg, router, router.isReady]);



    if (!workspace?.premium?.is) {
        return (
            <>
                <PageHeading
                    title={`${workspace?.groupName} Integrations`}
                />

                <div className='flex flex-col gap-2 mt-2'>
                    <h1 className='my-4 text-2xl font-bold text-center'>Automate your ranking, and join-requests on Roblox, and perform actions through Discord</h1>
                    <img src="https://cdn.readmin.app/readmin-public/ManageServersUpsale.jpeg" className='self-center align-middle max-h-[500px] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700' alt="activity upsale image" />
                    <WorkspaceUpsale />
                </div>
            </>
        )
    }

    return (
        <>
            <PageHeading
                title={`${workspace?.groupName} Intergrations`}
            />

            <LoadingAnimation />

            <p>Please wait...</p>

        </>
    );
}

DashboardPage.getLayout = (page: ReactElement) => (
    <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
