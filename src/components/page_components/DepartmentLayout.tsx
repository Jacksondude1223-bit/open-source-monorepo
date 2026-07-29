'use client';

import { AdjustmentsHorizontalIcon, PlusIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import classNames from '~/utils/classNames';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { RouterOutput, trpc } from '~/utils/trpc';

function DepartmentNavigation({
  workspace,
  department,
}: {
  workspace: RouterOutput["workspaces"]["workspace"]["getWorkspace"];
  department: any;
}) {
  const router = useRouter();
  const page = router.asPath;
  const { data: departments } =
    trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({
      groupId: workspace.groupId,
    });
  const permissionsUrl = `/workspaces/${workspace.groupId}/settings/departments/${department._id.toString()}`;
  const usersUrl = `/workspaces/${workspace.groupId}/settings/departments/${department._id.toString()}/users`;
  const rolesUrl = `/workspaces/${workspace.groupId}/settings/departments/${department._id.toString()}/roles`;
  const createUrl = `/workspaces/${workspace.groupId}/settings/departments/create`;
  const navigation = [
    {
      name: 'Permissions',
      href: permissionsUrl,
      current: page == permissionsUrl,
      icon: AdjustmentsHorizontalIcon,
    },
    { name: 'Users', href: usersUrl, current: page == usersUrl, icon: UsersIcon },
    { name: 'Roles', href: rolesUrl, current: page == rolesUrl, icon: UserGroupIcon },
  ];

  // Keep the same sub-tab when switching between departments (e.g. if you're
  // viewing Roles, clicking another department lands on its Roles page).
  const activeSubPath = page.endsWith('/roles')
    ? '/roles'
    : page.endsWith('/users')
      ? '/users'
      : '';
  return (
    <nav
      className="flex flex-row gap-1 overflow-x-auto md:w-56 md:shrink-0 md:flex-col md:gap-1"
      aria-label="Sidebar"
    >
      {navigation.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          className={classNames(
            item.current
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100',
            'group flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          )}
          aria-current={item.current ? 'page' : undefined}
        >
          <item.icon
            className={classNames(
              item.current
                ? 'text-gray-700 dark:text-gray-200'
                : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300',
              'h-5 w-5 shrink-0 transition-colors',
            )}
            aria-hidden="true"
          />
          <span className="truncate">{item.name}</span>
        </Link>
      ))}

      <div className="my-2 hidden border-t border-gray-200 dark:border-gray-700 md:block" />
      <div className="hidden md:block">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Your Departments
          </span>
          <Link
            href={createUrl}
            title="Create department"
            aria-label="Create department"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <PlusIcon className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-1 flex flex-col gap-1">
          {(departments ?? []).map((dept) => {
            const deptUrl = `/workspaces/${workspace.groupId}/settings/departments/${dept._id.toString()}${activeSubPath}`;
            const isCurrent = dept._id.toString() === department._id.toString();
            return (
              <Link
                key={dept._id.toString()}
                href={deptUrl}
                className={classNames(
                  isCurrent
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100',
                  'group flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
                )}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <span
                  className={classNames(
                    isCurrent
                      ? 'bg-blue-500'
                      : 'bg-gray-300 group-hover:bg-gray-400 dark:bg-gray-600',
                    'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{dept.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// eslint-disable-next-line @typescript-eslint/ban-types
export default function DepartmentLayout({ children }: PropsWithChildren<{}>) {
  const router = useRouter();
  const { groupId, departmentId }: { groupId: string; departmentId: string } =
    router.query as any;
  const user = useUser();
  const workspace = useWorkspace();

  const { data: departmentInfo } = trpc.workspaces.workspace.settings.departments.getDepartmentById.useQuery({
    groupId,
    departmentId,
  });

  if (!user || !workspace || !departmentInfo) {
    return <LoadingPage />;
  }

  return (
    <div>
      <PageHeading
        title={departmentInfo.name}
        description={`${workspace?.groupName} department`}
        backUrl={`/workspaces/${workspace.groupId}/settings/departments`}
      />
      <div className="mt-4 flex flex-col gap-6 md:flex-row md:gap-8">
        <DepartmentNavigation
          department={departmentInfo}
          workspace={workspace}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
