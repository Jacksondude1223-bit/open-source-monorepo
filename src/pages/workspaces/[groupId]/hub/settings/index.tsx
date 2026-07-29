'use client';

import { useRouter } from 'next/router';
import { ReactElement, useRef, useState } from 'react';
import HubLayout from '~/components/page_components/workspaces/hub/HubLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import PageHeading from '~/components/layouts/PageHeading';
import { trpc } from '~/utils/trpc';
import LoadingPage from '~/components/layouts/LoadingPage';
import Modal from '~/components/ui/Modal';
import InputLabel from '~/components/forms/InputLabel';
import Button from '~/components/forms/Button';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import toast from 'react-hot-toast';
import { FolderPlusIcon, PencilIcon, SquaresPlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import { HubContainer, HubResource } from '~/services/NewMongoTypes';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import TextLabel from '~/components/forms/TextLabel';
import { PhotoIcon, ArrowUpTrayIcon, DocumentIcon, LinkIcon } from '@heroicons/react/24/outline';
import ReadFile from '~/utils/FileReader';


export function ResourceEditCard({ resource, setDeletingResource }: { resource: HubResource, setDeletingResource: (resource: HubResource) => void }) {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const updateResource = trpc.workspaces.workspace.knowledge.updateResource.useMutation();
  const removeResourceCover = trpc.workspaces.workspace.knowledge.removeCover.useMutation();
  const utils = trpc.useUtils();
  const [coverChangable, setCoverChangable] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resourceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [switchToUrlModal, setSwitchToUrlModal] = useState(false);

  return (
    <div
      key={(resource._id || '').toString()}
      className="w-full overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-md"
      onMouseEnter={() => { setCoverChangable(true) }}
      onMouseLeave={() => { setCoverChangable(false) }}
    >
      {/* Cover Image */}
      <div className='relative'>
        {resource.previewThumbnail ? (
          <img
            src={resource.previewThumbnail}
            alt="Resource thumbnail"
            className="w-full aspect-video object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
          />
        ) : null}
        <div className={`${resource.previewThumbnail ? 'hidden' : ''} aspect-video w-full flex flex-col items-center justify-center gap-2 p-10 bg-gray-50 dark:bg-gray-700/30`}>
          <PhotoIcon className="h-12 w-12 text-gray-200 dark:text-gray-600" />
          <span className="text-xs font-medium text-gray-300 dark:text-gray-500">No cover image</span>
        </div>
        {coverChangable && (
          <div className="absolute inset-0 bg-black/20 flex items-start justify-end p-3 transition-opacity">
            {resource?.coverImage ? (
              <Button variant="danger" size="small" icon={PhotoIcon} onClick={(event) => {
                event.preventDefault();
                removeResourceCover.mutateAsync({ groupId, resourceId: (resource?._id || '').toString() }).then(() => {
                  toast.success('Successfully removed resource cover')
                  utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
                }).catch(e => {
                  toast.error(e.message)
                });
              }}>Remove</Button>
            ) : (
              <Button variant="primary" size="small" icon={PhotoIcon} onClick={(event) => {
                event.preventDefault();
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}>Set Cover</Button>
            )}
          </div>
        )}
        <input type="file" accept='image/png, image/jpeg, image/jpg' className='hidden' ref={fileInputRef} onChange={async (target) => {
          const file = target.target.files?.item(0);
          if (!file) {
            return;
          }

          const data = await ReadFile(file);
          if (!data) {
            return toast.error('Failed to read file');
          }

          updateResource.mutateAsync({ groupId, resourceId: (resource?._id || '').toString(), cover: [file.name, data.toString()] }).then(() => {
            toast.success('Successfully updated resource')
            utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
          }).catch(e => {
            toast.error(e.message)
          });
        }} />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title + Delete */}
        <div className="flex items-start gap-2">
          <TextLabel className="flex-1 text-base font-semibold border-0 pl-0 pt-0 mt-0" defaultValue={resource.name} onBlur={async (value) => {
            updateResource.mutateAsync({ groupId, resourceId: (resource?._id || '').toString(), name: value }).then(() => {
              toast.success('Successfully updated resource')
              utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
            }).catch(e => {
              toast.error(e.message)
            })
          }} />
          <button
            onClick={() => { setDeletingResource(resource) }}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <TextLabel className="text-sm text-gray-500 dark:text-gray-400 border-0 pl-0 pt-0 mt-0" placeholder="Add a description..." defaultValue={resource.description} onBlur={async (value) => {
          updateResource.mutateAsync({ groupId, resourceId: (resource?._id || '').toString(), description: value }).then(() => {
            toast.success('Successfully updated resource')
            utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
          }).catch(e => {
            toast.error(e.message)
          })
        }} />

        {/* Source Section */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
          {resource.cdnFilePath ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-green-50 dark:bg-green-900/15 text-sm">
                <DocumentIcon className="w-4 h-4 text-green-500 shrink-0" />
                <span className="font-medium text-green-700 dark:text-green-400 truncate">{resource.cdnFilePath.split('/').pop()}</span>
              </div>
              <div className="flex gap-2">
                <Button size="small" variant="discrete" icon={ArrowUpTrayIcon} disabled={uploadingFile} onClick={() => {
                  resourceFileInputRef.current?.click();
                }}>{uploadingFile ? 'Uploading...' : 'Replace'}</Button>
                <Button size="small" variant="discrete" icon={LinkIcon} onClick={() => {
                  setSwitchToUrlModal(true);
                }}>Use URL</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <TextLabel className="flex-1 text-sm border-0 pl-0 pt-0 mt-0" placeholder="https://..." defaultValue={resource.url} onBlur={async (value) => {
                  updateResource.mutateAsync({ groupId, resourceId: (resource?._id || '').toString(), url: value }).then(() => {
                    toast.success('Successfully updated resource')
                    utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
                  }).catch(e => {
                    toast.error(e.message)
                  })
                }} />
              </div>
              <Button size="small" variant="discrete" icon={ArrowUpTrayIcon} disabled={uploadingFile} onClick={() => {
                resourceFileInputRef.current?.click();
              }}>{uploadingFile ? 'Uploading...' : 'Upload File'}</Button>
            </div>
          )}
        </div>

        <input type="file" className="hidden" ref={resourceFileInputRef} onChange={async (target) => {
          const file = target.target.files?.item(0);
          if (!file) return;
          if (file.size > 50 * 1024 * 1024) {
            return toast.error('File must be under 50MB');
          }
          setUploadingFile(true);
          try {
            const data = await ReadFile(file);
            if (!data) {
              return toast.error('Failed to read file');
            }
            await updateResource.mutateAsync({ groupId, resourceId: (resource?._id || '').toString(), file: [file.name, data.toString()] });
            toast.success('File uploaded successfully');
            utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
          } catch (e: any) {
            toast.error(e.message);
          } finally {
            setUploadingFile(false);
            target.target.value = '';
          }
        }} />
      </div>

      <Modal open={switchToUrlModal} setOpen={setSwitchToUrlModal}>
        <PageHeading title="Switch to URL" />
        <form className="flex flex-col gap-3" onSubmit={async (f) => {
          f.preventDefault();
          const url = (f.target as any).url.value;
          setSwitchToUrlModal(false);
          updateResource.mutateAsync({ groupId, resourceId: (resource?._id || '').toString(), removeFile: true, url }).then(() => {
            toast.success('Switched to URL mode')
            utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
          }).catch((e: any) => toast.error(e.message));
        }}>
          <InputLabel id="url" label="Resource URL" placeholder="https://example.com/resource" />
          <Button variant="primary">Save URL</Button>
        </form>
      </Modal>
    </div>
  )
}

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const utils = trpc.useUtils();
  const { data: containers } = trpc.workspaces.workspace.knowledge.getContainers.useQuery({ groupId });
  const { data: departments } = trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({ groupId });
  const createContainer = trpc.workspaces.workspace.knowledge.createContainer.useMutation();
  const createResource = trpc.workspaces.workspace.knowledge.createResource.useMutation();
  const updateContainer = trpc.workspaces.workspace.knowledge.updateContainer.useMutation();
  const deleteContainer = trpc.workspaces.workspace.knowledge.deleteContainer.useMutation();
  const deleteResource = trpc.workspaces.workspace.knowledge.deleteResource.useMutation();

  const workspace = useWorkspace();

  const [creatingContainer, setCreatingContainer] = useState<boolean>(false);
  const [editingContainer, setEditingContainer] = useState<false | HubContainer>(false);
  const [deletingContainer, setDeletingContainer] = useState<false | HubContainer>(false);

  const [creatingResource, setCreatingResource] = useState<false | HubContainer>(false);
  const [deletingResource, setDeletingResource] = useState<false | HubResource>(false);

  const [creating, setCreating] = useState(false);
  const [departmentsSelected, setDepartmentsSelected] = useState([]);
  const [createResourceMode, setCreateResourceMode] = useState<'url' | 'file'>('url');
  const [createFileData, setCreateFileData] = useState<[string, string] | null>(null);

  if (!containers || !departments) {
    return (
      <>
        <PageHeading title="Knowledge Hub Content Settings" />

        <LoadingPage />
      </>
    )
  }

  return (
    <>
      <PageHeading title="Knowledge Hub Content Settings" />

      <div className="space-y-8">
        {containers.map(container => (
          <div key={container._id.toString()} className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/30 overflow-hidden">
            {/* Container Header */}
            <div className="px-5 py-4 flex flex-row justify-between flex-wrap items-center gap-3 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-700/40">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{container.name}</h3>
                {container.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{container.description}</p>
                )}
              </div>
              <div className="flex flex-row gap-2 shrink-0">
                <button
                  onClick={() => {
                    //@ts-expect-error literaly right
                    setEditingContainer(container);
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                  title="Edit container"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    //@ts-expect-error literaly right
                    setDeletingContainer(container);
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                  title="Delete container"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Resources Grid */}
            <div className="p-5">
              {container.resources.length === 0 ? (
                <div className="text-center py-6">
                  <SquaresPlusIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                  <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">No resources in this container yet</p>
                  <Button
                    variant="discrete"
                    size="small"
                    className="mt-3"
                    icon={SquaresPlusIcon}
                    //@ts-expect-error its right
                    onClick={() => { setCreatingResource(container) }}
                  >Add Resource</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {container.resources.map(resource => (
                    <ResourceEditCard key={resource?._id?.toString() || ''} resource={resource} setDeletingResource={setDeletingResource} />
                  ))}
                  <button
                    type="button"
                    //@ts-expect-error its right
                    onClick={() => { setCreatingResource(container) }}
                    className="flex flex-col items-center justify-center gap-2 min-h-[200px] rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
                  >
                    <SquaresPlusIcon className="h-8 w-8" />
                    <span className="text-sm font-medium">Add Resource</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Create Container */}
        <button
          type="button"
          onClick={() => setCreatingContainer(true)}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
        >
          <FolderPlusIcon className="h-8 w-8" />
          <span className="text-sm font-medium">Create Container</span>
        </button>
      </div>


      <Modal open={creatingContainer} setOpen={setCreatingContainer}>
        <PageHeading title='Create Info Resource Container' />
        <form className="flex flex-col gap-2" onSubmit={async (f) => {
          f.preventDefault();
          const form = f.target as any;
          const name = form.name.value;
          const description = form.description.value;
          const departments = departmentsSelected;

          createContainer.mutateAsync({ groupId, name, description, departments }).then(() => {
            toast.success('Successfully created container')
            utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
            setCreatingContainer(false);
          }).catch(e => {
            toast.error(e.message)
          })

        }}>
          <InputLabel id="name" label="Name" placeholder='Name of the container' />
          <InputLabel id="description" label="Description" placeholder='Describe the container' />
          <MultiSelectDropdown id="departments" label="Visible to departments" onSelectChoice={setDepartmentsSelected} choices={departments.map(department => {
            return {
              name: department.name,
              id: department._id.toString()
            }
          })} />
          <Button variant="primary">Create</Button>
        </form>
      </Modal>


      <Modal open={editingContainer !== false} setOpen={setEditingContainer}>
        {editingContainer !== false && (<>
          <PageHeading title={`Update Container ${editingContainer.name}`} />
          <form className="flex flex-col gap-2" onSubmit={async (f) => {
            f.preventDefault();
            const form = f.target as any;
            const name = form.name.value;
            const description = form.description.value;
            const departments = departmentsSelected;
            //@ts-expect-error it exists
            updateContainer.mutateAsync({ groupId, name, description, departments, containerId: editingContainer._id?.toString() }).then(() => {
              toast.success('Successfully created container')
              utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
              setCreatingContainer(false);
            }).catch(e => {
              toast.error(e.message)
            })

          }}>
            <InputLabel defaultValue={editingContainer.name} id="name" label="Name" placeholder='Name of the container' />
            <InputLabel defaultValue={editingContainer.description} id="description" label="Description" placeholder='Describe the container' />
            <MultiSelectDropdown defaultValue={editingContainer.visibleToDepartments.map(a => a.toString())} id="departments" label="Visible to departments" onSelectChoice={setDepartmentsSelected} choices={departments.map(department => {
              return {
                name: department.name,
                id: department._id.toString()
              }
            })} />
            <Button variant="primary">Edit</Button>
          </form>
        </>)}
      </Modal>


      <Modal open={creatingResource !== false} setOpen={() => { setCreatingResource(false); setCreateResourceMode('url'); setCreateFileData(null); }}>
        {creatingResource !== false && (
          <>
            <PageHeading title={`Create Info Resource for ${creatingResource.name}`} />
            {creating ? (
              <LoadingAnimation />
            ) : (
              <form className="flex flex-col gap-2" onSubmit={async (f) => {
                f.preventDefault();
                const form = f.target as any;
                const name = form.name.value;
                const description = form.description.value;
                setCreating(true);

                const payload: any = {
                  groupId,
                  name,
                  description,
                  containerId: creatingResource?._id?.toString() || ''
                };

                if (createResourceMode === 'url') {
                  payload.url = form.url.value;
                } else if (createFileData) {
                  payload.file = createFileData;
                } else {
                  setCreating(false);
                  return toast.error('Please select a file to upload');
                }

                createResource.mutateAsync(payload).then(() => {
                  toast.success('Successfully created resource')
                  utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
                  setCreatingResource(false);
                  setCreating(false);
                  setCreateResourceMode('url');
                  setCreateFileData(null);
                }).catch(e => {
                  toast.error(e.message)
                  setCreating(false);
                })

              }}>
                <InputLabel id="name" label="Name" placeholder='Name of the resource' />
                {/* Optional, to match the inline editor — which has always let
                    the description be cleared. */}
                <InputLabel id="description" label="Description (optional)" required={false} placeholder='Describe the resource' />

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Resource Type</label>
                  <div className="flex gap-2">
                    <button type="button" className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      createResourceMode === 'url'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-400'
                        : 'border-gray-200 bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 hover:border-gray-300'
                    }`} onClick={() => { setCreateResourceMode('url'); setCreateFileData(null); }}>
                      <LinkIcon className="w-4 h-4" />
                      URL
                    </button>
                    <button type="button" className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      createResourceMode === 'file'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-400'
                        : 'border-gray-200 bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 hover:border-gray-300'
                    }`} onClick={() => setCreateResourceMode('file')}>
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      Upload File
                    </button>
                  </div>
                </div>

                {createResourceMode === 'url' ? (
                  <InputLabel id="url" label="URL to Resource" placeholder='Link to the resource' />
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">File</label>
                    <div className={`relative flex items-center justify-center border-2 border-dashed rounded-lg p-6 transition ${
                      createFileData
                        ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}>
                      <label className="flex flex-col items-center gap-2 cursor-pointer">
                        {createFileData ? (
                          <>
                            <DocumentIcon className="w-8 h-8 text-green-500" />
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">{createFileData[0]}</span>
                            <span className="text-xs text-gray-500">Click to change</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpTrayIcon className="w-8 h-8 text-gray-400" />
                            <span className="text-sm text-gray-500">Click to select a file (max 50MB)</span>
                          </>
                        )}
                        <input type="file" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.item(0);
                          if (!file) return;
                          if (file.size > 50 * 1024 * 1024) {
                            return toast.error('File must be under 50MB');
                          }
                          const data = await ReadFile(file);
                          if (!data) return toast.error('Failed to read file');
                          setCreateFileData([file.name, data.toString()]);
                        }} />
                      </label>
                    </div>
                  </div>
                )}

                <Button variant="primary">Create</Button>
              </form>
            )}
          </>
        )}
      </Modal>





      <Modal open={deletingContainer !== false} setOpen={() => { setDeletingContainer(false) }}>
        {deletingContainer !== false && (
          <>
            <PageHeading title={`Delete ${deletingContainer.name}?`} description="This action cannot be undone. All resources in this container will also be deleted." />
            <div className="flex flex-row gap-2 mt-3">
              <Button className="w-full" size="medium" variant="discrete" onClick={() => {
                setDeletingContainer(false);
              }}>Cancel</Button>
              <Button className="w-full" size="medium" variant="danger" onClick={() => {
                setDeletingContainer(false);
                //@ts-expect-error it exists
                deleteContainer.mutateAsync({ groupId, containerId: deletingContainer._id.toString() }).then(() => {
                  toast.success('Successfully deleted container')
                  utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
                  setDeletingContainer(false);
                }).catch(e => {
                  toast.error(e.message)
                })
              }}>Delete</Button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={deletingResource !== false} setOpen={() => { setDeletingResource(false) }}>
        {deletingResource !== false && (
          <>
            <PageHeading title={`Delete ${deletingResource.name}?`} description="This action cannot be undone." />
            <div className="flex flex-row gap-2 mt-3">
              <Button className="w-full" size="medium" variant="discrete" onClick={() => {
                setDeletingResource(false);
              }}>Cancel</Button>
              <Button className="w-full" size="medium" variant="danger" onClick={() => {
                setDeletingResource(false);
                //@ts-expect-error it exists
                deleteResource.mutateAsync({ groupId, resourceId: deletingResource._id.toString() }).then(() => {
                  toast.success('Successfully deleted resource')
                  utils.workspaces.workspace.knowledge.getContainers.invalidate({ groupId });
                }).catch(e => {
                  toast.error(e.message)
                })
              }}>Delete</Button>
            </div>
          </>
        )}
      </Modal>

    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <HubLayout>{page}</HubLayout>
);
