/* eslint-disable @next/next/no-img-element */
import { PlusIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { ReactElement, useMemo, useState } from 'react';
import Button from '~/components/forms/Button';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import TasksLayout from '~/components/page_components/workspaces/tasks/TasksLayout';
import TaskBoard from '~/components/page_components/workspaces/tasks/workspace.tasks.board';
import CreateWorkspaceTaskModal from '~/components/page_components/workspaces/tasks/workspace.tasks.createmodal';
import TaskDetailModal from '~/components/page_components/workspaces/tasks/workspace.tasks.detail';
import { BoardTask } from '~/components/page_components/workspaces/tasks/workspace.tasks.shared';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function WorkspaceTasksPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();

  const { data: departments } =
    trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({
      groupId,
    });
  const { data } = trpc.workspaces.workspace.tasks.getTasks.useQuery({
    groupId,
  });

  const [creating, setCreating] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState<string | undefined>(
    undefined,
  );
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const departmentChoices = useMemo(
    () =>
      (departments || []).map((d) => ({
        _id: d._id.toString(),
        name: d.name,
      })),
    [departments],
  );

  if (!workspace || !data || 'loading' in user || !('user' in user)) {
    return <LoadingPage />;
  }

  const canManage = !!workspace.department.permissions.tasks.assign;
  const openTask: BoardTask | null =
    data.tasks.find((t) => t._id?.toString() === openTaskId) || null;

  return (
    <>
      <PageHeading title="Board" description="Track and manage your team's tasks.">
        {canManage && (
          <Button
            variant="blue"
            icon={PlusIcon}
            size="medium"
            onClick={() => {
              setCreateCategoryId(undefined);
              setCreating(true);
            }}
          >
            Add Task
          </Button>
        )}
      </PageHeading>

      <div className="mt-4">
        <TaskBoard
          groupId={groupId}
          board={data.board}
          tasks={data.tasks}
          users={data.users}
          canManage={canManage}
          onOpenTask={(task) => setOpenTaskId(task._id?.toString() || null)}
          onAddTask={(categoryId) => {
            setCreateCategoryId(categoryId);
            setCreating(true);
          }}
        />
      </div>

      <CreateWorkspaceTaskModal
        groupId={groupId}
        board={data.board}
        users={data.users}
        open={creating}
        setOpen={setCreating}
        defaultCategoryId={createCategoryId}
      />

      <TaskDetailModal
        groupId={groupId}
        task={openTask}
        board={data.board}
        users={data.users}
        departments={departmentChoices}
        canManage={canManage}
        open={!!openTask}
        setOpen={(o) => !o && setOpenTaskId(null)}
      />
    </>
  );
}

WorkspaceTasksPage.getLayout = (page: ReactElement) => (
  <TasksLayout>{page}</TasksLayout>
);
