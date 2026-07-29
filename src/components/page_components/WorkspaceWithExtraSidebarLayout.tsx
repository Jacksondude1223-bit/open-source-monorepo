import Link from "next/link"
import router, { useRouter } from "next/router"
import Dropdown from "../forms/Dropdown"
import { ReactNode, useState } from "react";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { useWorkspace } from "../contexts/workspace";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/20/solid";

export type WorkspaceSidebarTabType = { name: string; href: string; icon: any; faIcon?: boolean; current: boolean; canShow?: boolean; };
type DefaultLayoutProps = { children: ReactNode; disablePadding?: boolean; title: string; tabs: WorkspaceSidebarTabType[]; }
export const WorkspaceWithExtraSidebarLayout = ({ children, disablePadding, title, tabs }: DefaultLayoutProps) => {
    const workspace = useWorkspace();
    const brand = workspace?.brandColor || 'blue';
    const visibleTabs = tabs?.filter(tab => tab?.canShow == undefined || tab?.canShow) || [];

    // Derive the active tab from the current route instead of relying on the
    // hardcoded `current` flag each page passes in (which is often stale on
    // sub-pages). The tab whose href is the longest matching prefix wins, so
    // detail routes like `/teams/[teamId]` still highlight the `Teams` tab
    // while `/teams/org-chart` correctly highlights its own tab.
    const { asPath } = useRouter();
    const stripPath = (p: string) => {
        const noHash = p.split('#', 1).join('');
        return noHash.split('?', 1).join('');
    };
    const currentPath = stripPath(asPath || '');
    let activeHref = '';
    for (const tab of visibleTabs) {
        const base = stripPath(tab.href || '');
        if (currentPath === base || currentPath.startsWith(base + '/')) {
            if (base.length > activeHref.length) activeHref = base;
        }
    }
    const isActive = (tab: WorkspaceSidebarTabType) => activeHref !== '' && stripPath(tab.href || '') === activeHref;

    // Persisted collapse state so the secondary nav can shrink to an icon rail.
    // Initialize lazily from localStorage so the sidebar doesn't flash open then
    // collapse on every page change/remount.
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem('extraSidebarCollapsed') === '1';
        } catch {
            return false;
        }
    });
    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try { localStorage.setItem('extraSidebarCollapsed', next ? '1' : '0'); } catch { /* ignore */ }
            return next;
        });
    };

    return (
        <WorkspaceLayout disableMl={true}>
            <div className="flex flex-col sm:flex-row">
                {/* Desktop secondary nav */}
                <aside
                    className={`hidden sm:flex flex-col shrink-0 ${collapsed ? 'w-16' : 'w-60'} min-h-screen gap-1 ${collapsed ? 'px-2' : 'px-4'} pt-6 lg:pt-8 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 transition-all duration-200`}
                >
                    <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 pb-2`}>
                        {!collapsed && (
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">
                                {title}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={toggleCollapsed}
                            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition"
                        >
                            {collapsed ? <ChevronDoubleRightIcon className="w-4 h-4" /> : <ChevronDoubleLeftIcon className="w-4 h-4" />}
                        </button>
                    </div>

                    <nav className="flex flex-col gap-0.5">
                        {visibleTabs.map(tab => {
                            const current = isActive(tab);
                            return (
                            <Link key={tab.href} href={tab.href}
                                aria-current={current ? 'page' : undefined}
                                title={collapsed ? tab.name : undefined}
                                className={`group relative flex flex-row items-center gap-3 rounded-md py-2 ${collapsed ? 'justify-center px-2' : 'pl-3 pr-2'} text-sm font-medium transition
                                    ${current
                                        ? `bg-${brand}-50 text-${brand}-700 dark:bg-${brand}-900/30 dark:text-${brand}-300`
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'}`}
                            >
                                {current && (
                                    <span className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-${brand}-600 dark:bg-${brand}-400`} aria-hidden="true" />
                                )}
                                {tab?.faIcon == true ? (
                                    <FontAwesomeIcon icon={tab.icon} className={`w-4 h-4 shrink-0 transition ${current ? `text-${brand}-600 dark:text-${brand}-400` : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} aria-hidden="true" />
                                ) : (
                                    <tab.icon className={`w-4 h-4 shrink-0 transition ${current ? `text-${brand}-600 dark:text-${brand}-400` : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} aria-hidden="true" />
                                )}
                                {!collapsed && <span className="truncate">{tab.name}</span>}
                            </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Mobile secondary nav */}
                <div className="sm:hidden flex flex-col gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</p>
                    <Dropdown
                        choices={visibleTabs.map(tab => ({ name: tab.name, id: tab.name, icon: tab.icon }))}
                        defaultValue={visibleTabs.find(a => isActive(a))?.name || ''}
                        onChange={(name) => { router.push(tabs.find(a => a.name == name)?.href || '') }}
                    />
                </div>

                <div className={`${!disablePadding ? 'py-10 px-4 sm:px-6 lg:px-8' : ''} w-full min-w-0 h-full min-h-screen`}>
                    {children}
                </div>
            </div>
        </WorkspaceLayout>
    )
}
