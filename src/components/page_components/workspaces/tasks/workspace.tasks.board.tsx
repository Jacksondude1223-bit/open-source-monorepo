/* eslint-disable @next/next/no-img-element */
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  PaperClipIcon,
  PlusIcon,
} from '@heroicons/react/20/solid';
import { useEffect, useMemo, useState } from 'react';
import Badge from '~/components/ui/Badge';
import { trpc } from '~/utils/trpc';
import {
  BoardCategory,
  BoardTask,
  colorDotClass,
  PRIORITY_BADGE,
  PRIORITIES,
  ResolvedUsers,
  sortedCategories,
  TasksData,
} from './workspace.tasks.shared';

function taskKey(task: BoardTask) {
  return task._id?.toString() || '';
}

function TaskCardContent({
  task,
  users,
  overdue,
}: {
  task: BoardTask;
  users: ResolvedUsers;
  overdue: boolean;
}) {
  return (
    <div
      className={`rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-3 hover:border-blue-400 dark:hover:border-blue-500 transition ${
        task.completed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className={`text-sm font-medium ${
            task.completed ? 'line-through text-gray-400' : ''
          }`}
        >
          {task.title}
        </h4>
        {task.priority !== 'none' && (
          <Badge color={PRIORITY_BADGE[task.priority]}>
            <span>{PRIORITIES.find((p) => p.id === task.priority)?.name}</span>
          </Badge>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex -space-x-2">
          {(task.assignedUsers || []).slice(0, 4).map((id) => (
            <img
              key={id}
              src={users[id]?.thumbnail}
              alt=""
              title={users[id]?.name}
              className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-300"
            />
          ))}
          {(task.assignedUsers?.length || 0) > 4 && (
            <span className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 dark:bg-gray-700 text-[10px] flex items-center justify-center">
              +{task.assignedUsers.length - 4}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          {(task.notes?.length || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs">
              <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
              {task.notes.length}
            </span>
          )}
          {(task.attachments?.length || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs">
              <PaperClipIcon className="w-3.5 h-3.5" />
              {task.attachments.length}
            </span>
          )}
          {task.dueBy && (
            <span
              className={`flex items-center gap-0.5 text-xs ${
                overdue && !task.completed ? 'text-red-500' : ''
              }`}
            >
              <CalendarDaysIcon className="w-3.5 h-3.5" />
              {new Date(task.dueBy).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  users,
  onOpen,
}: {
  task: BoardTask;
  users: ResolvedUsers;
  onOpen: () => void;
}) {
  const id = taskKey(task);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const overdue = !!task.dueBy && new Date(task.dueBy).getTime() < Date.now();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-40' : ''}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      role="button"
    >
      <TaskCardContent task={task} users={users} overdue={overdue} />
    </div>
  );
}

function Column({
  category,
  tasks,
  users,
  canManage,
  onOpenTask,
  onAddTask,
}: {
  category: BoardCategory;
  tasks: BoardTask[];
  users: ResolvedUsers;
  canManage: boolean;
  onOpenTask: (task: BoardTask) => void;
  onAddTask: (categoryId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `col-${category.id}` });

  return (
    <div className="w-72 shrink-0 flex flex-col rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 max-h-full">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${colorDotClass(
              category.color,
            )}`}
          />
          <h3 className="text-sm font-semibold">{category.name}</h3>
          <span className="text-xs text-gray-400">{tasks.length}</span>
        </div>
        {canManage && (
          <button
            onClick={() => onAddTask(category.id)}
            className="text-gray-400 hover:text-blue-500"
            title="Add task"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2 min-h-10"
      >
        <SortableContext
          items={tasks.map(taskKey)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={taskKey(task)}
              task={task}
              users={users}
              onOpen={() => onOpenTask(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskBoard({
  groupId,
  board,
  tasks,
  users,
  canManage,
  onOpenTask,
  onAddTask,
}: {
  groupId: string;
  board: TasksData['board'];
  tasks: BoardTask[];
  users: ResolvedUsers;
  canManage: boolean;
  onOpenTask: (task: BoardTask) => void;
  onAddTask: (categoryId: string) => void;
}) {
  const utils = trpc.useUtils();
  const moveTask = trpc.workspaces.workspace.tasks.moveTask.useMutation();
  const categories = useMemo(
    () => sortedCategories(board.categories),
    [board.categories],
  );

  // Local container state for optimistic drag.
  const [columns, setColumns] = useState<Record<string, BoardTask[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, BoardTask[]> = {};
    categories.forEach((c) => {
      next[c.id] = tasks
        .filter((t) => t.categoryId === c.id)
        .sort((a, b) => a.order - b.order);
    });
    setColumns(next);
  }, [tasks, categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const findContainer = (id: string): string | undefined => {
    if (id.startsWith('col-')) return id.slice(4);
    return Object.keys(columns).find((cid) =>
      (columns[cid] || []).some((t) => taskKey(t) === id),
    );
  };

  const activeTask = activeId
    ? tasks.find((t) => taskKey(t) === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const activeIdLocal = event.active.id as string;
    const overId = event.over?.id as string | undefined;
    if (!overId) return;
    const activeContainer = findContainer(activeIdLocal);
    const overContainer = findContainer(overId);
    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    )
      return;

    setColumns((prev) => {
      const activeItems = prev[activeContainer] || [];
      const overItems = prev[overContainer] || [];
      const activeIndex = activeItems.findIndex(
        (t) => taskKey(t) === activeIdLocal,
      );
      if (activeIndex === -1) return prev;
      const moved = activeItems[activeIndex];
      if (!moved) return prev;
      let overIndex = overItems.findIndex((t) => taskKey(t) === overId);
      if (overIndex === -1) overIndex = overItems.length;
      return {
        ...prev,
        [activeContainer]: activeItems.filter(
          (t) => taskKey(t) !== activeIdLocal,
        ),
        [overContainer]: [
          ...overItems.slice(0, overIndex),
          moved,
          ...overItems.slice(overIndex),
        ],
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeIdLocal = event.active.id as string;
    const overId = event.over?.id as string | undefined;
    setActiveId(null);
    if (!overId) return;

    const activeContainer = findContainer(activeIdLocal);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer) return;

    let finalColumns = columns;
    if (activeContainer === overContainer) {
      const items = columns[activeContainer] || [];
      const oldIndex = items.findIndex((t) => taskKey(t) === activeIdLocal);
      const newIndex = items.findIndex((t) => taskKey(t) === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalColumns = {
          ...columns,
          [activeContainer]: arrayMove(items, oldIndex, newIndex),
        };
        setColumns(finalColumns);
      }
    }

    const destItems = finalColumns[overContainer] || [];
    if (!canManage) {
      // Revert by refetching authoritative state.
      utils.workspaces.workspace.tasks.getTasks.invalidate({ groupId });
      return;
    }
    moveTask
      .mutateAsync({
        groupId,
        taskId: activeIdLocal,
        toCategoryId: overContainer,
        orderedTaskIds: destItems.map(taskKey),
      })
      .then(() =>
        utils.workspaces.workspace.tasks.getTasks.invalidate({ groupId }),
      );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-220px)]">
        {categories.map((category) => (
          <Column
            key={category.id}
            category={category}
            tasks={columns[category.id] || []}
            users={users}
            canManage={canManage}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCardContent
            task={activeTask}
            users={users}
            overdue={
              !!activeTask.dueBy &&
              new Date(activeTask.dueBy).getTime() < Date.now()
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
