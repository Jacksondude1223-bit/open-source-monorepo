/* eslint-disable @next/next/no-img-element */
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import TextArea from '~/components/forms/TextArea';
import TextLabel from '~/components/forms/TextLabel';
import Modal from '~/components/ui/Modal';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import { trpc } from '~/utils/trpc';
import {
  colorDotClass,
  PRIORITIES,
  ResolvedUsers,
  sortedCategories,
  TaskPriority,
  TasksData,
} from './workspace.tasks.shared';

export default function CreateWorkspaceTaskModal({
  groupId,
  board,
  users,
  open,
  setOpen,
  defaultCategoryId,
}: {
  groupId: string;
  board: TasksData['board'];
  users: ResolvedUsers;
  open: boolean;
  setOpen: (open: boolean) => void;
  defaultCategoryId?: string;
}) {
  const utils = trpc.useUtils();
  const createTask = trpc.workspaces.workspace.tasks.createTask.useMutation();
  const categories = sortedCategories(board.categories);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId || categories[0]?.id || '',
  );
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [dueBy, setDueBy] = useState('');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setCategoryId(defaultCategoryId || categories[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCategoryId]);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('none');
    setDueBy('');
    setAssignedUsers([]);
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error('A title is required.');
      return;
    }
    createTask
      .mutateAsync({
        groupId,
        categoryId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueBy: dueBy ? new Date(dueBy + 'T12:00:00') : null,
        assignedUsers,
      })
      .then(() => {
        utils.workspaces.workspace.tasks.getTasks.invalidate({ groupId });
        reset();
        setOpen(false);
        toast.success('Task created');
      })
      .catch((e) => toast.error(e.message || 'Failed to create task'));
  };

  const activeCategory = categories.find((c) => c.id === categoryId);

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="2xl">
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between -mt-1 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Create task
            </h2>
            <p className="text-sm text-gray-400">
              Add a new task to your board.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <TextLabel
            label="Title"
            id="title"
            required
            placeholder="What needs to be done?"
            value={title}
            onChange={(v) => setTitle(v)}
          />

          <TextArea
            label="Description"
            id="description"
            required={false}
            rows={3}
            placeholder="Add more detail (optional)"
            onBlur={(v) => setDescription(v)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Column
              </label>
              <Dropdown
                id="category"
                choices={categories.map((c) => ({ id: c.id, name: c.name }))}
                defaultValue={categoryId}
                onChange={(v) => setCategoryId(v)}
              />
              {activeCategory && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                  <span
                    className={`w-2 h-2 rounded-full ${colorDotClass(
                      activeCategory.color,
                    )}`}
                  />
                  {activeCategory.name}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Priority
              </label>
              <Dropdown
                id="priority"
                choices={PRIORITIES.map((p) => ({ id: p.id, name: p.name }))}
                defaultValue={priority}
                onChange={(v) => setPriority(v as TaskPriority)}
              />
            </div>
            <TextLabel
              label="Due date"
              id="dueBy"
              type="date"
              required={false}
              value={dueBy}
              onChange={(v) => setDueBy(v)}
            />
          </div>

          {/* Assigned users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Assigned users
            </label>
            {assignedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {assignedUsers.map((id) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 pl-1 pr-2 py-1"
                  >
                    <img
                      src={users[id]?.thumbnail}
                      alt=""
                      className="w-6 h-6 rounded-full bg-gray-300"
                    />
                    <span className="text-xs">{users[id]?.name || id}</span>
                    <button
                      onClick={() =>
                        setAssignedUsers(assignedUsers.filter((u) => u !== id))
                      }
                    >
                      <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2">
              <RobloxUserSearch
                groupId={groupId}
                enableIcon={false}
                size="small"
                color="blue"
                id="createAssignUser"
                className="w-full"
                onSelectUser={async (userId) => {
                  setAssignedUsers((prev) =>
                    prev.includes(userId) ? prev : [...prev, userId],
                  );
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button
            variant="discrete"
            size="medium"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="medium"
            disabled={createTask.isPending}
            onClick={submit}
          >
            {createTask.isPending ? 'Creating...' : 'Create task'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
