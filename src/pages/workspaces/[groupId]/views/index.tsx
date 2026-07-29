/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import WorkspaceViewSidebarNavigationLayout from '~/components/page_components/workspaces/views/WorkspaceViewSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';

export default function WorkspacePage() {
  const router = useRouter();
  const workspace = useWorkspace()
  const { groupId }: { groupId: string } = router.query as any;

  return (
    <>
      {(workspace?.department?.permissions?.reports?.view || workspace?.department?.permissions?.reports?.export) ? (<>
        <div className="relative isolate overflow-hidden bg-gray-900 px-6 pt-16 shadow-2xl sm:rounded-3xl sm:px-16 md:pt-24 lg:flex lg:gap-x-20 lg:px-24 lg:pt-0">
          <svg
            viewBox="0 0 1024 1024"
            className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
            aria-hidden="true"
          >
            <circle cx={512} cy={512} r={512} fill="url(#759c1415-0410-454c-8f7c-9a820de03641)" fillOpacity="0.7" />
            <defs>
              <radialGradient id="759c1415-0410-454c-8f7c-9a820de03641">
                <stop stopColor="#0063EB" />
                <stop offset={1} stopColor="#0063EB" />
              </radialGradient>
            </defs>
          </svg>
          <div className="mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Views let you Manage Better
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              This dynamic tool enables you to segment staff performance metrics into specific time frames, and refine the data with tailored filters and sorts. Discover the power of personalized analytics to optimize your team&apos;s efficiency and drive success.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6 lg:justify-start">
              <Link
                href={`/workspaces/${groupId}/views/create`}
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-xs hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get started
              </Link>
            </div>
          </div>
          <div className="relative mt-16 h-80 lg:mt-8">
            <img
              className="absolute left-0 top-0 w-[57rem] max-w-none rounded-md bg-white/5 ring-1 ring-white/10"
              src="https://readmin.app/app/views.png"
              alt="App screenshot"
              width={1824}
              height={1080}
            />
          </div>
        </div>
      </>) : (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Insufficient permissions</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You don&apos;t have permissions to manage or display any views in this workspace.</p>
        </div>
      )}

    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => {
  return (
    <WorkspaceViewSidebarNavigationLayout disablePadding={false}>
      {page}
    </WorkspaceViewSidebarNavigationLayout>
  );
};
