import { RouterOutput } from '~/utils/trpc';

export type TasksData =
  RouterOutput['workspaces']['workspace']['tasks']['getTasks'];
export type BoardTask = TasksData['tasks'][number];
export type BoardCategory = TasksData['board']['categories'][number];
export type CustomFieldDef = TasksData['board']['customFields'][number];
export type ResolvedUsers = TasksData['users'];

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITIES: { id: TaskPriority; name: string }[] = [
  { id: 'none', name: 'No priority' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
  { id: 'urgent', name: 'Urgent' },
];

export const PRIORITY_BADGE: Record<
  TaskPriority,
  'blue' | 'green' | 'yellow' | 'red' | 'light'
> = {
  none: 'light',
  low: 'blue',
  medium: 'yellow',
  high: 'yellow',
  urgent: 'red',
};

/** Tailwind color name -> classes for the category dot + header accent. */
export const CATEGORY_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

export function colorDotClass(color: string): string {
  const map: Record<string, string> = {
    gray: 'bg-gray-400',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    yellow: 'bg-yellow-500',
    lime: 'bg-lime-500',
    green: 'bg-green-500',
    emerald: 'bg-emerald-500',
    teal: 'bg-teal-500',
    cyan: 'bg-cyan-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    purple: 'bg-purple-500',
    fuchsia: 'bg-fuchsia-500',
    pink: 'bg-pink-500',
    rose: 'bg-rose-500',
  };
  return map[color] || 'bg-gray-400';
}

export const CUSTOM_FIELD_TYPES: {
  id: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'user';
  name: string;
}[] = [
  { id: 'text', name: 'Text' },
  { id: 'number', name: 'Number' },
  { id: 'date', name: 'Date' },
  { id: 'select', name: 'Dropdown' },
  { id: 'checkbox', name: 'Checkbox' },
  { id: 'user', name: 'User' },
];

export function sortedCategories(categories: BoardCategory[]): BoardCategory[] {
  return [...categories].sort((a, b) => a.order - b.order);
}

export function tasksForCategory(
  tasks: BoardTask[],
  categoryId: string,
): BoardTask[] {
  return tasks
    .filter((t) => t.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
}
