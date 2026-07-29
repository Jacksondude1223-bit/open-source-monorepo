'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  UserGroupIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/20/solid';
import { trpc, RouterOutput } from '~/utils/trpc';
import HeadshotForUserId from '~/components/ui/HeadshotForUserId';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';

type OrgNodeData = RouterOutput['workspaces']['workspace']['teams']['hierarchy']['getOrgChart'][number];

function countMembers(node: OrgNodeData): number {
  return node.members.length + node.children.reduce((sum, c) => sum + countMembers(c), 0);
}

/** Keep nodes whose team (or any descendant) matches the query. */
function filterTree(nodes: OrgNodeData[], query: string): OrgNodeData[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const result: OrgNodeData[] = [];
  for (const node of nodes) {
    const selfMatch =
      node.team.name.toLowerCase().includes(q) ||
      (node.team.description ?? '').toLowerCase().includes(q);
    const filteredChildren = filterTree(node.children, query);
    if (selfMatch || filteredChildren.length > 0) {
      result.push({ ...node, children: selfMatch ? node.children : filteredChildren });
    }
  }
  return result;
}

function OrgNode({
  node,
  depth = 0,
  brandColor,
  groupId,
  expandSignal,
}: {
  node: OrgNodeData;
  depth?: number;
  brandColor: string;
  groupId: string;
  expandSignal: { version: number; expand: boolean | null };
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  useEffect(() => {
    if (expandSignal.expand !== null) setExpanded(expandSignal.expand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandSignal.version]);

  const totalMembers = countMembers(node);

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition shrink-0"
              >
                {expanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <div className={`h-8 w-8 rounded-full bg-${brandColor}-100 dark:bg-${brandColor}-900/30 flex items-center justify-center shrink-0`}>
              <UserGroupIcon className={`w-4 h-4 text-${brandColor}-600`} />
            </div>
            <div className="min-w-0">
              <Link
                href={`/workspaces/${groupId}/teams/${node.team._id?.toString()}`}
                className="font-semibold text-gray-900 dark:text-gray-100 text-sm hover:text-blue-600 dark:hover:text-blue-400 transition"
                onClick={(e) => e.stopPropagation()}
              >
                {node.team.name}
              </Link>
              {node.team.description && (
                <p className="text-xs text-gray-500 truncate">{node.team.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {node.members.length > 0 && (
              <div className="flex -space-x-2">
                {node.members.slice(0, 5).map((m) => (
                  <div key={m.userId} className="ring-2 ring-white dark:ring-gray-800 rounded-full">
                    <HeadshotForUserId userId={m.userId} size={22} />
                  </div>
                ))}
                {node.members.length > 5 && (
                  <div className="flex items-center justify-center h-5.5 w-5.5 rounded-full bg-gray-200 dark:bg-gray-600 text-[10px] font-semibold text-gray-600 dark:text-gray-200 ring-2 ring-white dark:ring-gray-800">
                    +{node.members.length - 5}
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-gray-500 text-right">
              <div>
                {node.members.length} member{node.members.length !== 1 ? 's' : ''}
              </div>
              {hasChildren && (
                <div className="text-gray-400">
                  {totalMembers} total · {node.children.length} sub-team{node.children.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lead members */}
        {node.members.length > 0 &&
          (() => {
            const leads = node.members.filter(
              (m) => node.team.roles.find((r) => r.id === m.roleId)?.isLead,
            );
            if (!leads.length) return null;
            return (
              <div className="mt-3 flex flex-wrap gap-2">
                {leads.map((lead) => (
                  <div
                    key={lead.userId}
                    className={`flex items-center gap-1.5 rounded-full bg-${brandColor}-50 dark:bg-${brandColor}-900/20 px-2.5 py-1`}
                  >
                    <HeadshotForUserId userId={lead.userId} size={18} />
                    <span className={`text-xs font-medium text-${brandColor}-700 dark:text-${brandColor}-300`}>
                      <TextReturnForUserId userId={lead.userId} />
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
      </div>

      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map((child) => (
            <OrgNode
              key={child.team._id?.toString()}
              node={child}
              depth={depth + 1}
              brandColor={brandColor}
              groupId={groupId}
              expandSignal={expandSignal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Self-contained org-chart tree. Fetches its own data so it can be dropped into
 * the Teams page (as the "Org Chart" view) without prop plumbing.
 */
export default function OrgChartView({
  groupId,
  brandColor = 'blue',
}: {
  groupId: string;
  brandColor?: string;
}) {
  const [search, setSearch] = useState('');
  const [expandSignal, setExpandSignal] = useState<{ version: number; expand: boolean | null }>({
    version: 0,
    expand: null,
  });

  const { data: orgChart, isLoading } = trpc.workspaces.workspace.teams.hierarchy.getOrgChart.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  const filteredChart = useMemo(() => filterTree(orgChart ?? [], search.trim()), [orgChart, search]);

  // Auto-expand everything while searching so matches are visible.
  useEffect(() => {
    if (search.trim()) setExpandSignal((s) => ({ version: s.version + 1, expand: true }));
  }, [search]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          />
        ))}
      </div>
    );
  }

  if (!orgChart || orgChart.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
        <UsersIcon className="mx-auto h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">No teams have been created yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button
            onClick={() => setExpandSignal((s) => ({ version: s.version + 1, expand: true }))}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <ArrowsPointingOutIcon className="w-4 h-4" /> Expand all
          </button>
          <button
            onClick={() => setExpandSignal((s) => ({ version: s.version + 1, expand: false }))}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <ArrowsPointingInIcon className="w-4 h-4" /> Collapse all
          </button>
        </div>
      </div>

      {filteredChart.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
          <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No teams match &ldquo;{search}&rdquo;.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredChart.map((node) => (
            <OrgNode
              key={node.team._id?.toString()}
              node={node}
              brandColor={brandColor}
              groupId={groupId}
              expandSignal={expandSignal}
            />
          ))}
        </div>
      )}
    </>
  );
}
