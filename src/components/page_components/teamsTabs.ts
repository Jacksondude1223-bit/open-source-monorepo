import { UserGroupIcon, ChartBarIcon, ClockIcon } from '@heroicons/react/20/solid';
import type { WorkspaceSidebarTabType } from '~/components/page_components/WorkspaceWithExtraSidebarLayout';

/**
 * Single source of truth for the Teams secondary-sidebar navigation.
 *
 * Previously every teams page hand-rolled its own tab array (and they drifted —
 * e.g. a redundant "Org Chart" tab that duplicated the Teams page). Centralizing
 * keeps the nav consistent. `current` is intentionally always false: the layout
 * derives the active tab from the route.
 */
export function teamsTabs(groupId: string): WorkspaceSidebarTabType[] {
  return [
    { name: 'Teams', href: `/workspaces/${groupId}/teams`, icon: UserGroupIcon, current: false },
    { name: 'My Reports', href: `/workspaces/${groupId}/teams/manager`, icon: ChartBarIcon, current: false },
    { name: 'Requests', href: `/workspaces/${groupId}/teams/requests`, icon: ClockIcon, current: false },
  ];
}
