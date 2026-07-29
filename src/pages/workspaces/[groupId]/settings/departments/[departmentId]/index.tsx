import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import WorkspaceDepartmentPermissions, { PermissionGroup } from '~/components/page_components/workspaces/settings/departments/workspace.settings.departments.permissions';
import DepartmentLayout from '~/components/page_components/DepartmentLayout';
import { WORKSPACE_NO_ACCESS_PERMISSIONS } from '~/services/constants/WorkspaceOwnerPermissions';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { DepartmentPermissions } from '~/services/NewMongoTypes/Department.type';
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import Card from '~/components/ui/Card';
import { TrashIcon, DocumentDuplicateIcon } from '@heroicons/react/20/solid';
import { DEPARTMENT_TEMPLATES } from '~/services/constants/DepartmentTemplates';

const DEPARTMENT_COLOR_CHOICES: BrandColors[] = ['red', 'orange', 'yellow', 'green', 'teal', 'sky', 'cyan', 'blue', 'indigo', 'purple', 'rose', 'pink'];

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, departmentId }: { groupId: string; departmentId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const { data: departmentInfo } = trpc.workspaces.workspace.settings.departments.getDepartmentById.useQuery({ groupId, departmentId });
  const [permsToSend, setPermsToSend] = useState<DepartmentPermissions>(departmentInfo?.permissions || WORKSPACE_NO_ACCESS_PERMISSIONS);
  const [cankRankRoles, setRankTo] = useState<string[]>(departmentInfo?.cankRankRoles || []);
  const [permsKey, setPermsKey] = useState(0);
  const [color, setColor] = useState<BrandColors>(departmentInfo?.color || 'blue');
  useEffect(() => {
    if (departmentInfo?.color) setColor(departmentInfo.color);
  }, [departmentInfo?.color]);
  // The query loads asynchronously, so the useState initializers above run
  // before departmentInfo exists and default to NO_ACCESS / empty. Sync the
  // editable state once the department loads (and when switching departments)
  // so saving doesn't clobber the real permissions.
  useEffect(() => {
    if (!departmentInfo) return;
    setPermsToSend(departmentInfo.permissions || WORKSPACE_NO_ACCESS_PERMISSIONS);
    setRankTo(departmentInfo.cankRankRoles || []);
    setPermsKey((k) => k + 1);
  }, [departmentInfo?._id?.toString()]);
  const { data: robloxOAuth } = trpc.workspaces.workspace.settings.integrations.get_roblox_oauth.useQuery({ groupId });

  const updateMutation = trpc.workspaces.workspace.settings.departments.updateDepartmentById.useMutation();
  const deleteMutation = trpc.workspaces.workspace.settings.departments.deleteDepartmentById.useMutation();
  const duplicateMutation = trpc.workspaces.workspace.settings.departments.duplicateDepartment.useMutation();
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
    <form
      className="flex w-full flex-col gap-6"
      onSubmit={async (f) => {
        f.preventDefault();
        const target = f.target as any;
        const body = {
          name: target.name.value,
          permissions: permsToSend,
          cankRankRoles: cankRankRoles,
          color: color,
        };
        updateMutation.mutateAsync(
          {
            groupId,
            departmentId,
            ...body,
          },
        ).then((req => {
          toast.success('Department updated');
          context.workspaces.workspace.settings.departments.getDepartments.invalidate({ groupId });
          context.workspaces.workspace.settings.departments.getDepartmentById.invalidate({ groupId, departmentId });
        })).catch(error => {
          toast.error(error.message)
        })
      }}
    >
      <Card>
        <Header fontSize="sm">General</Header>
        <Small>Rename this department or remove it from your workspace.</Small>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextLabel
            label="Department name"
            id="name"
            className="w-full"
            defaultValue={departmentInfo.name}
          />
          <Button
            className="h-min shrink-0"
            variant="default"
            size="medium"
            icon={DocumentDuplicateIcon}
            disabled={duplicateMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              duplicateMutation.mutateAsync(
                {
                  groupId,
                  departmentId,
                },
              ).then((req) => {
                if (!req) {
                  return toast.error('Failed to duplicate department');
                }
                toast.success('Department duplicated');
                context.workspaces.workspace.settings.departments.getDepartments.invalidate({ groupId });
                router.push(`/workspaces/${groupId}/settings/departments/${req._id.toString()}`);
              }).catch((error) => {
                toast.error(error.message);
              });
            }}
          >
            {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
          </Button>
          <Button
            className="h-min shrink-0"
            variant="light_danger"
            size="medium"
            icon={TrashIcon}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteMutation.mutateAsync(
                {
                  groupId,
                  departmentId
                },
              ).then((req => {
                toast.success('Department deleted');
                context.workspaces.workspace.settings.departments.getDepartments.invalidate({ groupId });
                router.push(`/workspaces/${groupId}/settings/departments`)
              })).catch(error => {
                toast.error(error.message)
              })
            }}
          >
            Delete
          </Button>
        </div>
        <div className="mt-4">
          <Small>Tag color</Small>
          <p className="text-xs text-gray-500 dark:text-gray-400">Shown as a badge beside members of this department on their profile and the staff list.</p>
          <div className="mt-2 flex flex-row flex-wrap gap-2">
            {DEPARTMENT_COLOR_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={`${color === c ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-800 scale-110' : 'hover:scale-105'} h-7 w-7 rounded-full bg-${c}-500 transition-all duration-150`}
              />
            ))}
          </div>
        </div>
      </Card>

      <div>
        <Header>Permissions</Header>
        <Small>Control what members of this department can see and do.</Small>
        <div className="mt-3 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Apply a template:</span>
          {DEPARTMENT_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              title={template.description}
              onClick={() => {
                setPermsToSend(template.permissions);
                setPermsKey((k) => k + 1);
              }}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500"
            >
              {template.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <WorkspaceDepartmentPermissions
            key={permsKey}
            defaultPermissions={permsToSend}
            setPermissions={setPermsToSend}
          />

          {permsToSend.activity.ranking && (
            !robloxOAuth ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 px-6 py-6 text-center dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You must set up the Roblox Integration to use ranking.
                </p>
              </div>
            ) : (
              <PermissionGroup
                name="Allow ranking to these roles"
                toggleOption={(value) => {
                  setRankTo(value ? robloxOAuth.rankableRoles.map(rank => rank.id.toString()) : []);
                }}
                options={robloxOAuth.rankableRoles.map(rank => {
                  return {
                    name: rank.name,
                    id: rank.id.toString(),
                    value: cankRankRoles.includes(rank.id.toString()),
                    toggleOption: (value) => {
                      if (value) {
                        setRankTo([...cankRankRoles, rank.id.toString()]);
                      } else {
                        setRankTo(cankRankRoles.filter(a => a !== rank.id.toString()));
                      }
                    },
                  };
                })}
              />
            )
          )}
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          variant="primary"
          type="submit"
          size="medium"
          className="shadow-lg"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>
    <DepartmentLayout>{page}</DepartmentLayout>
  </SettingsLayout>
);
