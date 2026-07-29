import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import WorkspaceDepartmentPermissions from '~/components/page_components/workspaces/settings/departments/workspace.settings.departments.permissions';
import { WORKSPACE_NO_ACCESS_PERMISSIONS } from '~/services/constants/WorkspaceOwnerPermissions';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { DepartmentPermissions } from '~/services/NewMongoTypes/Department.type';
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import { CheckIcon } from '@heroicons/react/20/solid';
import { DEPARTMENT_TEMPLATES } from '~/services/constants/DepartmentTemplates';
import classNames from '~/utils/classNames';

const DEPARTMENT_COLOR_CHOICES: BrandColors[] = ['red', 'orange', 'yellow', 'green', 'teal', 'sky', 'cyan', 'blue', 'indigo', 'purple', 'rose', 'pink'];

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const createMutation = trpc.workspaces.workspace.settings.departments.createWorkspaceDepartment.useMutation();
  const context = trpc.useUtils();
  const user = useUser();
  const workspace = useWorkspace();
  const [permsToSend, setPermsToSend] = useState<DepartmentPermissions>(WORKSPACE_NO_ACCESS_PERMISSIONS);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('blank');
  const [permsKey, setPermsKey] = useState(0);
  const [color, setColor] = useState<BrandColors>('blue');

  const applyTemplate = (templateId: string) => {
    const template = DEPARTMENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setPermsToSend(template.permissions);
    // Remount the permissions editor so its internal state reflects the template.
    setPermsKey((k) => k + 1);
  };

  if (!user || !workspace) {
    return <LoadingPage />;
  }

  const selectedTemplatePermissions =
    DEPARTMENT_TEMPLATES.find((t) => t.id === selectedTemplateId)?.permissions ??
    WORKSPACE_NO_ACCESS_PERMISSIONS;
  return (
    <>
      <PageHeading
        title={`Create Department`}
        description="Set up a new department with custom permissions for your team."
        backUrl={`/workspaces/${groupId}/settings/departments`}
      />

      <form
        className="mt-4 flex flex-col gap-6"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const body = {
            name: target.name.value,
            permissions: permsToSend,
            color: color,
          };
          createMutation.mutateAsync(
            {
              groupId,
              ...body,
            },
          ).then(req => {
            if (!req) {
              return toast.error('Failed to create department')
            }
            toast.success('Department created');
            router.push(`/workspaces/${groupId}/settings/departments/${req._id.toString()}`);
            context.workspaces.workspace.settings.departments.getDepartments.invalidate({ groupId });

          }).catch(error => {
            toast.error(error.message)
          })
        }}
      >
        <Card>
          <Header fontSize="sm">Department name</Header>
          <Small>Give this department a clear, recognizable name.</Small>
          <TextLabel
            label=""
            id="name"
            className="mt-3 w-full"
            placeholder="e.g. Moderation Team"
          />
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            You&apos;ll be able to add users and roles to this department after creating it.
          </p>
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

        <Card>
          <Header fontSize="sm">Start from a template</Header>
          <Small>Pick a preset to instantly fill in sensible permissions. You can fine-tune everything below.</Small>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENT_TEMPLATES.map((template) => {
              const isSelected = template.id === selectedTemplateId;
              return (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className={classNames(
                    'relative flex flex-col rounded-xl border p-4 text-left transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-900/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600',
                  )}
                >
                  {isSelected && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="pr-6 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {template.name}
                  </span>
                  <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {template.description}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div>
          <Header>Permissions</Header>
          <Small>Choose what members of this department can access. You can change these later.</Small>
          <div className="mt-3 flex flex-col gap-2">
            <WorkspaceDepartmentPermissions key={permsKey} defaultPermissions={selectedTemplatePermissions} setPermissions={setPermsToSend} />
          </div>
        </div>

        <div className="sticky bottom-4 flex justify-end">
          <Button
            variant="primary"
            type="submit"
            size="medium"
            className="shadow-lg"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Department'}
          </Button>
        </div>
      </form>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
