/* eslint-disable @next/next/no-img-element */
import {
  ArrowDownTrayIcon,
  CogIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  PlayCircleIcon,
  PlusIcon,
  TrashIcon,
  ViewColumnsIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PropsWithChildren, ReactElement } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import { DataGrid, GridColDef, GridRenderCellParams, GridSortModel } from '@mui/x-data-grid';
import { Box } from '@mui/material';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import DistributionSelector from '~/components/forms/DistributionSelector';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceViewSidebarNavigationLayout from '~/components/page_components/workspaces/views/WorkspaceViewSidebarNavigationLayout';
import Modal from '~/components/ui/Modal';
import { Tag, View } from '~/services/NewMongoTypes';
import { Categories, ComputedColumn, ConditionalRule, Filter, Sort, ViewColumnConfig, ViewColumnKey } from '~/services/NewMongoTypes/View.type';
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import { useWorkspace } from '~/components/contexts/workspace';
import { RouterOutput, trpc } from '~/utils/trpc';
import Link from 'next/link';
import { Menu } from '@headlessui/react';
import CreateEmployeeHistoryModal from '~/components/page_components/workspaces/employee-history/CreateHistory.modal';
import { AppRouter } from '~/server/routers/_app';
import { ComputedField, evaluateComputedColumn } from '~/utils/viewComputedColumns';

type ViewRow = (RouterOutput['workspaces']['workspace']['views']['compute'])['response'][0];

// Tailwind classes for tag chips, keyed by the tag color.
const TAG_CHIP_CLASSES: Record<string, string> = {
  blue: 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100',
  green: 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100',
  yellow: 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100',
  red: 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100',
};

// Extract the whitelisted numeric fields a computed-column formula can use.
function getRowFields(trow: ViewRow): Record<ComputedField, number> {
  return {
    total: Math.round(trow?.minutes?.total || 0),
    active: Math.round(trow?.minutes?.active || 0),
    idle: Math.round(trow?.minutes?.inactive || 0),
    typing: Math.round(trow?.minutes?.typing || 0),
    messages: Math.round(trow?.minutes?.messages || 0),
    sessions: trow?.attendedSessions?.length || 0,
    plays: trow?.sessions?.length || 0,
    attended: trow?.attendedSessions?.length || 0,
  };
}

// Map a sortable category to the row's raw numeric value (for conditional rules).
function getCategoryValue(trow: ViewRow, category: Categories): number {
  switch (category) {
    case 'totalMinutes':
      return Math.round(trow?.minutes?.total || 0);
    case 'activeMinutes':
      return Math.round(trow?.minutes?.active || 0);
    case 'typingMinutes':
      return Math.round(trow?.minutes?.typing || 0);
    case 'idleMinutes':
      return Math.round(trow?.minutes?.inactive || 0);
    case 'messages':
      return Math.round(trow?.minutes?.messages || 0);
    case 'sessions':
      return trow?.attendedSessions?.length || 0;
    default:
      return 0;
  }
}

// Soft background tints for conditional formatting, keyed by brand color.
const CONDITIONAL_TINT: Record<string, string> = {
  red: 'bg-red-100 dark:bg-red-900/30',
  orange: 'bg-orange-100 dark:bg-orange-900/30',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
  green: 'bg-green-100 dark:bg-green-900/30',
  teal: 'bg-teal-100 dark:bg-teal-900/30',
  sky: 'bg-sky-100 dark:bg-sky-900/30',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30',
  blue: 'bg-blue-100 dark:bg-blue-900/30',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30',
  purple: 'bg-purple-100 dark:bg-purple-900/30',
  rose: 'bg-rose-100 dark:bg-rose-900/30',
  pink: 'bg-pink-100 dark:bg-pink-900/30',
};

function ruleMatches(rule: ConditionalRule, value: number): boolean {
  switch (rule.type) {
    case '<':
      return value < rule.value;
    case '<=':
      return value <= rule.value;
    case '>':
      return value > rule.value;
    case '>=':
      return value >= rule.value;
    case '=':
      return value === rule.value;
    case '!=':
      return value !== rule.value;
    default:
      return false;
  }
}

// Resolve the background tint class for a sortable column cell given the view's
// conditional rules (first matching rule wins).
function conditionalTintFor(trow: ViewRow, category: Categories | undefined, rules?: ConditionalRule[]): string {
  if (!category || !rules || rules.length === 0) return '';
  const value = getCategoryValue(trow, category);
  const match = rules.find((r) => r.column === category && ruleMatches(r, value));
  return match ? CONDITIONAL_TINT[match.color] || '' : '';
}

// Brand color -> hex (500 shade) for MUI sx accents (selection, focus rings).
const BRAND_HEX: Record<string, string> = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e',
  teal: '#14b8a6', sky: '#0ea5e9', cyan: '#06b6d4', blue: '#3b82f6',
  indigo: '#6366f1', purple: '#a855f7', rose: '#f43f5e', pink: '#ec4899', gray: '#6b7280',
};

// The sortable metric fields whose DataGrid field name equals the Categories key.
const METRIC_FIELDS = new Set<Categories>([
  'totalMinutes', 'activeMinutes', 'idleMinutes', 'typingMinutes', 'messages', 'sessions',
]);

// Small up/down delta indicator used by the distribution-comparison columns.
// `invert` flips the good/bad coloring (e.g. idle minutes: lower is better).
function DeltaBadge({ diff, invert }: { diff: number; invert?: boolean }) {
  if (diff === 0) return <span className="text-[10px] text-gray-400 ml-1">±0</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`text-[10px] ml-1 font-semibold ${good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {diff > 0 ? '▲' : '▼'}{Math.abs(diff).toLocaleString()}
    </span>
  );
}

// A numeric metric cell that optionally shows the delta vs the comparison
// distribution so staff can instantly see who is trending up or down.
function MetricValue({ value, prev, invert }: { value: number; prev?: number; invert?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      {value.toLocaleString()}
      {prev !== undefined && <DeltaBadge diff={value - prev} invert={invert} />}
    </span>
  );
}

// Overall momentum vs the comparison distribution: improvement in the metrics
// that matter most (active minutes + messages, minus extra idle time). Lets a
// manager recognize/reward risers and address decliners at a glance.
function momentumScore(trow: ViewRow): number | null {
  if (!trow.comparison) return null;
  const active = Math.round(trow?.minutes?.active || 0) - trow.comparison.active;
  const messages = Math.round(trow?.minutes?.messages || 0) - trow.comparison.messages;
  const idle = Math.round(trow?.minutes?.inactive || 0) - trow.comparison.idle;
  return active + messages - idle;
}

// Single source of truth for every built-in column the view table can render.
type ColumnDef = {
  kind?: 'standard';
  key: ViewColumnKey;
  label: string;
  sortField?: Categories;
  align?: 'left' | 'center';
};

// A user-defined computed column rendered after the built-in columns.
type ComputedTableColumn = {
  kind: 'computed';
  key: string;
  label: string;
  computed: ComputedColumn;
};

type TableColumn = ColumnDef | ComputedTableColumn;

function isComputed(col: TableColumn): col is ComputedTableColumn {
  return (col as ComputedTableColumn).kind === 'computed';
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'index', label: '#', align: 'center' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'tags', label: 'Tags' },
  { key: 'plays', label: 'Plays' },
  { key: 'totalMinutes', label: 'Total Minutes', sortField: 'totalMinutes' },
  { key: 'activeMinutes', label: 'Active Minutes', sortField: 'activeMinutes' },
  { key: 'idleMinutes', label: 'Idle Minutes', sortField: 'idleMinutes' },
  { key: 'typingMinutes', label: 'Typing Minutes', sortField: 'typingMinutes' },
  { key: 'messages', label: 'Messages', sortField: 'messages' },
  { key: 'sessions', label: 'Sessions', sortField: 'sessions' },
  { key: 'goals', label: 'Goals' },
  { key: 'lastSeen', label: 'Last Seen' },
];

// Resolve the ordered list of visible columns for a view, appending any custom
// computed columns at the end. Legacy views (no saved config) show all built-ins.
function resolveColumns(view?: View): TableColumn[] {
  let built: TableColumn[];
  if (!view?.columns || view.columns.length === 0) {
    built = [...COLUMN_DEFS];
  } else {
    const configured = view.columns
      .filter((c) => c.visible)
      .map((c) => COLUMN_DEFS.find((d) => d.key === c.key))
      .filter((d): d is ColumnDef => Boolean(d));
    // Append any columns added after the config was saved (visible by default).
    const missing = COLUMN_DEFS.filter((d) => !view.columns!.some((c) => c.key === d.key));
    built = [...configured, ...missing];
  }
  const computed: TableColumn[] = (view?.computedColumns || []).map((c) => ({
    kind: 'computed' as const,
    key: c.key,
    label: c.label,
    computed: c,
  }));
  return [...built, ...computed];
}

// Inline tag chips with quick add/remove, so staff no longer need to
// right-click a row just to see or manage someone's tags.
function TagCell({ trow }: { trow: ViewRow }) {
  const context = trpc.useUtils();
  const { data: allTags } = trpc.workspaces.workspace.settings.userTags.get.useQuery({ groupId: trow.groupId });
  const addTag = trpc.workspaces.workspace.settings.userTags.addMemberToTag.useMutation();
  const removeTag = trpc.workspaces.workspace.settings.userTags.removeMemberFromTag.useMutation();

  const refresh = () => context.workspaces.workspace.views.compute.invalidate();
  const assignedIds = new Set((trow.tags || []).map((t) => t?.tagId));
  const available = (allTags || []).filter((t) => !assignedIds.has(t.tagId));

  return (
    <div className="flex flex-row flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {(trow.tags || []).map((tag) => {
        if (!tag) return null;
        return (
          <span
            key={tag.tagId}
            className={`${TAG_CHIP_CLASSES[tag.color] || TAG_CHIP_CLASSES.blue} px-2 py-0.5 rounded-md text-xs font-medium flex flex-row items-center gap-1`}
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag
                  .mutateAsync({ groupId: trow.groupId, userId: trow.userId, tagId: tag.tagId })
                  .then(() => {
                    toast.success('Removed tag');
                    refresh();
                  })
                  .catch(() => toast.error('Failed to remove tag'));
              }}
            >
              <XMarkIcon className="w-3.5 h-3.5 p-0.5 rounded-full hover:bg-black/10 transition" />
            </button>
          </span>
        );
      })}
      {(trow.noteCount || 0) > 0 && (
        <Link
          href={`/workspaces/${trow.groupId}/users/${trow.userId}/notes`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="flex flex-row items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium transition"
          title="View notes"
        >
          <DocumentTextIcon className="w-3.5 h-3.5" />
          {trow.noteCount}
        </Link>
      )}
      <Menu as="div" className="relative">
        <Menu.Button
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 text-gray-600 rounded-md transition"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </Menu.Button>
        <Menu.Items className="absolute z-50 left-0 mt-1 bg-white dark:bg-gray-800 max-w-xs w-48 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col p-1">
          {(allTags?.length || 0) === 0 && (
            <p className="text-xs text-center p-2 text-gray-500">No tags yet. Create tags in workspace settings.</p>
          )}
          {available.length === 0 && (allTags?.length || 0) > 0 && (
            <p className="text-xs text-center p-2 text-gray-500">All tags assigned.</p>
          )}
          {available.map((tag) => (
            <Menu.Item key={tag.tagId}>
              {() => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addTag
                      .mutateAsync({ groupId: trow.groupId, userId: trow.userId, tagId: tag.tagId })
                      .then(() => {
                        toast.success('Added tag');
                        refresh();
                      })
                      .catch(() => toast.error('Failed to add tag'));
                  }}
                  className="flex flex-row items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <span className={`${TAG_CHIP_CLASSES[tag.color] || TAG_CHIP_CLASSES.blue} w-2.5 h-2.5 rounded-full`} />
                  {tag.name}
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Menu>
    </div>
  );
}

// A roll-up "Goals" cell: shows how many applicable goals the member met this
// distribution (e.g. "2/3 goals") and, on click, expands to a per-goal,
// per-requirement breakdown. Rendered into a portal so it isn't clipped by the
// DataGrid cell's overflow.
function GoalsCell({ trow }: { trow: ViewRow }) {
  const goals = trow.goalProgress || [];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (goals.length === 0) return <span className="text-gray-400">—</span>;

  const metAll = goals.filter((g) => g.metAll).length;
  const total = goals.length;
  const chipCls =
    metAll === total
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : metAll === 0
        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ x: r.left, y: r.bottom + 4 });
          setOpen((o) => !o);
        }}
        className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${chipCls}`}
        title="Goals met this distribution"
      >
        {metAll}/{total} goals
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ left: Math.min(pos.x, (typeof window !== 'undefined' ? window.innerWidth : 0) - 300), top: pos.y }}
              className="fixed w-72 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col gap-2"
            >
              {goals.map((g) => (
                <div key={g.goalId} className="rounded-md border border-gray-100 dark:border-gray-700 p-2">
                  <div className="flex flex-row items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{g.name}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${g.metAll
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}
                    >
                      {g.metAll ? 'Met' : `${g.metCount}/${g.totalCount}`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {g.requirements.map((r) => (
                      <div key={r.type} className="flex flex-row items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{r.label}</span>
                        <span className={r.metGoal ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                          {r.metGoal ? '✓ ' : ''}{r.at.toLocaleString()}/{r.goal.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// Render the inner content of a DataGrid cell for the given column. Conditional
// formatting tint is applied at the column (cellClassName) level, not here.
function renderGridCell(col: TableColumn, trow: ViewRow): React.ReactNode {
  if (isComputed(col)) {
    const result = evaluateComputedColumn(col.computed.expression, getRowFields(trow));
    const display =
      result === null
        ? '—'
        : col.computed.format === 'percent'
          ? `${(Math.round(result * 10) / 10).toLocaleString()}%`
          : (Math.round(result * 100) / 100).toLocaleString();
    return <span className="font-medium">{display}</span>;
  }

  const cmp = trow.comparison;

  switch (col.key) {
    case 'index':
      return <span>{trow.index.toLocaleString()}</span>;
    case 'name':
      return (
        <div className="flex flex-row items-center gap-2 w-full">
          <div className="relative shrink-0">
            <img alt={`${trow?.member?.name} icon`} src={trow?.thumbnail} className="w-9 h-9 rounded-full" />
            <span className="absolute bottom-0 right-0 flex h-2.5 w-2.5">
              {trow?.playerInGame && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${trow?.playerInGame ? 'bg-green-500' : 'bg-red-500'}`} />
            </span>
          </div>
          <span className="font-medium text-sm truncate">{trow?.member?.name}</span>
        </div>
      );
    case 'role':
      return <span>{trow?.member?.rankName}</span>;
    case 'tags':
      return <TagCell trow={trow} />;
    case 'plays':
      return <MetricValue value={Math.round(trow?.sessions?.length || 0)} prev={cmp?.plays} />;
    case 'totalMinutes':
      return <MetricValue value={Math.round(trow?.minutes?.total || 0)} prev={cmp?.total} />;
    case 'activeMinutes':
      return <MetricValue value={Math.round(trow?.minutes?.active || 0)} prev={cmp?.active} />;
    case 'idleMinutes':
      return <MetricValue value={Math.round(trow?.minutes?.inactive || 0)} prev={cmp?.idle} invert />;
    case 'typingMinutes':
      return <MetricValue value={Math.round(trow?.minutes?.typing || 0)} prev={cmp?.typing} />;
    case 'messages':
      return <MetricValue value={Math.round(trow?.minutes?.messages || 0)} prev={cmp?.messages} />;
    case 'sessions':
      return (
        <span className="whitespace-nowrap">
          {trow?.attendedSessions?.length?.toLocaleString()}/{trow?.totalSessionsClaimed?.toLocaleString()}
          {cmp && <DeltaBadge diff={(trow?.attendedSessions?.length || 0) - cmp.sessions} />}
        </span>
      );
    case 'goals':
      return <GoalsCell trow={trow} />;
    case 'lastSeen':
      return trow?.lastSession ? <ReactTimeago date={trow?.lastSession?.created} /> : <span>Not seen</span>;
    default:
      return null;
  }
}

function StaffContextMenu({
  trow,
  i,
  contextMenu,
  setContextMenu,
  setCreatingLog
}: PropsWithChildren<{
  i: number;
  trow: (RouterOutput['workspaces']['workspace']['views']['compute'])['response'][0];
  contextMenu: false | { x: number; y: number; },
  setContextMenu: any;
  creatingLog: any;
  setCreatingLog: any;
}>) {
  // Ref for the context menu to measure its size
  const menuRef = useRef(null);
  const workspace = useWorkspace();
  const [closing, setClosing] = useState(false);
  const [yPosition, setYPosition] = useState(0);
  const [xPosition, setXPosition] = useState(0);

  const context = trpc.useUtils();
  const { data: tags } = trpc.workspaces.workspace.settings.userTags.get.useQuery({ groupId: trow.groupId });
  const { data: userTags } = trpc.workspaces.workspace.settings.userTags.getUser.useQuery({ groupId: trow.groupId, userId: trow.userId });
  const addTag = trpc.workspaces.workspace.settings.userTags.addMemberToTag.useMutation();
  const removeTag = trpc.workspaces.workspace.settings.userTags.removeMemberFromTag.useMutation();

  // Adjust the menu position to stay within the viewport. We write to LOCAL
  // state only (never back to the parent's contextMenu) to avoid an infinite
  // render loop where setting contextMenu re-triggers this effect.
  useEffect(() => {
    if (closing) {
      setContextMenu(false);
      return;
    }
    if (contextMenu && menuRef.current) {
      const menuElement = menuRef.current as HTMLElement;
      const menuRect = menuElement.getBoundingClientRect();
      const pageWidth = window.screen.width;
      const pageHeight = document.getElementsByTagName('html')[0]?.scrollHeight || 0;

      const computedX = (contextMenu.x + menuRect.width) > pageWidth
        ? (pageWidth - menuRect.width) - 5
        : contextMenu.x;
      const computedY = (contextMenu.y + menuRect.height) > pageHeight
        ? (pageHeight - menuRect.height) - 5
        : contextMenu.y;
      setXPosition(computedX);
      setYPosition(computedY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu, closing]);

  // Early return if contextMenu is false
  if (!contextMenu) return null;

  return (
    <>
      <div
        ref={menuRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseLeave={() => {
          setClosing(true);
          setContextMenu(false);
        }}
        className='absolute px-2 py-2 bg-white z-50 max-w-sm w-full rounded-lg shadow-lg border border-gray-200 transition dark:bg-gray-800 dark:border-gray-700'
        style={{ left: xPosition, top: yPosition }}
        id="context-menu"
      >
        <div className='flex flex-row gap-2'>
          <img src={trow?.thumbnail} alt="User thumnail" className='w-20 h-20 rounded-full bg-blue-500' />
          <div className='self-center align-middle'>
            <p className='font-medium'>{trow?.member?.name}</p>
            <p className='text-sm font-medium'>{trow?.department?.name} - joined <ReactTimeago date={trow?.member?.created || new Date()} /></p>
          </div>
        </div>
        <hr className='border-gray-200 dark:border-gray-700 mt-2' />
        <div className='mt-2 flex flex-row flex-wrap gap-2'>
          {userTags?.map(uTag => {
            const tag = tags?.find(tag => tag.tagId == uTag.tagId) as Tag;
            if (!tag) return null;
            return (
              <p
                key={!tag?._id ? '' : tag._id.toString()}
                className={`${{
                  blue: 'bg-blue-200 transition dark:bg-blue-800 text-blue-900 dark:text-blue-100',
                  green: 'bg-green-200 transition dark:bg-green-800 text-green-900 dark:text-green-100',
                  yellow: 'bg-yellow-200 transition dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100',
                  red: 'bg-red-200 transition dark:bg-red-800 text-red-900 dark:text-red-100',
                }[tag.color] as string}
          px-2 py-1 rounded-lg text-xs font-medium flex flex-row gap-1`}
              >
                {tag.name}
                <button onClick={() => {
                  removeTag.mutateAsync({ groupId: trow.groupId, userId: trow.userId, tagId: tag.tagId }).then(() => {
                    toast.success('Successfully removed tag from user')
                    context.workspaces.workspace.settings.userTags.getUser.invalidate({ groupId: trow.groupId, userId: trow.userId });
                  }
                  ).catch(() => {
                    toast.error('Something went wrong while trying to remove tag from user')
                  })
                }}>
                  <XMarkIcon
                    className={`${{
                      blue: 'text-blue-700 hover:text-blue-900 hover:bg-blue-100',
                      green: 'text-green-700 hover:text-green-900 hover:bg-green-100',
                      yellow: 'text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100',
                      red: 'text-red-700 hover:text-red-900 hover:bg-red-100',
                    }[tag.color] as string}
  w-4 h-4 p-0.5 rounded-full transition`}
                  />
                </button>
              </p>
            )
          })}
          <Menu>
            <Menu.Button className="px-2 py-1 bg-gray-100 transition dark:bg-gray-800 dark:text-gray-400 text-gray-600 rounded-lg"><PlusIcon className='w-4 h-4' /></Menu.Button>
            <Menu.Items className="absolute bg-gray-100 transition dark:bg-gray-800 mt-8 max-w-sm w-full rounded-lg shadow-lg boder-gray-200 border flex flex-col px-2 py-2">
              {tags?.length == 0 && (
                <>
                  <p className='text-sm font-medium text-center'>You need to create a view to add tags to users!</p>
                  <p className='text-sm text-center'>Tags allow you to segment users into groups for easier processing. You can set them up in your workspace settings.</p>
                </>
              )}
              {tags?.map(tag => (
                <Button icon={PlusIcon} variant="discrete" key={tag.tagId} className='text-left justify-start' onClick={() => {
                  addTag.mutateAsync({ groupId: trow.groupId, userId: trow.userId, tagId: tag.tagId }).then(() => {
                    toast.success('Successfully added tag to user')
                    context.workspaces.workspace.settings.userTags.getUser.invalidate({ groupId: trow.groupId, userId: trow.userId });
                  }
                  ).catch(() => {
                    toast.error('Something went wrong while trying to add tag to user')
                  })
                }}>{tag.name}</Button>
              ))}
            </Menu.Items>
          </Menu>
        </div>
        {(trow.playerInGame && trow?.gameSession && 'runningGame' in trow.gameSession) && (
          <div>
            <hr className='border-gray-200 dark:border-gray-700 mt-2' />
            <div className='mt-2 flex flex-col gap-2'>
              <div className="px-2 py-2 border-2 rounded-lg border-blue-500 flex flex-row gap-4">
                <div className="flex flex-row gap-4">
                  <PlayCircleIcon className='self-center align-middle text-blue-500 w-6 h-6' />
                  <div className="self-center align-middle flex flex-col">
                    <p className="font-bold text-sm">Playing <Link className="transition hover:text-blue-500" href={`https://www.roblox.com/games/${trow.gameSession?.runningGame?.placeId}/aaaaa`} target="__blank">{trow?.gameSession?.game?.name || 'a game'}</Link></p>
                    <small>Joined <ReactTimeago date={trow.playerInGame.joined} /></small>
                  </div>
                </div>
                <Button variant="blue" size="small" className="self-center align-middle" onClick={(a) => {
                  a.preventDefault();
                  window.open(
                    `https://www.roblox.com/games/start?placeId=${trow?.gameSession?.game?.placeId || ''}&launchData=ReAdmin-${trow?.gameSession?.runningGame?.jobId || ''}`,
                    '__blank',
                  );
                }}>Join Game</Button>
              </div>
            </div>
          </div>
        )}
        <hr className='border-gray-200 dark:border-gray-700 mt-2' />
        <div className='mt-2 flex flex-row gap-2'>
          {workspace?.department?.permissions?.writeUps.promote == true && (
            <Button onClick={() => { setCreatingLog({ open: true, type: 'promotion', userId: trow?.userId }) }} variant="blue" className="w-full">Promote</Button>
          )}
          {workspace?.department?.permissions?.writeUps.writeUps == true && (
            <Button onClick={() => { setCreatingLog({ open: true, type: 'writeup', userId: trow?.userId }) }} variant="light_warning" className="w-full">Write Up</Button>
          )}
          {workspace?.department?.permissions?.writeUps.suspensions == true && (
            <Button onClick={() => { setCreatingLog({ open: true, type: 'suspension', userId: trow?.userId }) }} variant="blue" className="w-full">Suspend</Button>
          )}
          {workspace?.department?.permissions?.writeUps.terminations == true && (
            <Button onClick={() => { setCreatingLog({ open: true, type: 'termination', userId: trow?.userId }) }} variant="light_danger" className="w-full">Terminate</Button>
          )}
        </div>
        <Button icon={DocumentTextIcon} onClick={() => { setCreatingLog({ open: true, type: 'history', userId: trow?.userId }) }} variant="discrete" className="w-full mt-2">View past history</Button>
        <hr className='border-gray-200 dark:border-gray-700 mt-2' />
        <NotesPanel groupId={trow.groupId} userId={trow.userId} />
      </div>
    </>
  );
}

// Inline notes panel for the right-click menu: read the latest notes on a staff
// member and quickly add a new one, so managers can document behavior in place.
function NotesPanel({ groupId, userId }: { groupId: string; userId: string }) {
  const context = trpc.useUtils();
  const { data: notes, isLoading } = trpc.workspaces.workspace.activity.users.notes.get.useQuery({ groupId, userId });
  const postNote = trpc.workspaces.workspace.activity.users.notes.post.useMutation();
  const [comment, setComment] = useState('');
  const [admin, setAdmin] = useState(true);

  const submit = () => {
    if (!comment.trim()) return;
    const action = postNote
      .mutateAsync({ groupId, userId, comment: comment.trim(), admin, files: [] })
      .then(() => {
        setComment('');
        context.workspaces.workspace.activity.users.notes.get.invalidate({ groupId, userId });
        context.workspaces.workspace.views.compute.invalidate();
      });
    toast.promise(action, { loading: 'Saving note…', success: 'Note added', error: 'Failed to add note' });
  };

  return (
    <div className="mt-2">
      <div className="flex flex-row items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Notes</p>
        <Link href={`/workspaces/${groupId}/users/${userId}/notes`} target="_blank" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Open all</Link>
      </div>
      <div className="mt-1 max-h-28 overflow-y-auto flex flex-col gap-1">
        {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
        {!isLoading && (notes?.length || 0) === 0 && <p className="text-xs text-gray-400">No notes yet.</p>}
        {notes?.slice(0, 4).map((note) => (
          <div key={note._id.toString()} className="text-xs bg-gray-50 dark:bg-gray-700/50 rounded-md px-2 py-1">
            <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap wrap-break-word">{note.note}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{note.authorInfo?.name} · <ReactTimeago date={note.created} /></p>
          </div>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a note…"
        rows={2}
        className="mt-1 w-full text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 resize-none"
      />
      <div className="flex flex-row items-center justify-between mt-1">
        <label className="flex flex-row items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="rounded" />
          Admin only
        </label>
        <Button size="small" variant="blue" disabled={!comment.trim() || postNote.isPending} onClick={submit}>Add note</Button>
      </div>
    </div>
  );
}

// Small chip shown in a DataGrid metric column header when the view has an
// active filter on that column, so the constraint stays visible.
const FilterChip = ({ filters, fieldName }: { filters: Filter[]; fieldName: Categories }) => {
  const filter = filters.find((f) => f.name === fieldName);
  if (!filter) return null;
  return (
    <span className="ml-1 text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded whitespace-nowrap">
      {filter.type} {filter.value}
    </span>
  );
};

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, viewId }: { groupId: string; viewId: string } =
    router.query as any;
  const workspace = useWorkspace();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [nameSearch, setNameSearch] = useState('');
  const [selectedDistributionNumber, setSelectedDistribution] = useState<
    null | number
  >(null);
  // Distribution comparison: when set, every metric column shows a delta vs this
  // distribution and a momentum column surfaces who is rising/declining.
  const [compareDistributionNumber, setCompareDistribution] = useState<null | number>(null);
  // Game scope: when set, every metric (and goal progress) is re-aggregated from
  // just this game's play sessions instead of counting all games together.
  const [selectedGameId, setSelectedGameId] = useState<null | number>(null);

  // Right-click context menu (reward/discipline + tags), anchored at the cursor.
  const [contextMenu, setContextMenu] = useState<false | { x: number; y: number }>(false);
  const [contextRow, setContextRow] = useState<ViewRow | null>(null);

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [creatingLog, setCreatingLog] = useState({ open: false, type: 'writeup', userId: '1' });

  const { data: distributions } =
    trpc.workspaces.workspace.settings.distributions.get.useQuery({ groupId });

  const { data: games } =
    trpc.workspaces.workspace.games.getGames.useQuery({ groupId });

  // Default the selector to the latest distribution once they load.
  useEffect(() => {
    if (!distributions || distributions.length === 0) return;
    const latest = distributions[distributions.length - 1];
    if (latest && selectedDistributionNumber == null) {
      setSelectedDistribution(parseInt(latest.num.toString()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributions]);

  const startDownloadMutation = trpc.workspaces.workspace.views.createDownload.useMutation();
  const checkDownloadMutation = trpc.workspaces.workspace.views.checkDownload.useMutation();
  const deleteMutation = trpc.workspaces.workspace.views.delete.useMutation();

  // Fetch paginated data
  const { data: computed, isPending } =
    trpc.workspaces.workspace.views.compute.useQuery({
      groupId,
      viewId,
      pageSize,
      page,
      nameSearch,
      distributionNum: selectedDistributionNumber,
      compareDistributionNum: compareDistributionNumber,
      gameId: selectedGameId,
    });

  // trpc.workspaces.workspace.views.compute.useQuery({
  //   groupId,
  //   viewId,
  //   pageSize: 15,
  //   page: page + 1,
  //   nameSearch,
  //   distributionNum: selectedDistributionNumber,
  // }); // fetch a page ahead just to get it ready

  // Function to handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > (computed?.pagination?.totalPages || 0))
      return;
    setPage(newPage);
  };

  const context = trpc.useUtils();
  const updateMeta = trpc.workspaces.workspace.views.updateMeta.useMutation();
  const canEdit = workspace.department.permissions.reports.export;

  const view = computed?.view as View | undefined;
  const columns = resolveColumns(view);
  const compareActive = compareDistributionNumber != null && compareDistributionNumber !== selectedDistributionNumber;

  // DataGrid sort model derived from the saved view sort (metric columns only).
  //
  // MUST be memoized. `sortModel` is a controlled DataGrid prop, and the grid
  // syncs it into its internal store; rebuilding the array on every render makes
  // that sync fire every render, which re-renders, which rebuilds the array —
  // "Maximum update depth exceeded" (React error #185). Only bites views that
  // actually have a saved sort, which is why it looked view-specific.
  const sortModel: GridSortModel = useMemo(
    () =>
      (view?.sort || [])
        .filter((s) => METRIC_FIELDS.has(s.name))
        .map((s) => ({ field: s.name, sort: s.type === 'ASC' ? 'asc' : 'desc' })),
    [view?.sort],
  );

  // Persist sort changes from DataGrid header clicks.
  const handleSortModelChange = (model: GridSortModel) => {
    if (!view || !canEdit) return;
    const nextSort: Sort[] = model
      .filter((m) => m.sort && METRIC_FIELDS.has(m.field as Categories))
      .map((m) => ({ id: m.field, name: m.field as Categories, type: m.sort === 'asc' ? 'ASC' : 'DESC' }));
    const action = updateMeta
      .mutateAsync({ groupId, viewId, sort: nextSort })
      .then(() => context.workspaces.workspace.views.compute.invalidate());
    toast.promise(action, { loading: 'Sorting…', success: 'View sorted', error: 'Failed to sort' });
  };

  // Column manager: toggle a column's visibility and persist the new config.
  const handleToggleColumn = (key: ViewColumnKey) => {
    if (!view || !canEdit) return;
    const base: ViewColumnConfig[] =
      view.columns && view.columns.length > 0
        ? COLUMN_DEFS.map((d) => {
            const existing = view.columns!.find((c) => c.key === d.key);
            return { key: d.key, visible: existing ? existing.visible : true };
          })
        : COLUMN_DEFS.map((d) => ({ key: d.key, visible: true }));
    const nextColumns = base.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
    const action = updateMeta
      .mutateAsync({ groupId, viewId, columns: nextColumns })
      .then(() => context.workspaces.workspace.views.compute.invalidate());
    toast.promise(action, { loading: 'Updating columns…', success: 'Columns updated', error: 'Failed to update columns' });
  };

  const isColumnVisible = (key: ViewColumnKey) => {
    if (!view?.columns || view.columns.length === 0) return true;
    const found = view.columns.find((c) => c.key === key);
    return found ? found.visible : true;
  };

  // --- Bulk row selection + actions ---
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const { data: allTags } = trpc.workspaces.workspace.settings.userTags.get.useQuery({ groupId });
  const bulkAddTag = trpc.workspaces.workspace.settings.userTags.addMembersToTag.useMutation();

  // Bulk staff-history + bulk note state.
  const [bulkHistory, setBulkHistory] = useState<false | { open: boolean; type: 'promotion' | 'writeup' | 'suspension' | 'termination' }>(false);
  const [bulkNoteOpen, setBulkNoteOpen] = useState(false);
  const bulkHistoryMutation = trpc.workspaces.workspace.history.createBulkHistory.useMutation();
  const bulkNoteMutation = trpc.workspaces.workspace.activity.users.notes.bulkPost.useMutation();

  const toggleSelect = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const pageUserIds = (computed?.response || []).map((r) => r.userId);
  const allPageSelected = pageUserIds.length > 0 && pageUserIds.every((id) => selectedUsers.has(id));

  const toggleSelectAll = () => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageUserIds.forEach((id) => next.delete(id));
      else pageUserIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleBulkTag = (tagId: string) => {
    const userIds = Array.from(selectedUsers);
    if (userIds.length === 0) return;
    const action = bulkAddTag
      .mutateAsync({ groupId, tagId, userIds })
      .then((res) => {
        context.workspaces.workspace.views.compute.invalidate();
        setSelectedUsers(new Set());
        return res;
      });
    toast.promise(action, {
      loading: `Tagging ${userIds.length} users…`,
      success: (res) => `Tagged ${res.added} users${res.skipped ? ` (${res.skipped} already had it)` : ''}`,
      error: 'Failed to tag users',
    });
  };

  // (The effect that defaulted the distribution selector used to be duplicated
  // here. The copy above is the same logic with an empty-array guard — this one
  // indexed `distributions[length - 1]` without checking, so a workspace with no
  // distributions crashed on `.num` of undefined.)

  // Right-click a row to open the reward/discipline + tag context menu.
  const handleRowContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const id = e.currentTarget.getAttribute('data-id');
    if (!id) return;
    const row = (computed?.response || []).find((r) => r.userId === id) || null;
    if (row) {
      setContextRow(row);
      setContextMenu({ x: e.pageX - 20, y: e.pageY - 20 });
    }
  };

  // Fields that should NOT open the user's activity page when their cell is clicked.
  const NON_NAV_FIELDS = new Set(['__select', 'tags', '__actions', '__momentum']);

  // Default per-column width for the built-in columns.
  const widthFor = (key: ViewColumnKey): number => {
    switch (key) {
      case 'index': return 64;
      case 'role': return 150;
      case 'plays': return 110;
      case 'goals': return 130;
      case 'lastSeen': return 150;
      default: return compareActive ? 150 : 120;
    }
  };

  // Stable identities for the other DataGrid props that feed its internal store.
  // `rows` in particular would otherwise be a brand-new [] on every render while
  // the query is still loading.
  const rows = useMemo(() => computed?.response || [], [computed?.response]);
  const paginationModel = useMemo(
    () => ({ page: page - 1, pageSize }),
    [page, pageSize],
  );

  // Build the MUI DataGrid columns from the resolved view columns, layering in
  // the selection, momentum (comparison), and quick-action columns.
  const gridColumns: GridColDef<ViewRow>[] = [
    {
      field: '__select',
      headerName: '',
      width: 50,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      hideable: false,
      renderHeader: () => (
        <input
          type="checkbox"
          checked={allPageSelected}
          onChange={toggleSelectAll}
          className="rounded cursor-pointer"
          aria-label="Select all on page"
        />
      ),
      renderCell: (params: GridRenderCellParams<ViewRow>) => (
        <input
          type="checkbox"
          checked={selectedUsers.has(params.row.userId)}
          onChange={() => toggleSelect(params.row.userId)}
          onClick={(e) => e.stopPropagation()}
          className="rounded cursor-pointer"
        />
      ),
    },
    ...columns.map((col): GridColDef<ViewRow> => {
      const sortable = !isComputed(col) && Boolean(col.sortField) && METRIC_FIELDS.has(col.sortField as Categories);
      const sortField = !isComputed(col) ? col.sortField : undefined;
      return {
        field: col.key,
        headerName: col.label,
        sortable,
        filterable: false,
        disableColumnMenu: true,
        flex: !isComputed(col) && col.key === 'name' ? 1 : undefined,
        minWidth: !isComputed(col) && col.key === 'name' ? 200 : undefined,
        width: isComputed(col) ? 140 : col.key === 'name' ? undefined : col.key === 'tags' ? 240 : widthFor(col.key),
        cellClassName: () => '!flex !items-center',
        renderHeader: () => (
          <span className="flex items-center font-medium text-sm" title={isComputed(col) ? `= ${col.computed.expression}` : undefined}>
            {col.label}
            {sortField && <FilterChip filters={view?.filters || []} fieldName={sortField} />}
          </span>
        ),
        renderCell: (params: GridRenderCellParams<ViewRow>) => {
          const tint = sortField ? conditionalTintFor(params.row, sortField, view?.conditionalRules) : '';
          const content = renderGridCell(col, params.row);
          return tint ? <div className={`w-full h-full flex items-center px-2 -mx-2 ${tint}`}>{content}</div> : content;
        },
      };
    }),
    ...(compareActive
      ? [{
        field: '__momentum',
        headerName: 'Momentum',
        width: 130,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params: GridRenderCellParams<ViewRow>) => {
          const score = momentumScore(params.row);
          if (score === null) return null;
          const label = score > 0 ? 'Rising' : score < 0 ? 'Declining' : 'Steady';
          const cls = score > 0
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : score < 0
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`} title={`Momentum score: ${score > 0 ? '+' : ''}${score.toLocaleString()}`}>
              {score > 0 ? '▲' : score < 0 ? '▼' : '■'} {label}
            </span>
          );
        },
      } as GridColDef<ViewRow>]
      : []),
    {
      field: '__actions',
      headerName: '',
      width: 56,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      hideable: false,
      renderCell: (params: GridRenderCellParams<ViewRow>) => (
        <button
          title="Actions, history & notes"
          onClick={(e) => {
            e.stopPropagation();
            setContextRow(params.row);
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setContextMenu({ x: rect.left + window.scrollX - 300, y: rect.bottom + window.scrollY });
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition"
        >
          <EllipsisVerticalIcon className="w-5 h-5" />
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="px-4 sm:px-6 pt-5 pb-2">
        {view && (
          <div className="flex flex-row items-center gap-2.5 mb-4">
            <span
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-lg bg-${view.color || workspace?.brandColor || 'blue'}-100 dark:bg-${view.color || workspace?.brandColor || 'blue'}-900`}
            >
              {view.icon || '📊'}
            </span>
            <div>
              <h1 className="text-xl font-semibold leading-tight text-gray-900 dark:text-gray-100">{view.name}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{computed?.pagination?.total?.toLocaleString() ?? '—'} staff</p>
            </div>
          </div>
        )}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <div className="flex flex-col gap-1 min-w-50 grow">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 py-1.5 pl-9 pr-3 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  type="text"
                  onChange={(t) => setNameSearch(t.target.value)}
                  placeholder="Search by name"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 min-w-60">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Distribution</label>
              <DistributionSelector
                distributions={(distributions as any) || []}
                value={selectedDistributionNumber}
                onChange={(num) => setSelectedDistribution(num)}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Compare to</label>
              <DistributionSelector
                distributions={((distributions as any) || []).filter((d: any) => d.num !== selectedDistributionNumber)}
                value={compareDistributionNumber}
                onChange={(num) => setCompareDistribution(num)}
                allowNone
                noneLabel="No comparison"
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Game</label>
              <select
                value={selectedGameId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGameId(val === '' ? null : parseInt(val));
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 py-1.5 px-2 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All games</option>
                {(games || []).map((game: any) => (
                  <option key={game.gameId} value={game.gameId}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-1.5 justify-start xl:justify-end shrink-0">
            <Menu as="div" className="relative">
              <Menu.Button as="div">
                <Button variant="discrete" icon={ViewColumnsIcon}>Columns</Button>
              </Menu.Button>
              <Menu.Items className="absolute right-0 z-50 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 max-h-80 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 px-2 py-1.5">Show / hide columns</p>
                {COLUMN_DEFS.filter((c) => c.key !== 'name').map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleToggleColumn(col.key)}
                    className="w-full flex flex-row items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={isColumnVisible(col.key)}
                      className="pointer-events-none rounded"
                    />
                    {col.label}
                  </button>
                ))}
              </Menu.Items>
            </Menu>
            <Button
              variant="discrete"
              onClick={() => {
                setShowDownloadModal(true);
              }}
              icon={ArrowDownTrayIcon}
            >
              Export
            </Button>
            {workspace.department.permissions.reports.export && (<React.Fragment>
              <Button
                variant="discrete"
                href={`/workspaces/${groupId}/views/${viewId}/edit`}
                icon={CogIcon}
              >
                Edit
              </Button>
              <Button
                variant="discrete"
                onClick={() => {
                  setShowDeleteModal(true);
                }}
                icon={TrashIcon}
              >
                Delete
              </Button>
            </React.Fragment>)}
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 pb-6">
      {selectedUsers.size > 0 && (
        <div className="flex flex-row flex-wrap items-center justify-between gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2 mt-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {selectedUsers.size} selected
          </p>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Menu as="div" className="relative">
              <Menu.Button as="div">
                <Button variant="blue" size="small" icon={PlusIcon}>Add tag</Button>
              </Menu.Button>
              <Menu.Items className="absolute right-0 z-50 mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 max-h-72 overflow-y-auto">
                {(allTags?.length || 0) === 0 && (
                  <p className="text-xs text-center p-2 text-gray-500">No tags yet. Create tags in workspace settings.</p>
                )}
                {allTags?.map((tag) => (
                  <Menu.Item key={tag.tagId}>
                    {() => (
                      <button
                        onClick={() => handleBulkTag(tag.tagId)}
                        className="w-full flex flex-row items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <span className={`${TAG_CHIP_CLASSES[tag.color] || TAG_CHIP_CLASSES.blue} w-2.5 h-2.5 rounded-full`} />
                        {tag.name}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </Menu.Items>
            </Menu>
            {(workspace?.department?.permissions?.writeUps?.promote || workspace?.department?.permissions?.writeUps?.writeUps || workspace?.department?.permissions?.writeUps?.suspensions || workspace?.department?.permissions?.writeUps?.terminations) && (
              <Menu as="div" className="relative">
                <Menu.Button as="div">
                  <Button variant="light_warning" size="small" icon={DocumentTextIcon}>Give history</Button>
                </Menu.Button>
                <Menu.Items className="absolute right-0 z-50 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1">
                  {workspace?.department?.permissions?.writeUps?.promote && (
                    <Menu.Item>{() => (<button onClick={() => setBulkHistory({ open: true, type: 'promotion' })} className="w-full text-left text-sm px-2 py-1.5 rounded-md text-green-700 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Promote</button>)}</Menu.Item>
                  )}
                  {workspace?.department?.permissions?.writeUps?.writeUps && (
                    <Menu.Item>{() => (<button onClick={() => setBulkHistory({ open: true, type: 'writeup' })} className="w-full text-left text-sm px-2 py-1.5 rounded-md text-yellow-700 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Write Up</button>)}</Menu.Item>
                  )}
                  {workspace?.department?.permissions?.writeUps?.suspensions && (
                    <Menu.Item>{() => (<button onClick={() => setBulkHistory({ open: true, type: 'suspension' })} className="w-full text-left text-sm px-2 py-1.5 rounded-md text-orange-700 dark:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Suspend</button>)}</Menu.Item>
                  )}
                  {workspace?.department?.permissions?.writeUps?.terminations && (
                    <Menu.Item>{() => (<button onClick={() => setBulkHistory({ open: true, type: 'termination' })} className="w-full text-left text-sm px-2 py-1.5 rounded-md text-red-700 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Terminate</button>)}</Menu.Item>
                  )}
                </Menu.Items>
              </Menu>
            )}
            <Button variant="discrete" size="small" icon={DocumentTextIcon} onClick={() => setBulkNoteOpen(true)}>Add note</Button>
            <Button variant="discrete" size="small" onClick={() => setSelectedUsers(new Set())}>Clear</Button>
          </div>
        </div>
      )}
      <div className="mt-2 w-full max-w-full overflow-hidden">
        <Box
          sx={{
            width: '100%',
            maxWidth: '100%',
            height: 'calc(100vh - 240px)',
            minHeight: 420,
            '& .MuiDataGrid-root': {
              border: 'none',
              borderRadius: '0.75rem',
              maxWidth: '100%',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'var(--dg-header-bg, transparent)',
            },
            '& .MuiCheckbox-root.Mui-checked, & .MuiCheckbox-root.MuiCheckbox-indeterminate': {
              color: BRAND_HEX[(view?.color || workspace?.brandColor || 'blue') as keyof typeof BRAND_HEX] || BRAND_HEX.blue,
            },
          }}
        >
          <DataGrid<ViewRow>
            rows={rows}
            columns={gridColumns}
            getRowId={(r) => r.userId}
            loading={isPending}
            paginationMode="server"
            sortingMode="server"
            rowCount={computed?.pagination?.total || 0}
            paginationModel={paginationModel}
            onPaginationModelChange={(m) => {
              if (m.pageSize !== pageSize) {
                setPageSize(m.pageSize);
                setPage(1);
              } else {
                handlePageChange(m.page + 1);
              }
            }}
            pageSizeOptions={[15, 25, 50, 100]}
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            disableRowSelectionOnClick
            disableColumnFilter
            rowHeight={56}
            onCellClick={(params, event) => {
              if (NON_NAV_FIELDS.has(params.field)) return;
              if ((event.target as HTMLElement).closest('a,button,input')) return;
              window.open(`/workspaces/${groupId}/users/${params.row.userId}/activity`, '_blank');
            }}
            slotProps={{ row: { onContextMenu: handleRowContextMenu } }}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
      </div>
      </div>

      {contextMenu && contextRow && (
        <StaffContextMenu
          trow={contextRow}
          i={0}
          contextMenu={contextMenu}
          setContextMenu={(v: false | { x: number; y: number }) => {
            setContextMenu(v);
            if (!v) setContextRow(null);
          }}
          creatingLog={creatingLog}
          setCreatingLog={setCreatingLog}
        />
      )}

      <Modal setOpen={setShowDeleteModal} open={showDeleteModal}>
        <PageHeading title="Are you sure you want to delete this view?" />
        <p>You can not recover this view, however, you can recreate a similar view using the same properties you set for this view.</p>
        <div className="flex flex-row gap-2 mt-2 w-full">
          <Button className='w-full' size="medium" variant="primary" onClick={() => {
            setShowDeleteModal(false);
          }}>
            Cancel
          </Button>
          <Button className='w-full' size="medium" variant="danger" onClick={() => {
            const action = new Promise<void>((resolve, reject) => {
              deleteMutation.mutateAsync({ groupId, viewId }).then(() => {
                resolve();
                router.push(`/workspaces/${groupId}/views`)
              }).catch(e => {
                reject(e);
              })
            });

            toast.promise(action, {
              loading: 'Deleting view',
              success: 'Deleted view',
              error: 'Failed to delete view'
            })
          }}>
            Delete
          </Button>
        </div>
      </Modal>
      <Modal setOpen={setShowDownloadModal} open={showDownloadModal}>
        <div>
          <PageHeading title="Let's download this view" />
          <form
            onSubmit={async (f) => {
              f.preventDefault();
              const target = f.target as any;
              const exportType = target.exportType.value;
              if ((startDownloadMutation.isSuccess || startDownloadMutation.isPending)) {
                return;
              }
              const action = new Promise<void>((resolve, reject) => {
                startDownloadMutation.mutateAsync({
                  groupId, viewId, distributionNum: selectedDistributionNumber, exportType
                }).then(start => {

                  const interval = setInterval(() => {
                    checkDownloadMutation.mutateAsync({ groupId, processId: start }).then((resp) => {
                      if (resp.status == 'finished') {
                        resolve();
                        clearInterval(interval);
                        window.open(resp.url, '__blank');
                        setDownloadUrl(resp?.url ? resp.url : '')
                      }

                    }).catch((err) => {
                      reject(err);
                      clearInterval(interval);
                    })
                  }, 5000)


                }).catch(e => {
                  reject(e);
                })
              });

              toast.promise(action, {
                loading: 'Starting download - do not close this page!',
                success: 'Download started',
                error: 'Failed to start download'
              })

            }}>
            <div className="mt-2 flex flex-col gap-2">
              {(startDownloadMutation.isSuccess || startDownloadMutation.isPending) ? (<div>
                {downloadUrl ? (<>
                  <Button variant="primary" onClick={() => {
                    window.open(downloadUrl, '__blank');
                  }}>Download</Button>
                </>) : (
                  <>
                    <p>Do not close this modal, we are starting your download. If you are not redirected to the download page, a blue downlaod button will appear.</p>
                  </>
                )}
              </div>) : (<>
                <Dropdown
                  id="exportType"
                  label="Download type"
                  choices={[
                    { id: 'json', name: 'JSON' },
                    { id: 'csv', name: 'CSV' },
                  ]}
                />
                <Button variant="primary" disabled={(startDownloadMutation.isSuccess || startDownloadMutation.isPending)}>Start Download</Button>
              </>)}
            </div>
          </form>
        </div>
      </Modal>
      <CreateEmployeeHistoryModal key="employee-log" groupId={workspace.groupId} open={creatingLog.open} setOpen={() => setCreatingLog({ ...creatingLog, open: false })} userId={creatingLog.userId} showPastHistory={true} jumpToCreating={creatingLog.type === 'history' ? undefined : (creatingLog.type as 'promotion' | 'writeup' | 'suspension' | 'termination' || 'writeup')} />

      {bulkHistory && (
        <BulkHistoryModal
          open={bulkHistory.open}
          type={bulkHistory.type}
          count={selectedUsers.size}
          pending={bulkHistoryMutation.isPending}
          onClose={() => setBulkHistory(false)}
          onSubmit={({ reason, notify, expires }) => {
            const userIds = Array.from(selectedUsers);
            if (userIds.length === 0) return;
            const action = bulkHistoryMutation
              .mutateAsync({ groupId, userIds, reason, type: bulkHistory.type, notify, expires })
              .then((res) => {
                setBulkHistory(false);
                setSelectedUsers(new Set());
                context.workspaces.workspace.views.compute.invalidate();
                return res;
              });
            toast.promise(action, {
              loading: `Applying to ${userIds.length} staff…`,
              success: (res) => `Applied to ${res.created} staff${res.failed ? ` (${res.failed} failed)` : ''}`,
              error: 'Failed to apply history',
            });
          }}
        />
      )}

      <BulkNoteModal
        open={bulkNoteOpen}
        count={selectedUsers.size}
        pending={bulkNoteMutation.isPending}
        onClose={() => setBulkNoteOpen(false)}
        onSubmit={({ comment, admin }) => {
          const userIds = Array.from(selectedUsers);
          if (userIds.length === 0) return;
          const action = bulkNoteMutation
            .mutateAsync({ groupId, userIds, comment, admin })
            .then((res) => {
              setBulkNoteOpen(false);
              setSelectedUsers(new Set());
              context.workspaces.workspace.views.compute.invalidate();
              return res;
            });
          toast.promise(action, {
            loading: `Adding note to ${userIds.length} staff…`,
            success: (res) => `Note added to ${res.created} staff`,
            error: 'Failed to add note',
          });
        }}
      />
    </>
  );
}

// Modal for applying a single staff-history action (promotion/write up/etc.) to
// every selected user at once — managing performance at scale.
function BulkHistoryModal({ open, type, count, pending, onClose, onSubmit }: {
  open: boolean;
  type: 'promotion' | 'writeup' | 'suspension' | 'termination';
  count: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; notify: boolean; expires?: Date }) => void;
}) {
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [expires, setExpires] = useState('');
  const label = { promotion: 'Promotion', writeup: 'Write Up', suspension: 'Suspension', termination: 'Termination' }[type];
  useEffect(() => { if (!open) { setReason(''); setNotify(true); setExpires(''); } }, [open]);
  return (
    <Modal open={open} setOpen={(o: boolean) => { if (!o) onClose(); }}>
      <PageHeading title={`Bulk ${label}`} />
      <p className="text-sm text-gray-500 dark:text-gray-400">Applying to <span className="font-semibold">{count}</span> selected staff.</p>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={`Reason for this ${label.toLowerCase()}…`} className="mt-1 w-full text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 resize-none" />
        </div>
        {type === 'suspension' && (
          <div>
            <label className="text-sm font-medium">Expires (optional)</label>
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-1 w-full text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5" />
          </div>
        )}
        <label className="flex flex-row items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="rounded" />
          Notify staff via Discord
        </label>
      </div>
      <div className="flex flex-row gap-2 mt-4 w-full">
        <Button className="w-full" variant="primary" onClick={onClose}>Cancel</Button>
        <Button className="w-full" variant={type === 'termination' ? 'danger' : 'blue'} disabled={!reason.trim() || pending} onClick={() => onSubmit({ reason: reason.trim(), notify, expires: expires ? new Date(expires) : undefined })}>
          Apply to {count}
        </Button>
      </div>
    </Modal>
  );
}

// Modal for adding the same note to every selected staff member at once.
function BulkNoteModal({ open, count, pending, onClose, onSubmit }: {
  open: boolean;
  count: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: { comment: string; admin: boolean }) => void;
}) {
  const [comment, setComment] = useState('');
  const [admin, setAdmin] = useState(true);
  useEffect(() => { if (!open) { setComment(''); setAdmin(true); } }, [open]);
  return (
    <Modal open={open} setOpen={(o: boolean) => { if (!o) onClose(); }}>
      <PageHeading title="Add note to staff" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Adding a note to <span className="font-semibold">{count}</span> selected staff.</p>
      <div className="mt-3 flex flex-col gap-3">
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="Note…" className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 resize-none" />
        <label className="flex flex-row items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="rounded" />
          Admin only (hidden from the staff member)
        </label>
      </div>
      <div className="flex flex-row gap-2 mt-4 w-full">
        <Button className="w-full" variant="primary" onClick={onClose}>Cancel</Button>
        <Button className="w-full" variant="blue" disabled={!comment.trim() || pending} onClick={() => onSubmit({ comment: comment.trim(), admin })}>
          Add note to {count}
        </Button>
      </div>
    </Modal>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => {
  return (
    <WorkspaceViewSidebarNavigationLayout disablePadding={true}>
      {page}
    </WorkspaceViewSidebarNavigationLayout>
  );
};
