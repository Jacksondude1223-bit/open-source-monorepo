import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { v4 } from 'uuid';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import WorkspaceViewSidebarNavigationLayout from '~/components/page_components/workspaces/views/WorkspaceViewSidebarNavigationLayout';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import { ComputedColumn, ConditionalRule, Filter, Sort } from '~/services/NewMongoTypes/View.type';
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { COMPUTED_FIELDS, isValidExpression } from '~/utils/viewComputedColumns';

const VIEW_COLOR_CHOICES: BrandColors[] = ['red', 'orange', 'yellow', 'green', 'teal', 'sky', 'cyan', 'blue', 'indigo', 'purple', 'rose', 'pink'];

const CATEGORY_CHOICES = [
  { id: 'totalMinutes', name: 'Total Minutes' },
  { id: 'activeMinutes', name: 'Active Minutes' },
  { id: 'typingMinutes', name: 'Typing Minutes' },
  { id: 'idleMinutes', name: 'Idle Minutes' },
  { id: 'messages', name: 'Total Messages' },
  { id: 'sessions', name: 'Total Sessions Attended' },
];

const OPERATOR_CHOICES = [
  { id: '<', name: 'Less Than' },
  { id: '<=', name: 'Less Than or Equal To' },
  { id: '>', name: 'Greater Than' },
  { id: '>=', name: 'Greater Than or Equal To' },
  { id: '=', name: 'Equal To' },
  { id: '!=', name: 'Not Equal To' },
];

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, viewId }: { groupId: string; viewId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();
  const { data: departments } =
    trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({
      groupId,
    });
  const { data: viewData } = trpc.workspaces.workspace.views.get.useQuery({
    groupId,
    viewId,
  });

  const editMutation = trpc.workspaces.workspace.views.edit.useMutation();

  const [filters, setFilters] = useState<Filter[]>(viewData?.filters || []);
  const [sorts, setSorts] = useState<Sort[]>(viewData?.sort || []);
  const [usedDepartments, setDepartments] = useState<string[]>(viewData?.departments.map(a => a.toString()) || []);
  const [color, setColor] = useState<BrandColors>(viewData?.color || workspace?.brandColor || 'blue');
  const [icon, setIcon] = useState(viewData?.icon || '');
  const [computedColumns, setComputedColumns] = useState<ComputedColumn[]>(viewData?.computedColumns || []);
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>(viewData?.conditionalRules || []);

  useEffect(() => {
    if (viewData && departments) {
      setFilters(viewData.filters);
      setSorts(viewData.sort);
      setDepartments(viewData.departments.map(a => a.toString()));
      setColor(viewData.color || workspace?.brandColor || 'blue');
      setIcon(viewData.icon || '');
      setComputedColumns(viewData.computedColumns || []);
      setConditionalRules(viewData.conditionalRules || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewData, departments]);

  if (!viewData || !departments) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-7 gap-2 bg-gray-100 transition dark:bg-gray-800 py-2 w-full px-2">
          <div className="col-span-4 flex">
            <p className="text-sm font-medium self-center align-middle text-gray-500">
              Edit {viewData?.name || 'View'}
            </p>
          </div>
          <div className="col-span-3 flex flex-row justify-end gap-1">
            <Button
              variant="discrete"
              href={`/workspaces/${groupId}/views/${viewId}`}
              icon={ArrowLeftIcon}
            >
              Back to View
            </Button>
          </div>
        </div>
        <div className="px-2">
          <LoadingPage />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 w-full px-2">
        <div className="col-span-4 flex">
          <p className="text-sm font-medium self-center align-middle text-gray-500">
            Edit {viewData.name}
          </p>
        </div>
        <div className="col-span-3 flex flex-row justify-end gap-1">
          <Button
            variant="discrete"
            href={`/workspaces/${groupId}/views/${viewId}`}
            icon={ArrowLeftIcon}
          >
            Back to View
          </Button>
        </div>
      </div>

      <form
        onSubmit={async (submit) => {
          submit.preventDefault();
          const target = submit.target as any;
          const { name: nameA } = target;
          const name = nameA.value;

          if (filters.find((filter) => Number.isNaN(filter.value))) {
            toast.error('You must have a valid number as a filter value.');
            return;
          }

          const action = new Promise<void>((resolve, reject) => {
            editMutation
              .mutateAsync({
                groupId,
                viewId,
                name,
                selectedDepartments: usedDepartments,
                selectedFilters: filters,
                selectedSorts: sorts,
                color,
                icon,
                computedColumns,
                conditionalRules,
              })
              .then(async (view) => {
                resolve();
                context.workspaces.workspace.views.get.invalidate({ groupId, viewId: view.viewId });
                context.workspaces.workspace.views.getViews.invalidate({ groupId })
                await router.push(`/workspaces/${groupId}/views/${view.viewId}`);
              })
              .catch(() => {
                reject();
              });
          });

          toast.promise(action, {
            loading: 'Updating view...',
            success: 'Successfully edited view',
            error: 'Failed to update view.',
          });
        }}
        className="px-2"
      >
        <TextLabel
          label="Name"
          id="name"
          defaultValue={viewData.name}
          placeholder="Best Performers"
        />

        <div className='mt-3 flex flex-row flex-wrap gap-6'>
          <div>
            <p className='text-sm font-medium text-gray-500'>Color</p>
            <div className='flex flex-row flex-wrap gap-1.5 mt-2'>
              {VIEW_COLOR_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-label={choice}
                  onClick={() => setColor(choice)}
                  className={`w-6 h-6 rounded-full bg-${choice}-500 transition ${color === choice ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900' : ''}`}
                />
              ))}
            </div>
          </div>
          <div>
            <p className='text-sm font-medium text-gray-500'>Icon (emoji)</p>
            <input
              type="text"
              value={icon}
              maxLength={2}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="⭐"
              className='mt-2 w-16 text-center text-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg py-1'
            />
          </div>
        </div>

        <div className="mt-2">
          <p className="mt-2 text-sm font-medium text-gray-500">Departments</p>
          <MultiSelectDropdown
            onSelectChoice={setDepartments}
            defaultValue={usedDepartments}
            value={usedDepartments}
            choices={
              departments
                ? departments.map((dep) => ({
                  name: dep.name,
                  id: dep._id.toString(),
                }))
                : []
            }
            placeholder="Select departments"
          />
        </div>
        <div className="mt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="mt-3 text-sm font-medium text-gray-500">Filters</p>
          <div className="flex flex-col gap-2 mt-2">
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-3 rounded-xl flex flex-row gap-2"
              >
                <Dropdown
                  choices={[
                    { id: 'totalMinutes', name: 'Total Minutes' },
                    { id: 'activeMinutes', name: 'Active Minutes' },
                    { id: 'typingMinutes', name: 'Typing Minutes' },
                    { id: 'idleMinutes', name: 'Idle Minutes' },
                    { id: 'messages', name: 'Total Messages' },
                    { id: 'sessions', name: 'Total Sessions Attended' },
                  ]}
                  defaultValue={filter.name}
                  onChange={(val) => {
                    const newFilters = [...filters];
                    const index = newFilters.findIndex(
                      (f) => f.id === filter.id,
                    );
                    //@ts-expect-error no one cares.
                    newFilters[index].name = val;
                    setFilters(newFilters);
                  }}
                />

                <Dropdown
                  choices={[
                    { id: '<', name: 'Less Than' },
                    { id: '<=', name: 'Less Than or Equal To' },
                    { id: '>', name: 'Greater Than' },
                    { id: '>=', name: 'Greater Than or Equal To' },
                    { id: '=', name: 'Equal To' },
                    { id: '!=', name: 'Not Equal To' },
                  ]}
                  defaultValue={filter.type}
                  onChange={(val) => {
                    const newFilters = [...filters];
                    const index = newFilters.findIndex(
                      (f) => f.id === filter.id,
                    );
                    //@ts-expect-error no one cares.
                    newFilters[index].type = val;
                    setFilters(newFilters);
                  }}
                />
                <TextLabel
                  type="number"
                  placeholder="Value"
                  className="min-w-[16rem]"
                  defaultValue={filter.value}
                  onChange={(val) => {
                    const newFilters = [...filters];
                    const index = newFilters.findIndex(
                      (f) => f.id === filter.id,
                    );
                    //@ts-expect-error no one cares.
                    newFilters[index].value = Number(val);
                    setFilters(newFilters);
                  }}
                />
                <Button
                  className="w-min"
                  variant="danger"
                  icon={TrashIcon}
                  onClick={() => {
                    const newFilters = [...filters];
                    const index = newFilters.findIndex(
                      (f) => f.id === filter.id,
                    );
                    newFilters.splice(index, 1);
                    setFilters(newFilters);
                  }}
                />
              </div>
            ))}
            <EmptyCardCreateState
              icon={PlusIcon}
              cbFunction={() => {
                setFilters([
                  ...filters,
                  {
                    id: v4(),
                    name: 'totalMinutes',
                    type: '<',
                    value: 10,
                  },
                ]);
              }}
              buttonText={'Create Filter'}
              className="w-full"
            />
          </div>
        </div>
        <div className="mt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="mt-3 text-sm font-medium text-gray-500">Sorts</p>
          <div className="flex flex-col gap-2 mt-2">
            {sorts.map((sort) => (
              <div
                key={sort.id}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-3 rounded-xl flex flex-row gap-2"
              >
                <Dropdown
                  choices={[
                    { id: 'totalMinutes', name: 'Total Minutes' },
                    { id: 'activeMinutes', name: 'Active Minutes' },
                    { id: 'typingMinutes', name: 'Typing Minutes' },
                    { id: 'idleMinutes', name: 'Idle Minutes' },
                    { id: 'messages', name: 'Total Messages' },
                    { id: 'sessions', name: 'Total Sessions Attended' },
                  ]}
                  defaultValue={sort.name}
                  onChange={(val) => {
                    const newSorts = [...sorts];
                    const index = newSorts.findIndex((f) => f.id === sort.id);
                    //@ts-expect-error no one cares.
                    newSorts[index].name = val;
                    setSorts(newSorts);
                  }}
                />

                <Dropdown
                  choices={[
                    { id: 'ASC', name: 'Ascending' },
                    { id: 'DESC', name: 'Descending' },
                  ]}
                  defaultValue={sort.type}
                  onChange={(val) => {
                    const newSorts = [...sorts];
                    const index = newSorts.findIndex((f) => f.id === sort.id);
                    //@ts-expect-error no one cares.
                    newSorts[index].type = val;
                    setSorts(newSorts);
                  }}
                />
                <Button
                  className="w-min"
                  variant="danger"
                  icon={TrashIcon}
                  onClick={() => {
                    const newSorts = [...sorts];
                    const index = newSorts.findIndex((f) => f.id === sort.id);
                    newSorts.splice(index, 1);
                    setSorts(newSorts);
                  }}
                />
              </div>
            ))}
            <EmptyCardCreateState
              cbFunction={() => {
                setSorts([
                  ...sorts,
                  {
                    id: v4(),
                    name: 'totalMinutes',
                    type: 'ASC',
                  },
                ]);
              }}
              icon={PlusIcon}
              buttonText={'Create Sort'}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="mt-3 text-sm font-medium text-gray-500">Computed Columns</p>
          <p className="text-xs text-gray-400 mb-2">
            Build custom metrics from existing fields. Available fields: {COMPUTED_FIELDS.join(', ')}. Operators: + - * / and parentheses.
          </p>
          <div className="flex flex-col gap-2 mt-2">
            {computedColumns.map((cc, idx) => {
              const valid = isValidExpression(cc.expression);
              return (
                <div
                  key={cc.key}
                  className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-3 rounded-xl flex flex-row flex-wrap items-center gap-2"
                >
                  <TextLabel
                    placeholder="Column label"
                    className="min-w-48"
                    defaultValue={cc.label}
                    onChange={(val) => {
                      const next = [...computedColumns];
                      next[idx] = { ...cc, label: String(val) };
                      setComputedColumns(next);
                    }}
                  />
                  <TextLabel
                    placeholder="e.g. active / total * 100"
                    className="min-w-[16rem]"
                    defaultValue={cc.expression}
                    onChange={(val) => {
                      const next = [...computedColumns];
                      next[idx] = { ...cc, expression: String(val) };
                      setComputedColumns(next);
                    }}
                  />
                  <Dropdown
                    choices={[
                      { id: 'number', name: 'Number' },
                      { id: 'percent', name: 'Percent' },
                    ]}
                    defaultValue={cc.format || 'number'}
                    onChange={(val) => {
                      const next = [...computedColumns];
                      next[idx] = { ...cc, format: val };
                      setComputedColumns(next);
                    }}
                  />
                  <span className={`text-xs ${valid ? 'text-green-500' : 'text-red-500'}`}>
                    {valid ? 'Valid' : 'Invalid expression'}
                  </span>
                  <Button
                    className="w-min"
                    variant="danger"
                    icon={TrashIcon}
                    onClick={() => {
                      const next = [...computedColumns];
                      next.splice(idx, 1);
                      setComputedColumns(next);
                    }}
                  />
                </div>
              );
            })}
            <EmptyCardCreateState
              icon={PlusIcon}
              cbFunction={() => {
                setComputedColumns([
                  ...computedColumns,
                  { key: v4(), label: 'New Column', expression: 'active / total * 100', format: 'number' },
                ]);
              }}
              buttonText={'Create Computed Column'}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="mt-3 text-sm font-medium text-gray-500">Conditional Formatting</p>
          <p className="text-xs text-gray-400 mb-2">
            Highlight cells when a column meets a condition.
          </p>
          <div className="flex flex-col gap-2 mt-2">
            {conditionalRules.map((rule, idx) => (
              <div
                key={rule.id}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-3 rounded-xl flex flex-row flex-wrap items-center gap-2"
              >
                <Dropdown
                  choices={CATEGORY_CHOICES}
                  defaultValue={rule.column}
                  onChange={(val) => {
                    const next = [...conditionalRules];
                    next[idx] = { ...rule, column: val };
                    setConditionalRules(next);
                  }}
                />
                <Dropdown
                  choices={OPERATOR_CHOICES}
                  defaultValue={rule.type}
                  onChange={(val) => {
                    const next = [...conditionalRules];
                    next[idx] = { ...rule, type: val };
                    setConditionalRules(next);
                  }}
                />
                <TextLabel
                  type="number"
                  placeholder="Value"
                  className="min-w-40"
                  defaultValue={rule.value}
                  onChange={(val) => {
                    const next = [...conditionalRules];
                    next[idx] = { ...rule, value: Number(val) };
                    setConditionalRules(next);
                  }}
                />
                <div className="flex flex-row flex-wrap gap-1 items-center">
                  {VIEW_COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => {
                        const next = [...conditionalRules];
                        next[idx] = { ...rule, color: c };
                        setConditionalRules(next);
                      }}
                      className={`w-5 h-5 rounded-full bg-${c}-500 ${rule.color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    />
                  ))}
                </div>
                <Button
                  className="w-min"
                  variant="danger"
                  icon={TrashIcon}
                  onClick={() => {
                    const next = [...conditionalRules];
                    next.splice(idx, 1);
                    setConditionalRules(next);
                  }}
                />
              </div>
            ))}
            <EmptyCardCreateState
              icon={PlusIcon}
              cbFunction={() => {
                setConditionalRules([
                  ...conditionalRules,
                  { id: v4(), column: 'totalMinutes', type: '<', value: 60, color: 'red' },
                ]);
              }}
              buttonText={'Create Rule'}
              className="w-full"
            />
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-2">
          Save View
        </Button>
      </form>
    </div>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => {
  return (
    <WorkspaceViewSidebarNavigationLayout disablePadding={true}>
      {page}
    </WorkspaceViewSidebarNavigationLayout>
  );
};
