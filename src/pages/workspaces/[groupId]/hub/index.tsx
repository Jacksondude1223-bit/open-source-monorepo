'use client';

import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import HubLayout from '~/components/page_components/workspaces/hub/HubLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { trpc } from '~/utils/trpc';
import { BookOpenIcon, FolderIcon, PhotoIcon } from '@heroicons/react/24/outline';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const { data: containers } = trpc.workspaces.workspace.knowledge.getContainers.useQuery({ groupId });
  const openResource = trpc.workspaces.workspace.knowledge.openResource.useMutation();
  const workspace = useWorkspace();


  if (!containers) {
    return (
      <>
        <PageHeading title="Knowledge Hub" />
        <LoadingPage />
      </>
    )
  }

  return (
    <div className="space-y-6">
      {containers.length == 0 && (
        <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 font-semibold text-gray-900 dark:text-gray-100">
            No resources available
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            There are no visible information resources for you to see.
          </p>
        </div>
      )}

      {containers.map(container => (
        <div key={container._id.toString()} className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{container.name}</h2>
          </div>
          {container.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1 ml-7">{container.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ml-7">
            {container.resources.map(resource => (
              <button
                key={resource._id.toString()}
                onClick={() => {
                  openResource.mutateAsync({
                    groupId,
                    resourceId: resource._id.toString()
                  }).then(url => {
                    window.open(url as string, '_blank');
                  }).catch(e => {
                    console.error(e);
                  })
                }}
                className="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 overflow-hidden hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
              >
                <div className="aspect-video w-full overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                  {resource.previewThumbnail ? (
                    <img
                      src={resource.previewThumbnail}
                      alt={resource.name}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={`${resource.previewThumbnail ? 'hidden' : ''} w-full h-full flex flex-col items-center justify-center gap-2 p-8`}>
                    <PhotoIcon className="h-12 w-12 text-gray-200 dark:text-gray-600" />
                    <span className="text-xs font-medium text-gray-300 dark:text-gray-500">No preview available</span>
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="flex items-start gap-2">
                    <BookOpenIcon className="h-4 w-4 mt-0.5 text-gray-400 dark:text-gray-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {resource.name}
                      </p>
                      {resource.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {resource.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <HubLayout>{page}</HubLayout>
);
