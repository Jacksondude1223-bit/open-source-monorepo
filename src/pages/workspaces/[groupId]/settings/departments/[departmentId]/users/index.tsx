'use client';

import { TrashIcon, UserPlusIcon, UsersIcon } from '@heroicons/react/20/solid';
import { ReactElement } from 'react';
import ReactTimeago from 'react-timeago';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import Card from '~/components/ui/Card';
import MediaObject from '~/components/ui/MediaObject';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { useRouter } from 'next/router';
import DepartmentLayout from '~/components/page_components/DepartmentLayout';
import toast from 'react-hot-toast';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, departmentId }: { groupId: string; departmentId: string } =
    router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const addMutation = trpc.workspaces.workspace.settings.departments.addDepartmentMember.useMutation();
  const removeMutation = trpc.workspaces.workspace.settings.departments.removeDepartmentMember.useMutation();
  const { data: departmentInfo } =
    trpc.workspaces.workspace.settings.departments.getDepartmentById.useQuery({
      groupId,
      departmentId,
    });
  const context = trpc.useUtils();

  if (!user || !workspace || !departmentInfo) {
    return <LoadingPage />;
  }

  if (departmentInfo?.isAddedBySupport){
    return (
      <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
        <p className="font-semibold text-gray-900 dark:text-gray-100">This department was created by ReAdmin support and cannot be edited.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          If you have questions about this department, please contact ReAdmin support.
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <Card className="overflow-visible">
        <Header fontSize="sm">Add a member</Header>
        <Small>Add a specific user to this department by their username.</Small>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (form) => {
            form.preventDefault();
            const target = form.target as any;
            const name = target.name.value as string;
            addMutation.mutateAsync(
              { groupId, departmentId, username: name },
            ).then(() => {
              toast.success(`Added ${name} to ${departmentInfo.name}`)
              context.workspaces.workspace.settings.departments.getDepartmentById.invalidate({ groupId, departmentId })
            }).catch(e => {
              toast.error(e.message)
            });
          }}
        >
          <TextLabel
            className="w-full"
            placeholder="Enter a username to add"
            id="name"
          />
          <Button
            variant="primary"
            type="submit"
            icon={UserPlusIcon}
            className="shrink-0"
            size="medium"
          >
            Add User
          </Button>
        </form>
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        {departmentInfo.staff.length == 0 && (
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-700">
            <UsersIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              No members in this department
            </p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Add a user above, or assign a role on the Roles tab.
            </p>
          </div>
        )}
        {departmentInfo.staff.map((member) => (
          <div
            key={!member?._id ? '' : member._id.toString()}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
          >
            <div className="min-w-0 flex-1">
              <MediaObject
                smaller={true}
                src={member.thumbnail}
                // getUserInfo returns undefined when the Roblox lookup fails
                // (deleted/banned account, or an API hiccup), so this can be
                // absent — fall back to the id rather than crashing the page.
                title={member.userInfo?.name || `User ${member.userId}`}
                description={
                  <>
                    Added <ReactTimeago date={member.created} />
                  </>
                }
              />
            </div>
            <Button
              onClick={async () => {
                removeMutation.mutateAsync(
                  {
                    groupId: workspace.groupId,
                    departmentId,
                    userId: member.userId,
                  },
                ).then(() => {
                  toast.success(`Removed ${member.userInfo?.name || `User ${member.userId}`} from ${departmentInfo.name}`)
                  context.workspaces.workspace.settings.departments.getDepartmentById.invalidate({ groupId, departmentId })
                }).catch(e => {
                  toast.error(e.message)
                });
              }}
              icon={TrashIcon}
              size="small"
              variant="light_danger"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>
    <DepartmentLayout>{page}</DepartmentLayout>
  </SettingsLayout>
);
