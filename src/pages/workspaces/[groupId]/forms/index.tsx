'use client';

import { useRouter } from 'next/router';
import { ReactElement, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceFormsSidebarNavigationLayout from '~/components/page_components/workspaces/forms/WorkspaceFormsSidebarNavigationLayout';
import Card from '~/components/ui/Card';
import Modal from '~/components/ui/Modal';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Badge from '~/components/ui/Badge';
import {
  MagnifyingGlassIcon,
  Bars3Icon,
  Squares2X2Icon,
  DocumentPlusIcon,
  LinkIcon,
  TrashIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import ReactTimeago from 'react-timeago';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | false>(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'responses' | 'name'>('newest');
  const [view, setView] = useState<'list' | 'grid'>('grid');

  const createApplicationMutation =
    trpc.workspaces.workspace.forms.applications.createApplication.useMutation();
  const deleteApplicationMutation =
    trpc.workspaces.workspace.forms.applications.deleteApplication.useMutation();
  const { data: applications } =
    trpc.workspaces.workspace.forms.applications.getApplications.useQuery({
      groupId,
    });
  const context = trpc.useUtils();

  const canEdit = !!workspace?.department?.permissions?.applications?.editApplications;

  const totalResponses = useMemo(
    () => (applications || []).reduce((a, b: any) => a + (b.responses || 0), 0),
    [applications],
  );

  const filteredApplications = useMemo(() => {
    if (!applications) return [];
    let list = applications.filter((a) =>
      [a.name, a.description].some((f) =>
        f?.toLowerCase().includes(search.toLowerCase()),
      ),
    );
    list = list.sort((a: any, b: any) => {
      if (sort === 'newest') {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      } else if (sort === 'oldest') {
        return new Date(a.created).getTime() - new Date(b.created).getTime();
      } else if (sort === 'responses') {
        return (b.responses || 0) - (a.responses || 0);
      } else if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
    return list;
  }, [applications, search, sort]);

  function copyLink(application: any) {
    try {
      const link = application.applyOnlineId
        ? `https://panel.readmin.app/apply/${application.applyOnlineId}`
        : `${window.location.origin}/workspaces/${groupId}/forms/application/${(application?._id || '').toString()}`;
      navigator.clipboard
        .writeText(link)
        .then(() => toast.success('Link copied to clipboard'))
        .catch(() => toast.error('Failed to copy link'));
    } catch (e) {
      // window not defined SSR
    }
  }

  function deleteForm() {
    if (!deleteTarget) return;
    deleteApplicationMutation
      .mutateAsync({
        groupId,
        applicationId: (deleteTarget?._id || '').toString(),
      })
      .then(() => {
        toast.success('Form deleted');
        context.workspaces.workspace.forms.applications.getApplications.invalidate({
          groupId,
        });
        setDeleteTarget(false);
      })
      .catch((e) => toast.error(`Something went wrong: ${e}`));
  }

  if (!workspace?.department?.permissions?.applications?.viewApplications) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName || 'Workspace'} Forms`}
          disableDivide
        />
        <Card className="text-center flex flex-col gap-2 items-center py-10">
          <h2 className="font-bold text-xl">Insufficient Permissions</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md">
            You don&apos;t have permission to view forms. If you believe this is a mistake, contact one of your group admins.
          </p>
        </Card>
      </>
    );
  }

  if (!applications) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName || 'Workspace'} Forms`}
        description="Build, customize and collect responses from your members."
        disableDivide
        className="gap-4"
      >
        <div className="flex flex-col md:flex-row gap-2 w-full md:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search forms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-row gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="responses">Most Responses</option>
              <option value="name">Name A-Z</option>
            </select>
            <div className="flex flex-row rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setView('grid')}
                title="Grid view"
                className={`px-2.5 py-2 transition ${view === 'grid' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                title="List view"
                className={`px-2.5 py-2 transition ${view === 'list' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Bars3Icon className="w-4 h-4" />
              </button>
            </div>
            {canEdit && (
              <Button
                onClick={() => setCreateOpen(true)}
                variant="primary"
                size="medium"
                icon={PlusIcon}
              >
                Create Form
              </Button>
            )}
          </div>
        </div>
      </PageHeading>

      {applications.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-2">
          <Card className="flex flex-col gap-0.5 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Forms</p>
            <p className="text-2xl font-bold">{applications.length.toLocaleString()}</p>
          </Card>
          <Card className="flex flex-col gap-0.5 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Open</p>
            <p className="text-2xl font-bold">
              {applications.filter((a) => a?.permissions?.acceptingResponses).length.toLocaleString()}
            </p>
          </Card>
          <Card className="flex flex-col gap-0.5 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Responses</p>
            <p className="text-2xl font-bold">{totalResponses.toLocaleString()}</p>
          </Card>
        </div>
      )}

      {filteredApplications.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <DocumentPlusIcon className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="font-semibold text-lg">No forms found</h3>
          {applications && applications.length > 0 ? (
            <p className="text-sm text-gray-500 max-w-sm">
              Try adjusting your search or filters.
            </p>
          ) : (
            <p className="text-sm text-gray-500 max-w-sm">
              You have no forms yet. {canEdit ? 'Create one to get started.' : ''}
            </p>
          )}
          {canEdit && (
            <Button variant="primary" size="medium" icon={PlusIcon} onClick={() => setCreateOpen(true)}>
              Create Form
            </Button>
          )}
        </Card>
      )}

      <div
        className={
          view === 'grid'
            ? 'grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            : 'flex flex-col gap-2'
        }
      >
        {filteredApplications.map((application) => {
          const accepting = application?.permissions?.acceptingResponses;
          return (
            <div key={(application?._id || '').toString()} className="group relative">
              <button
                onClick={() => {
                  router.push(
                    `/workspaces/${groupId}/forms/application/${(application?._id || '').toString()}`,
                  );
                }}
                className="w-full text-left"
              >
                <Card className="relative h-full flex flex-col gap-2 transition group-hover:-translate-y-0.5 group-hover:shadow-xl border-2 group-hover:border-blue-200 dark:group-hover:border-blue-900/50">
                  <div className="flex flex-row justify-between gap-2 items-start">
                    <div className="flex flex-row gap-3 items-center pr-16 min-w-0">
                      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accepting ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                        <ChatBubbleLeftRightIcon className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-base line-clamp-1">{application.name}</p>
                    </div>
                    {canEdit && (
                      <div className="flex flex-row gap-1 absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition">
                        <Button
                          size="small"
                          variant="discrete"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyLink(application);
                          }}
                          title="Copy link"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          size="small"
                          variant="light_danger"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTarget(application);
                          }}
                          title="Delete form"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">
                    {application.description}
                  </p>
                  <div className="flex flex-row flex-wrap gap-2 items-center mt-auto pt-1">
                    <Badge color={accepting ? 'green' : 'red'}>
                      {accepting ? 'Open' : 'Closed'}
                    </Badge>
                    <Badge color="blue">
                      {((application as any).responses || 0).toLocaleString()} Responses
                    </Badge>
                    <Badge color="light">
                      <span className="hidden sm:inline">Created&nbsp;</span>
                      <ReactTimeago date={application.created as unknown as string} />
                    </Badge>
                  </div>
                </Card>
              </button>
            </div>
          );
        })}
      </div>

      <Modal open={createOpen} setOpen={setCreateOpen} sizeOverride="md">
        <form
          className="flex flex-col gap-2"
          onSubmit={(f) => {
            f.preventDefault();
            const target = f.target as any;
            const {
              name: { value: name },
              description: { value: description },
            } = target;
            createApplicationMutation
              .mutateAsync({
                groupId,
                name,
                description,
              })
              .then(() => {
                toast.success('Successfully created form');
                context.workspaces.workspace.forms.applications.getApplications.invalidate({ groupId });
                setCreateOpen(false);
              })
              .catch((e) => {
                toast.error(`Something went wrong: ${e}`);
              });
          }}
        >
          <PageHeading
            title="Create Form"
            description="Spin up a new form to collect responses from your members."
            disableDivide
            className="mb-0"
          />
          {createApplicationMutation.isPending ? (
            <LoadingPage />
          ) : (
            <>
              <TextLabel id="name" label="Form Name" placeholder="e.g. Staff Application" required />
              <TextLabel id="description" label="Form Description" placeholder="A short summary of this form" required />
              <Button
                type="submit"
                variant="primary"
                size="medium"
                className="w-full"
                disabled={createApplicationMutation.isPending}
              >
                {createApplicationMutation.isPending ? 'Creating...' : 'Create Form'}
              </Button>
            </>
          )}
        </form>
      </Modal>

      <Modal open={deleteTarget !== false} setOpen={() => setDeleteTarget(false)} sizeOverride="md">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="font-bold text-xl">Delete this form?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              You&apos;re about to permanently delete{' '}
              <span className="font-semibold">{deleteTarget ? deleteTarget.name : ''}</span> and all of its responses. This cannot be undone.
            </p>
          </div>
          <div className="flex flex-row gap-2 mt-2">
            <Button
              variant="discrete"
              size="medium"
              className="w-full"
              onClick={() => setDeleteTarget(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="medium"
              className="w-full"
              disabled={deleteApplicationMutation.isPending}
              onClick={deleteForm}
            >
              {deleteApplicationMutation.isPending ? 'Deleting...' : 'Delete Form'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceFormsSidebarNavigationLayout>{page}</WorkspaceFormsSidebarNavigationLayout>
);
