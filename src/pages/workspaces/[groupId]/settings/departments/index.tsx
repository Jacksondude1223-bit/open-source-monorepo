'use client';

import { UsersIcon, UserPlusIcon, ChevronRightIcon, QueueListIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import TimeAgo from 'react-timeago';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Button from '~/components/forms/Button';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { DEPARTMENT_TEMPLATES } from '~/services/constants/DepartmentTemplates';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();
  const { data: departments } =
    trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({
      groupId,
    });
  const { data: departmentStats } =
    trpc.workspaces.workspace.settings.departments.getDepartmentStats.useQuery({
      groupId,
    });
  const bulkCreateMutation =
    trpc.workspaces.workspace.settings.departments.bulkCreateWorkspaceDepartments.useMutation();
  const [showBulk, setShowBulk] = useState(false);
  const [bulkNames, setBulkNames] = useState('');
  const [bulkTemplateId, setBulkTemplateId] = useState('blank');

  if (!workspace || !departments) {
    return (
      <>
        <PageHeading title={`Departments`} />
        <LoadingPage />
      </>
    );
  }

  const brandColor = workspace.brandColor || 'blue';

  const parsedBulkNames = bulkNames
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const submitBulkCreate = () => {
    if (parsedBulkNames.length === 0) {
      return toast.error('Enter at least one department name');
    }
    const template = DEPARTMENT_TEMPLATES.find((t) => t.id === bulkTemplateId);
    const permissions = template?.permissions ?? DEPARTMENT_TEMPLATES[0]?.permissions;
    if (!permissions) {
      return toast.error('Could not resolve template');
    }
    bulkCreateMutation
      .mutateAsync({
        groupId,
        names: parsedBulkNames,
        permissions,
      })
      .then((res) => {
        toast.success(`Created ${res.count} department${res.count === 1 ? '' : 's'}`);
        setBulkNames('');
        setShowBulk(false);
        context.workspaces.workspace.settings.departments.getDepartments.invalidate({ groupId });
      })
      .catch((error) => toast.error(error.message));
  };

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Departments`}
        description="Departments group staff together and control what they can access in your workspace."
      >
        {departments.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="default"
              size="medium"
              icon={QueueListIcon}
              onClick={() => setShowBulk((s) => !s)}
            >
              Bulk Create
            </Button>
            <Button
              variant="primary"
              size="medium"
              icon={UserPlusIcon}
              onClick={() =>
                router.push(`/workspaces/${workspace.groupId}/settings/departments/create`)
              }
            >
              New Department
            </Button>
          </div>
        )}
      </PageHeading>

      {showBulk && (
        <Card className="mt-4">
          <Header fontSize="sm">Bulk create departments</Header>
          <Small>
            Enter one department name per line. They&apos;ll all be created with the permissions of
            the template you pick — you can fine-tune each one afterwards.
          </Small>
          <textarea
            value={bulkNames}
            onChange={(e) => setBulkNames(e.target.value)}
            rows={6}
            placeholder={'Moderation\nManagement\nDevelopment\nEvents'}
            className="mt-3 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Permission template</span>
              <select
                value={bulkTemplateId}
                onChange={(e) => setBulkTemplateId(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {DEPARTMENT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              size="medium"
              disabled={bulkCreateMutation.isPending || parsedBulkNames.length === 0}
              onClick={submitBulkCreate}
            >
              {bulkCreateMutation.isPending
                ? 'Creating...'
                : `Create ${parsedBulkNames.length || ''} department${parsedBulkNames.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </Card>
      )}

      {departments.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 px-6 py-14 text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-${brandColor}-100 dark:bg-${brandColor}-900/30`}
          >
            <UsersIcon className={`h-7 w-7 text-${brandColor}-600 dark:text-${brandColor}-400`} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            No departments yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Create your first department to start assigning permissions and giving your team
            access to the workspace.
          </p>
          <Button
            variant="primary"
            size="medium"
            icon={UserPlusIcon}
            className="mt-5"
            onClick={() =>
              router.push(`/workspaces/${workspace.groupId}/settings/departments/create`)
            }
          >
            Create Department
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => {
            const deptColor = department.color || brandColor;
            const stats = departmentStats?.[department._id.toString()];
            return (
            <Link
              href={`/workspaces/${workspace.groupId}/settings/departments/${department._id.toString()}`}
              key={department._id.toString()}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-${deptColor}-500`}
                >
                  <UsersIcon className="h-5 w-5 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {department?.name}
                    </h3>
                    {department?.isAddedBySupport && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        <img src="https://cdn.readmin.app/readmin-public/RA-White-RA.png" className="h-3 mr-1" alt="Support" />Support
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                    Created <TimeAgo date={new Date(department.created)} />
                  </p>
                </div>

                <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-gray-400 dark:text-gray-600" />
              </div>

              <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <UsersIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  {stats?.syncedCount?.toLocaleString() ?? 0} member{stats?.syncedCount === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserPlusIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  {stats?.userCount?.toLocaleString() ?? 0} added
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserGroupIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  {stats?.roleCount?.toLocaleString() ?? 0} role{stats?.roleCount === 1 ? '' : 's'}
                </span>
              </div>
            </Link>
            );
          })}

          <EmptyCardCreateState
            icon={UserPlusIcon}
            buttonText="Create New Department"
            cbFunction={() => {
              router.push(
                `/workspaces/${workspace.groupId}/settings/departments/create`,
              );
            }}
          />
        </div>
      )}
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
