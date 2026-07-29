'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  Squares2X2Icon,
  TagIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import TasksLayout from '~/components/page_components/workspaces/tasks/TasksLayout';
import {
  CATEGORY_COLORS,
  colorDotClass,
  CUSTOM_FIELD_TYPES,
  sortedCategories,
} from '~/components/page_components/workspaces/tasks/workspace.tasks.shared';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

const MAX_CATEGORIES = 25;
const MAX_FIELDS = 25;

export default function TasksSettingsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();

  const utils = trpc.useUtils();
  const { data } = trpc.workspaces.workspace.tasks.getTasks.useQuery({
    groupId,
  });
  const refresh = () =>
    utils.workspaces.workspace.tasks.getTasks.invalidate({ groupId });

  const createCategory =
    trpc.workspaces.workspace.tasks.createCategory.useMutation();
  const updateCategory =
    trpc.workspaces.workspace.tasks.updateCategory.useMutation();
  const deleteCategory =
    trpc.workspaces.workspace.tasks.deleteCategory.useMutation();
  const reorderCategories =
    trpc.workspaces.workspace.tasks.reorderCategories.useMutation();
  const createCustomField =
    trpc.workspaces.workspace.tasks.createCustomField.useMutation();
  const deleteCustomField =
    trpc.workspaces.workspace.tasks.deleteCustomField.useMutation();

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<
    'text' | 'number' | 'date' | 'select' | 'checkbox' | 'user'
  >('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  if (!workspace || !data) {
    return (
      <>
        <PageHeading title="Settings" />
        <LoadingPage />
      </>
    );
  }

  const board = data.board;
  const categories = sortedCategories(board.categories);
  const customFields = [...board.customFields].sort((a, b) => a.order - b.order);

  const addCategory = () => {
    if (!newCatName.trim()) return;
    createCategory
      .mutateAsync({ groupId, name: newCatName.trim(), color: newCatColor })
      .then(() => {
        setNewCatName('');
        refresh();
      })
      .catch((e) => toast.error(e.message || 'Failed to add category'));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...categories];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    reorderCategories
      .mutateAsync({ groupId, orderedIds: next.map((c) => c.id) })
      .then(refresh)
      .catch((e) => toast.error(e.message));
  };

  const addField = () => {
    if (!newFieldName.trim()) return;
    createCustomField
      .mutateAsync({
        groupId,
        name: newFieldName.trim(),
        type: newFieldType,
        options:
          newFieldType === 'select'
            ? newFieldOptions
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      })
      .then(() => {
        setNewFieldName('');
        setNewFieldOptions('');
        setNewFieldType('text');
        refresh();
      })
      .catch((e) => toast.error(e.message || 'Failed to add field'));
  };

  return (
    <>
      <PageHeading
        title="Settings"
        description="Customise your board's columns and the fields available on every task."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Categories */}
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <Squares2X2Icon className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold">Columns</h2>
            <span className="ml-auto text-xs text-gray-400">
              {categories.length}/{MAX_CATEGORIES}
            </span>
          </div>

          <div className="p-5 flex flex-col gap-2">
            {categories.map((cat, index) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3"
              >
                <div className="flex flex-col">
                  <button
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ArrowUpIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={index === categories.length - 1}
                    onClick={() => move(index, 1)}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ArrowDownIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${colorDotClass(
                    cat.color,
                  )}`}
                />
                <input
                  defaultValue={cat.name}
                  className="flex-1 bg-transparent text-sm focus:outline-none min-w-0"
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== cat.name)
                      updateCategory
                        .mutateAsync({
                          groupId,
                          categoryId: cat.id,
                          name: e.target.value,
                        })
                        .then(refresh);
                  }}
                />
                <div className="flex items-center gap-1 flex-wrap justify-end max-w-44">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      title={color}
                      onClick={() =>
                        updateCategory
                          .mutateAsync({ groupId, categoryId: cat.id, color })
                          .then(refresh)
                      }
                      className={`w-3.5 h-3.5 rounded-full ${colorDotClass(
                        color,
                      )} ${
                        cat.color === color
                          ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-800'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() =>
                    deleteCategory
                      .mutateAsync({ groupId, categoryId: cat.id })
                      .then(refresh)
                      .catch((e) => toast.error(e.message))
                  }
                  className="text-gray-300 hover:text-red-500 shrink-0"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}

            {categories.length < MAX_CATEGORIES && (
              <div className="mt-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 flex flex-col gap-3">
                <TextLabel
                  label="New column name"
                  id="newCat"
                  required={false}
                  value={newCatName}
                  onChange={(v) => setNewCatName(v)}
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCatColor(color)}
                      className={`w-5 h-5 rounded-full ${colorDotClass(color)} ${
                        newCatColor === color
                          ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-800'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                <Button
                  variant="blue"
                  size="medium"
                  icon={PlusIcon}
                  className="w-min"
                  onClick={addCategory}
                >
                  Add column
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Custom fields */}
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <TagIcon className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold">Custom fields</h2>
            <span className="ml-auto text-xs text-gray-400">
              {customFields.length}/{MAX_FIELDS}
            </span>
          </div>

          <div className="p-5 flex flex-col gap-2">
            {customFields.length === 0 && (
              <p className="text-sm text-gray-400">
                No custom fields yet. Add one below to capture extra information
                on each task.
              </p>
            )}
            {customFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3"
              >
                <div className="text-sm min-w-0">
                  <span className="font-medium">{field.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {CUSTOM_FIELD_TYPES.find((t) => t.id === field.type)?.name}
                    {field.type === 'select' &&
                      field.options &&
                      field.options.length > 0 &&
                      ` · ${field.options.join(', ')}`}
                  </span>
                </div>
                <button
                  onClick={() =>
                    deleteCustomField
                      .mutateAsync({ groupId, fieldId: field.id })
                      .then(refresh)
                  }
                  className="text-gray-300 hover:text-red-500 shrink-0"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}

            {customFields.length < MAX_FIELDS && (
              <div className="mt-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextLabel
                    label="Field name"
                    id="newField"
                    required={false}
                    value={newFieldName}
                    onChange={(v) => setNewFieldName(v)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Type
                    </label>
                    <Dropdown
                      id="newFieldType"
                      choices={CUSTOM_FIELD_TYPES.map((t) => ({
                        id: t.id,
                        name: t.name,
                      }))}
                      defaultValue={newFieldType}
                      onChange={(v) => setNewFieldType(v as typeof newFieldType)}
                    />
                  </div>
                </div>
                {newFieldType === 'select' && (
                  <TextLabel
                    label="Options (comma separated)"
                    id="newFieldOptions"
                    required={false}
                    placeholder="Low, Medium, High"
                    value={newFieldOptions}
                    onChange={(v) => setNewFieldOptions(v)}
                  />
                )}
                <Button
                  variant="blue"
                  size="medium"
                  icon={PlusIcon}
                  className="w-min"
                  onClick={addField}
                >
                  Add field
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

TasksSettingsPage.getLayout = (page: ReactElement) => (
  <TasksLayout>{page}</TasksLayout>
);
