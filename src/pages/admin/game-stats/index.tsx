'use client';
import { ReactElement, useState } from 'react';
import {
    BarChart,
    LineChart,
    PieChart
} from '@mui/x-charts';
import { DataGridPro, GridColDef, GridToolbar } from '@mui/x-data-grid-pro';
import {
    ChartBarIcon,
    UsersIcon,
    PlayIcon,
    ServerIcon,
    ClockIcon,
    GlobeAltIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';
import PageHeading from '~/components/layouts/PageHeading';
import { AdminLayout } from '~/components/page_components/AdminLayout';
import { trpc } from '~/utils/trpc';
import NoSSR from '~/components/NoSSR';

// Time period selector component
const TimePeriodSelector = ({
    value,
    onChange
}: {
    value: '24h' | '7d' | '30d' | '90d';
    onChange: (period: '24h' | '7d' | '30d' | '90d') => void;
}) => {
    const periods = [
        { key: '24h', label: '24 Hours' },
        { key: '7d', label: '7 Days' },
        { key: '30d', label: '30 Days' },
        { key: '90d', label: '90 Days' }
    ] as const;

    return (
        <div className="flex space-x-2">
            {periods.map((period) => (
                <button
                    key={period.key}
                    onClick={() => onChange(period.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${value === period.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                >
                    {period.label}
                </button>
            ))}
        </div>
    );
};

// Loading spinner component
const LoadingSpinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    };

    return (
        <div className="flex items-center justify-center p-8">
            <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
        </div>
    );
};

// Chart section component with description
const ChartSection = ({
    title,
    description,
    children,
    isLoading = false
}: {
    title: string;
    description: string;
    children: React.ReactNode;
    isLoading?: boolean;
}) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {title}
            </h3>
            <div className="flex items-start space-x-2">
                <InformationCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {description}
                </p>
            </div>
        </div>
        {isLoading ? <LoadingSpinner /> : children}
    </div>
);

// Stat card component
const StatCard = ({
    title,
    value,
    icon: Icon,
    subtitle,
    trend
}: {
    title: string;
    value: string | number;
    icon: any;
    subtitle?: string;
    trend?: { value: number; isPositive: boolean };
}) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center">
            <div className="flex-shrink-0">
                <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4 flex-1">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                {subtitle && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
                )}
                {trend && (
                    <div className={`text-sm ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
                    </div>
                )}
            </div>
        </div>
    </div>
);

export default function GameStatsPage() {
    const [timePeriod, setTimePeriod] = useState<'24h' | '7d' | '30d' | '90d'>('7d');    // TRPC queries with staleTime to prevent unnecessary reloads
    const { data: overview, isLoading: overviewLoading } = trpc.admin.reports.gameStatistics.getOverview.useQuery(undefined, {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes
    }); const { data: activity, isLoading: activityLoading } = trpc.admin.reports.gameStatistics.getActivityByPeriod.useQuery({ period: timePeriod }, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: topWorkspacesData, isLoading: workspacesLoading } = trpc.admin.reports.gameStatistics.getTopWorkspacesWithOutliers.useQuery({ limit: 10 }, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: gameDistribution, isLoading: gameDistLoading } = trpc.admin.reports.gameStatistics.getGameDistribution.useQuery(undefined, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: playerDistribution, isLoading: playerDistLoading } = trpc.admin.reports.gameStatistics.getPlayerDistribution.useQuery(undefined, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: platformDistribution, isLoading: platformDistLoading } = trpc.admin.reports.gameStatistics.getPlatformDistribution.useQuery(undefined, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });

    const { data: recentActivity, isLoading: recentActivityLoading } = trpc.admin.reports.gameStatistics.getRecentActivity.useQuery(
        { limit: 50 },
        {
            staleTime: 2 * 60 * 1000, // 2 minutes for more recent data
            gcTime: 5 * 60 * 1000
        }
    );
    const { data: topGames, isLoading: topGamesLoading } = trpc.admin.reports.gameStatistics.getTopGamesThisWeek.useQuery(undefined, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: workspaceCreationTrends, isLoading: workspaceCreationLoading } = trpc.admin.reports.gameStatistics.getWorkspaceCreationTrends.useQuery({ period: '90d' }, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: gameSessionTrends, isLoading: gameSessionLoading } = trpc.admin.reports.gameStatistics.getGameSessionTrends.useQuery({ period: '30d' }, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: dailyUserStats, isLoading: dailyUsersLoading } = trpc.admin.reports.gameStatistics.getDailyUserStats.useQuery({ period: timePeriod }, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const { data: workspaceActivityStats, isLoading: workspaceActivityLoading } = trpc.admin.reports.gameStatistics.getWorkspaceActivityStats.useQuery(undefined, {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    }); if (!overview) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500 dark:text-gray-400">Loading game statistics...</div>
            </div>
        );
    }

    // Helper variables for business insights
    const latestSessionData = gameSessionTrends && gameSessionTrends.length > 0 ? gameSessionTrends[gameSessionTrends.length - 1] : null;
    const avgSessionLength = latestSessionData?.averageSessionLength || 0;    // DataGrid columns for recent activity
    const recentActivityColumns: GridColDef[] = [
        {
            field: 'gameName',
            headerName: 'Game',
            width: 200,
            renderCell: (params) => {
                const placeId = params.row.placeId;
                const gameName = params.value;

                if (placeId) {
                    return (
                        <a
                            href={`https://www.roblox.com/games/${placeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                        >
                            {gameName}
                        </a>
                    );
                }

                return (
                    <div className="font-medium text-gray-900 dark:text-white">
                        {gameName}
                    </div>
                );
            }
        },
        {
            field: 'workspaceName',
            headerName: 'Workspace',
            width: 180,
            renderCell: (params) => (
                <div className="text-gray-700 dark:text-gray-300">
                    {params.value}
                </div>
            )
        },
        {
            field: 'platform',
            headerName: 'Platform',
            width: 100,
            renderCell: (params) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {params.value || 'Unknown'}
                </span>
            )
        },
        {
            field: 'totalMinutes',
            headerName: 'Duration',
            width: 100,
            valueFormatter: (value) => `${Math.round(value || 0)}m`,
            renderCell: (params) => (
                <div className="text-gray-700 dark:text-gray-300">
                    {Math.round(params.value || 0)}m
                </div>
            )
        },
        {
            field: 'activityRatio',
            headerName: 'Activity %',
            width: 100,
            valueFormatter: (value) => `${Math.round(value || 0)}%`,
            renderCell: (params) => {
                const ratio = Math.round(params.value || 0);
                const color = ratio >= 80 ? 'text-green-600 dark:text-green-400' :
                    ratio >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400';
                return (
                    <div className={`font-medium ${color}`}>
                        {ratio}%
                    </div>
                );
            }
        },
        {
            field: 'staff',
            headerName: 'Staff',
            width: 80,
            renderCell: (params) => (
                params.value ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        Staff
                    </span>
                ) : null
            )
        },
        {
            field: 'created',
            headerName: 'Started',
            width: 150,
            valueFormatter: (value) => new Date(value).toLocaleString(),
            renderCell: (params) => (
                <div className="text-gray-700 dark:text-gray-300 text-sm">
                    {new Date(params.value).toLocaleString()}
                </div>
            )
        }
    ];    // DataGrid columns for top games this week
    const topGamesColumns: GridColDef[] = [
        {
            field: 'gameName',
            headerName: 'Game',
            width: 200,
            renderCell: (params) => {
                const placeId = params.row.placeId;
                const gameName = params.value;

                if (placeId) {
                    return (
                        <a
                            href={`https://www.roblox.com/games/${placeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                        >
                            {gameName}
                        </a>
                    );
                }

                return (
                    <div className="font-medium text-gray-900 dark:text-white">
                        {gameName}
                    </div>
                );
            }
        },
        {
            field: 'workspaceName',
            headerName: 'Workspace',
            width: 150,
            renderCell: (params) => (
                <div className="text-gray-700 dark:text-gray-300">
                    {params.value}
                </div>
            )
        },
        {
            field: 'sessionCount',
            headerName: 'Sessions',
            width: 100,
            renderCell: (params) => (
                <div className="font-medium text-gray-900 dark:text-white">
                    {params.value.toLocaleString()}
                </div>
            )
        },
        {
            field: 'totalMinutes',
            headerName: 'Total Time',
            width: 120,
            valueFormatter: (value) => {
                const hours = Math.floor(value / 60);
                const minutes = value % 60;
                return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            },
            renderCell: (params) => {
                const hours = Math.floor(params.value / 60);
                const minutes = params.value % 60;
                const display = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                return (
                    <div className="text-gray-700 dark:text-gray-300">
                        {display}
                    </div>
                );
            }
        },
        {
            field: 'uniquePlayerCount',
            headerName: 'Players',
            width: 100,
            renderCell: (params) => (
                <div className="font-medium text-blue-600 dark:text-blue-400">
                    {params.value.toLocaleString()}
                </div>
            )
        },
        {
            field: 'averageSession',
            headerName: 'Avg Session',
            width: 120,
            valueFormatter: (value) => `${Math.round(value)}m`,
            renderCell: (params) => (
                <div className="text-gray-700 dark:text-gray-300">
                    {Math.round(params.value)}m
                </div>
            )
        }
    ];

    return (
        <>
            <PageHeading title="Game Statistics Dashboard" />

            <NoSSR>
                <div className="space-y-8">                    {/* Overview Stats */}
                    {overviewLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                    <LoadingSpinner size="sm" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <StatCard
                                title="Total Games"
                                value={overview?.totalGames || 0}
                                icon={PlayIcon}
                                subtitle="All time"
                            />
                            <StatCard
                                title="Running Games"
                                value={overview?.totalRunningGames || 0}
                                icon={ServerIcon}
                                subtitle="Active now"
                            />
                            <StatCard
                                title="Total Players"
                                value={overview?.totalPlayers || 0}
                                icon={UsersIcon}
                                subtitle="Currently playing"
                            />
                            <StatCard
                                title="Staff Players"
                                value={`${overview?.staffPercentage || 0}%`}
                                icon={ChartBarIcon}
                                subtitle={`${overview?.staffPlayersCount || 0} of ${overview?.totalPlayers || 0} players`}
                            />
                            <StatCard
                                title="Active Workspaces"
                                value={overview?.totalWorkspacesWithGames || 0}
                                icon={GlobeAltIcon}
                                subtitle="With games"
                            />
                        </div>
                    )}                    <ChartSection
                        title="Activity Over Time"
                        description="Shows daily game sessions and total playtime minutes. Track user engagement patterns and peak activity periods."
                        isLoading={activityLoading}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                            <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
                        </div>
                        {/* Activity Chart */}
                        {activity && activity.gamesSessions && activity.gamesSessions.length > 0 && (
                            <div className="w-full" style={{ height: 400 }}>
                                <LineChart
                                    xAxis={[{
                                        scaleType: 'point',
                                        data: activity.gamesSessions.map(item => item.date),
                                    }]}
                                    series={[
                                        {
                                            data: activity.gamesSessions.map(item => item.count),
                                            label: 'Game Sessions',
                                            color: '#3B82F6',
                                        },
                                        {
                                            data: activity.gamesSessions.map(item => item.totalMinutes),
                                            label: 'Total Minutes',
                                            color: '#10B981',
                                        },
                                    ]}
                                    height={350}
                                />
                            </div>
                        )}
                    </ChartSection>

                    {/* Daily User Metrics - New Section */}
                    <ChartSection
                        title="Daily User Engagement Metrics"
                        description="Daily unique user counts, session statistics, and engagement quality metrics over the selected time period. Shows growth patterns and user retention trends."
                        isLoading={dailyUsersLoading}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                            <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
                        </div>
                        {/* Daily User Stats Chart */}
                        {dailyUserStats && dailyUserStats.length > 0 && (
                            <div className="w-full" style={{ height: 400 }}>
                                <LineChart
                                    xAxis={[{
                                        scaleType: 'point',
                                        data: dailyUserStats.map(item => item.date),
                                    }]}
                                    series={[
                                        {
                                            data: dailyUserStats.map(item => item.uniqueUserCount),
                                            label: 'Unique Users',
                                            color: '#8B5CF6',
                                        },
                                        {
                                            data: dailyUserStats.map(item => item.totalSessions),
                                            label: 'Total Sessions',
                                            color: '#3B82F6',
                                        },
                                        {
                                            data: dailyUserStats.map(item => item.averageSessionLength),
                                            label: 'Avg Session Length (min)',
                                            color: '#F59E0B',
                                        },
                                    ]}
                                    height={350}
                                />
                            </div>
                        )}
                    </ChartSection>

                    {/* Workspace Activity Analysis - New Section */}
                    <ChartSection
                        title="Workspace Activity Distribution"
                        description="Comprehensive workspace activity analysis showing sessions, engagement ratios, and user counts per workspace. Identify top-performing and underutilized workspaces."
                        isLoading={workspaceActivityLoading}
                    >
                        {workspaceActivityStats && workspaceActivityStats.workspaces && workspaceActivityStats.workspaces.length > 0 && (
                            <>
                                {/* Summary Statistics */}
                                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Workspaces</div>
                                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                            {workspaceActivityStats.summary.totalWorkspaces}
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                        <div className="text-sm font-medium text-green-800 dark:text-green-200">Total Sessions</div>
                                        <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                                            {workspaceActivityStats.summary.totalActiveSessions.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                                        <div className="text-sm font-medium text-purple-800 dark:text-purple-200">Total Hours</div>
                                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                            {workspaceActivityStats.summary.totalActiveHours.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                                        <div className="text-sm font-medium text-orange-800 dark:text-orange-200">Unique Players</div>
                                        <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                                            {workspaceActivityStats.summary.totalUniquePlayers.toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Workspace Activity Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Top Workspaces by Sessions */}
                                    <div className="w-full" style={{ height: 400 }}>
                                        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Top 10 Workspaces by Sessions</h4>
                                        <BarChart
                                            xAxis={[{
                                                scaleType: 'band',
                                                data: workspaceActivityStats.workspaces.slice(0, 10).map(ws =>
                                                    ws.workspace?.groupName || `Workspace ${ws.groupId}`
                                                ),
                                            }]}
                                            series={[{
                                                data: workspaceActivityStats.workspaces.slice(0, 10).map(ws => ws.totalSessions),
                                                label: 'Sessions',
                                                color: '#3B82F6',
                                            }]}
                                            height={330}
                                        />
                                    </div>

                                    {/* Top Workspaces by Activity Ratio */}
                                    <div className="w-full" style={{ height: 400 }}>
                                        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Top 10 Workspaces by Activity Ratio</h4>
                                        <BarChart
                                            xAxis={[{
                                                scaleType: 'band',
                                                data: workspaceActivityStats.workspaces
                                                    .sort((a, b) => b.activityRatio - a.activityRatio)
                                                    .slice(0, 10)
                                                    .map(ws => ws.workspace?.groupName || `Workspace ${ws.groupId}`),
                                            }]}
                                            series={[{
                                                data: workspaceActivityStats.workspaces
                                                    .sort((a, b) => b.activityRatio - a.activityRatio)
                                                    .slice(0, 10)
                                                    .map(ws => ws.activityRatio),
                                                label: 'Activity %',
                                                color: '#10B981',
                                            }]}
                                            height={330}
                                        />
                                    </div>
                                </div>

                                {/* Workspace Activity Data Grid */}
                                <div className="mt-6">
                                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Detailed Workspace Activity</h4>
                                    <div style={{ height: 400, width: '100%' }}>
                                        <DataGridPro
                                            rows={workspaceActivityStats.workspaces.map((ws, index) => ({
                                                id: index,
                                                ...ws,
                                                workspaceName: ws.workspace?.groupName || `Workspace ${ws.groupId}`
                                            }))}
                                            columns={[
                                                {
                                                    field: 'workspaceName',
                                                    headerName: 'Workspace',
                                                    width: 200,
                                                    renderCell: (params) => (
                                                        <div className="font-medium text-gray-900 dark:text-white">
                                                            {params.value}
                                                        </div>
                                                    )
                                                },
                                                {
                                                    field: 'totalSessions',
                                                    headerName: 'Sessions',
                                                    width: 120,
                                                    renderCell: (params) => (
                                                        <div className="font-medium text-gray-900 dark:text-white">
                                                            {params.value.toLocaleString()}
                                                        </div>
                                                    )
                                                },
                                                {
                                                    field: 'totalHours',
                                                    headerName: 'Total Hours',
                                                    width: 120,
                                                    renderCell: (params) => (
                                                        <div className="font-medium text-gray-900 dark:text-white">
                                                            {params.value.toLocaleString()}h
                                                        </div>
                                                    )
                                                },
                                                {
                                                    field: 'uniquePlayerCount',
                                                    headerName: 'Unique Players',
                                                    width: 140,
                                                    renderCell: (params) => (
                                                        <div className="font-medium text-gray-900 dark:text-white">
                                                            {params.value.toLocaleString()}
                                                        </div>
                                                    )
                                                },
                                                {
                                                    field: 'activityRatio',
                                                    headerName: 'Activity %',
                                                    width: 110,
                                                    renderCell: (params) => {
                                                        const ratio = params.value;
                                                        const color = ratio >= 80 ? 'text-green-600 dark:text-green-400' :
                                                            ratio >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                                                'text-red-600 dark:text-red-400';
                                                        return (
                                                            <div className={`font-medium ${color}`}>
                                                                {ratio}%
                                                            </div>
                                                        );
                                                    }
                                                },
                                                {
                                                    field: 'averageSessionLength',
                                                    headerName: 'Avg Session (min)',
                                                    width: 150,
                                                    renderCell: (params) => (
                                                        <div className="text-gray-700 dark:text-gray-300">
                                                            {params.value}m
                                                        </div>
                                                    )
                                                }
                                            ]}
                                            slots={{ toolbar: GridToolbar }}
                                            slotProps={{
                                                toolbar: {
                                                    showQuickFilter: true,
                                                    quickFilterProps: { debounceMs: 500 },
                                                },
                                            }}
                                            sx={{
                                                '& .MuiDataGrid-root': {
                                                    backgroundColor: 'transparent',
                                                },
                                                '& .MuiDataGrid-cell': {
                                                    borderColor: 'rgb(229 231 235)',
                                                },
                                                '& .MuiDataGrid-columnHeaders': {
                                                    backgroundColor: 'rgb(249 250 251)',
                                                    borderColor: 'rgb(229 231 235)',
                                                },
                                                '& .MuiDataGrid-footerContainer': {
                                                    borderColor: 'rgb(229 231 235)',
                                                },
                                                // Dark mode styles
                                                '.dark &': {
                                                    '& .MuiDataGrid-cell': {
                                                        borderColor: 'rgb(55 65 81)',
                                                        color: 'rgb(229 231 235)',
                                                    },
                                                    '& .MuiDataGrid-columnHeaders': {
                                                        backgroundColor: 'rgb(55 65 81)',
                                                        borderColor: 'rgb(55 65 81)',
                                                        color: 'rgb(229 231 235)',
                                                    },
                                                    '& .MuiDataGrid-footerContainer': {
                                                        borderColor: 'rgb(55 65 81)',
                                                        color: 'rgb(229 231 235)',
                                                    },
                                                    '& .MuiDataGrid-toolbarContainer': {
                                                        color: 'rgb(229 231 235)',
                                                    }
                                                }
                                            }}
                                            initialState={{
                                                pagination: {
                                                    paginationModel: { page: 0, pageSize: 15 },
                                                },
                                            }}
                                            pageSizeOptions={[10, 15, 25]}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </ChartSection>

                    {/* Business Intelligence Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Workspace Creation Trends */}
                        <ChartSection
                            title="Workspace Creation Trends (90 Days)"
                            description="Daily workspace registrations showing business growth. Track onboarding patterns and identify successful acquisition periods."
                            isLoading={workspaceCreationLoading}
                        >
                            {workspaceCreationTrends && workspaceCreationTrends.length > 0 && (
                                <div className="w-full" style={{ height: 350 }}>
                                    <LineChart
                                        xAxis={[{
                                            scaleType: 'point',
                                            data: workspaceCreationTrends.map(item => item.date),
                                        }]}
                                        series={[{
                                            data: workspaceCreationTrends.map(item => item.count),
                                            label: 'New Workspaces',
                                            color: '#8B5CF6',
                                        }]}
                                        height={300}
                                    />
                                </div>
                            )}
                        </ChartSection>

                        {/* Game Session Trends */}
                        <ChartSection
                            title="Game Session Trends (Weekly)"
                            description="Weekly aggregated game sessions showing user engagement patterns. Tracks total sessions, unique users, and average session length."
                            isLoading={gameSessionLoading}
                        >
                            {gameSessionTrends && gameSessionTrends.length > 0 && (
                                <div className="w-full" style={{ height: 350 }}>
                                    <LineChart
                                        xAxis={[{
                                            scaleType: 'point',
                                            data: gameSessionTrends.map(item => item.weekLabel),
                                        }]}
                                        series={[
                                            {
                                                data: gameSessionTrends.map(item => item.sessionCount),
                                                label: 'Sessions',
                                                color: '#3B82F6',
                                            },
                                            {
                                                data: gameSessionTrends.map(item => item.uniqueUserCount),
                                                label: 'Unique Users',
                                                color: '#10B981',
                                            }
                                        ]}
                                        height={300}
                                    />
                                </div>
                            )}
                        </ChartSection>
                    </div>

                    {/* Outlier Analysis */}
                    {topWorkspacesData?.outliers && topWorkspacesData.outliers.length > 0 && (
                        <ChartSection
                            title="Outlier Workspaces Analysis"
                            description={`Workspaces with exceptionally high activity (>10x median of ${topWorkspacesData.median}m). These may represent major clients or require investigation for unusual patterns.`}
                        >
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                                <div className="flex items-center space-x-2">
                                    <InformationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                        <strong>Found {topWorkspacesData.outliers.length} outlier workspace(s)</strong> with activity levels significantly above normal.
                                        These represent {Math.round(topWorkspacesData.outliers.reduce((sum, w) => sum + w.totalHours, 0))} total hours of gameplay.
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {topWorkspacesData.outliers.map((workspace, index) => (
                                    <div key={workspace.groupId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {workspace.workspace?.groupName || `Workspace ${workspace.groupId}`}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {workspace.totalSessions.toLocaleString()} sessions • {workspace.uniquePlayerCount} unique players
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                                                {workspace.totalHours.toLocaleString()}h
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {Math.round(workspace.totalMinutes / topWorkspacesData.median)}x median
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ChartSection>
                    )}                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Workspaces - Normal Distribution */}
                        <ChartSection
                            title="Top Workspaces by Activity (Normal Range)"
                            description="Workspaces ranked by total gameplay time, excluding extreme outliers. Shows typical workspace engagement patterns for business analysis."
                            isLoading={workspacesLoading}
                        >
                            {topWorkspacesData?.normalWorkspaces && topWorkspacesData.normalWorkspaces.length > 0 && (
                                <div className="w-full" style={{ height: 350 }}>
                                    <BarChart xAxis={[{
                                        scaleType: 'band',
                                        data: topWorkspacesData.normalWorkspaces.map(ws => ws.workspace?.groupName || `Workspace ${ws.groupId}`),
                                    }]}
                                        series={[{
                                            data: topWorkspacesData.normalWorkspaces.map(ws => ws.totalSessions),
                                            label: 'Sessions',
                                            color: '#8B5CF6',
                                        }]}
                                        height={300}
                                    />
                                </div>
                            )}
                        </ChartSection>

                        {/* Player Distribution */}
                        <ChartSection
                            title="Server Size Distribution"
                            description="Distribution of game servers by player count. Helps understand typical game session sizes and server capacity usage."
                            isLoading={playerDistLoading}
                        >
                            {playerDistribution && playerDistribution.length > 0 && (
                                <div className="w-full" style={{ height: 350 }}>
                                    <PieChart
                                        series={[{
                                            data: playerDistribution.map(dist => ({
                                                id: dist.playerRange,
                                                value: dist.serverCount,
                                                label: dist.playerRange,
                                            })),
                                        }]}
                                        height={300}
                                    />
                                </div>
                            )}
                        </ChartSection>

                        {/* Game Distribution */}
                        <ChartSection
                            title="Games per Workspace"
                            description="Shows how many games each workspace manages. Indicates the scale and complexity of different organizations' gaming portfolios."
                            isLoading={gameDistLoading}
                        >
                            {gameDistribution && gameDistribution.length > 0 && (
                                <div className="w-full" style={{ height: 350 }}>
                                    <BarChart
                                        xAxis={[{
                                            scaleType: 'band',
                                            data: gameDistribution.map(dist => `${dist.gamesPerWorkspace} game${dist.gamesPerWorkspace !== 1 ? 's' : ''}`),
                                        }]}
                                        series={[{
                                            data: gameDistribution.map(dist => dist.workspaceCount),
                                            label: 'Workspaces',
                                            color: '#F59E0B',
                                        }]}
                                        height={300}
                                    />
                                </div>
                            )}
                        </ChartSection>

                        {/* Platform Distribution */}
                        <ChartSection
                            title="Platform Usage"
                            description="Breakdown of players by gaming platform (PC, Mobile, Console, VR). Shows the device preferences of your user base."
                            isLoading={platformDistLoading}
                        >
                            {platformDistribution && platformDistribution.length > 0 && (
                                <div className="w-full" style={{ height: 350 }}>
                                    <PieChart
                                        series={[{
                                            data: platformDistribution.map(platform => ({
                                                id: platform.platform || 'Unknown',
                                                value: platform.count,
                                                label: platform.platform || 'Unknown',
                                            })),
                                        }]}
                                        height={300}
                                    />
                                </div>
                            )}
                        </ChartSection>
                    </div>                    {/* Top Games This Week */}
                    <ChartSection
                        title="Top Games This Week"
                        description="Most popular games ranked by total playtime in the last 7 days. Shows engagement levels and player retention metrics."
                        isLoading={topGamesLoading}
                    >
                        <div style={{ height: 400, width: '100%' }}>
                            <DataGridPro
                                rows={topGames?.map((game, index) => ({ id: index, ...game })) || []}
                                columns={topGamesColumns}
                                slots={{ toolbar: GridToolbar }}
                                slotProps={{
                                    toolbar: {
                                        showQuickFilter: true,
                                        quickFilterProps: { debounceMs: 500 },
                                    },
                                }}
                                sx={{
                                    '& .MuiDataGrid-root': {
                                        backgroundColor: 'transparent',
                                    },
                                    '& .MuiDataGrid-cell': {
                                        borderColor: 'rgb(229 231 235)',
                                    },
                                    '& .MuiDataGrid-columnHeaders': {
                                        backgroundColor: 'rgb(249 250 251)',
                                        borderColor: 'rgb(229 231 235)',
                                    },
                                    '& .MuiDataGrid-footerContainer': {
                                        borderColor: 'rgb(229 231 235)',
                                    },
                                    // Dark mode styles
                                    '.dark &': {
                                        '& .MuiDataGrid-cell': {
                                            borderColor: 'rgb(55 65 81)',
                                            color: 'rgb(229 231 235)',
                                        },
                                        '& .MuiDataGrid-columnHeaders': {
                                            backgroundColor: 'rgb(55 65 81)',
                                            borderColor: 'rgb(55 65 81)',
                                            color: 'rgb(229 231 235)',
                                        },
                                        '& .MuiDataGrid-footerContainer': {
                                            borderColor: 'rgb(55 65 81)',
                                            color: 'rgb(229 231 235)',
                                        },
                                        '& .MuiDataGrid-toolbarContainer': {
                                            color: 'rgb(229 231 235)',
                                        }
                                    }
                                }}
                                initialState={{
                                    pagination: {
                                        paginationModel: { page: 0, pageSize: 10 },
                                    },
                                }}
                                pageSizeOptions={[5, 10]}
                            />
                        </div>
                    </ChartSection>                    {/* Recent Activity */}
                    <ChartSection
                        title="Recent Game Sessions (Last 24 Hours)"
                        description="Live feed of recent gameplay sessions showing duration, platform, and activity levels. Activity % shows how engaged players were during their session."
                        isLoading={recentActivityLoading}
                    >                        <div style={{ height: 500, width: '100%' }}>
                            <DataGridPro
                                rows={recentActivity?.map((session: any, index: number) => ({ id: index, ...session })) || []}
                                columns={recentActivityColumns}
                                slots={{ toolbar: GridToolbar }}
                                slotProps={{
                                    toolbar: {
                                        showQuickFilter: true,
                                        quickFilterProps: { debounceMs: 500 },
                                    },
                                }}
                                sx={{
                                    '& .MuiDataGrid-root': {
                                        backgroundColor: 'transparent',
                                    },
                                    '& .MuiDataGrid-cell': {
                                        borderColor: 'rgb(229 231 235)',
                                    },
                                    '& .MuiDataGrid-columnHeaders': {
                                        backgroundColor: 'rgb(249 250 251)',
                                        borderColor: 'rgb(229 231 235)',
                                    },
                                    '& .MuiDataGrid-footerContainer': {
                                        borderColor: 'rgb(229 231 235)',
                                    },
                                    // Dark mode styles
                                    '.dark &': {
                                        '& .MuiDataGrid-cell': {
                                            borderColor: 'rgb(55 65 81)',
                                            color: 'rgb(229 231 235)',
                                        },
                                        '& .MuiDataGrid-columnHeaders': {
                                            backgroundColor: 'rgb(55 65 81)',
                                            borderColor: 'rgb(55 65 81)',
                                            color: 'rgb(229 231 235)',
                                        },
                                        '& .MuiDataGrid-footerContainer': {
                                            borderColor: 'rgb(55 65 81)',
                                            color: 'rgb(229 231 235)',
                                        },
                                        '& .MuiDataGrid-toolbarContainer': {
                                            color: 'rgb(229 231 235)',
                                        }
                                    }
                                }}
                                initialState={{
                                    pagination: {
                                        paginationModel: { page: 0, pageSize: 25 },
                                    },
                                }}
                                pageSizeOptions={[10, 25, 50]}
                            />
                        </div>
                    </ChartSection>                    {/* Business Insights Summary */}
                    <ChartSection
                        title="Business Intelligence Summary"
                        description="Key metrics and insights for data-driven business decisions on pricing, growth, and customer engagement."
                        isLoading={overviewLoading || workspaceCreationLoading || gameSessionLoading}
                    >                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            {/* Average Revenue Potential */}
                            <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="text-sm font-medium text-green-800 dark:text-green-200">Staff Monitoring</div>
                                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                                    {overview?.staffPercentage || 0}%
                                </div>
                                <div className="text-sm text-green-700 dark:text-green-300">
                                    of active players are staff/tracked
                                </div>
                            </div>

                            {/* Session Quality */}
                            <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Avg Session Quality</div>
                                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                    {Math.round(avgSessionLength)}m
                                </div>
                                <div className="text-sm text-blue-700 dark:text-blue-300">
                                    average session length
                                </div>
                            </div>

                            {/* Growth Rate */}
                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div className="text-sm font-medium text-purple-800 dark:text-purple-200">Workspace Growth</div>
                                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                    {workspaceCreationTrends && workspaceCreationTrends.length > 0
                                        ? workspaceCreationTrends.reduce((sum, day) => sum + day.count, 0)
                                        : '0'}
                                </div>
                                <div className="text-sm text-purple-700 dark:text-purple-300">
                                    new workspaces (90d)
                                </div>
                            </div>

                            {/* Outlier Impact */}
                            <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                                <div className="text-sm font-medium text-orange-800 dark:text-orange-200">High-Value Accounts</div>
                                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                                    {topWorkspacesData?.outliers?.length || 0}
                                </div>
                                <div className="text-sm text-orange-700 dark:text-orange-300">
                                    enterprise-level workspaces
                                </div>
                            </div>

                            {/* Daily Active Users */}
                            <div className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 p-4 rounded-lg border border-teal-200 dark:border-teal-800">
                                <div className="text-sm font-medium text-teal-800 dark:text-teal-200">Daily Active Users</div>
                                <div className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                                    {dailyUserStats && dailyUserStats.length > 0
                                        ? Math.round(dailyUserStats.reduce((sum, day) => sum + day.uniqueUserCount, 0) / dailyUserStats.length)
                                        : '0'}
                                </div>
                                <div className="text-sm text-teal-700 dark:text-teal-300">
                                    average unique users/day
                                </div>
                            </div>
                        </div>                        {/* Business Recommendations */}
                        <div className="mt-6 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4">📊 Business Insights & Recommendations</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <strong className="text-indigo-800 dark:text-indigo-200">🎯 Pricing Strategy:</strong>
                                    <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                                        {topWorkspacesData?.outliers && topWorkspacesData.outliers.length > 0
                                            ? `Consider enterprise pricing for ${topWorkspacesData.outliers.length} high-usage workspaces generating ${Math.round(topWorkspacesData.outliers.reduce((sum, w) => sum + w.totalHours, 0)).toLocaleString()}+ hours`
                                            : 'Monitor for high-usage patterns to identify enterprise pricing opportunities'}
                                    </p>
                                </div>
                                <div>
                                    <strong className="text-indigo-800 dark:text-indigo-200">📈 Growth Focus:</strong>
                                    <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                                        {workspaceCreationTrends && workspaceCreationTrends.length > 0
                                            ? `${workspaceCreationTrends.reduce((sum, day) => sum + day.count, 0)} new workspaces in 90 days. Focus on onboarding and retention.`
                                            : 'Focus on workspace acquisition and onboarding optimization'}
                                    </p>
                                </div>
                                <div>
                                    <strong className="text-indigo-800 dark:text-indigo-200">👥 Staff Utilization:</strong>
                                    <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                                        {overview?.staffPercentage || 0}% staff usage indicates {(overview?.staffPercentage || 0) > 20 ? 'high' : (overview?.staffPercentage || 0) > 10 ? 'moderate' : 'low'} internal adoption.
                                        {(overview?.staffPercentage || 0) < 15 ? ' Consider staff training programs.' : ' Good internal usage validation.'}
                                    </p>
                                </div>
                                <div>
                                    <strong className="text-indigo-800 dark:text-indigo-200">⏱️ Engagement Quality:</strong>
                                    <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                                        {latestSessionData
                                            ? `${Math.round(avgSessionLength)}min avg sessions indicate ${avgSessionLength > 30 ? 'high' :
                                                avgSessionLength > 15 ? 'moderate' : 'low'
                                            } engagement quality.`
                                            : 'Monitor session length trends for engagement insights'}
                                    </p>
                                </div>
                                <div>
                                    <strong className="text-indigo-800 dark:text-indigo-200">🏢 Workspace Performance:</strong>
                                    <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                                        {workspaceActivityStats?.summary
                                            ? `${workspaceActivityStats.summary.totalWorkspaces} active workspaces averaging ${workspaceActivityStats.summary.averageSessionsPerWorkspace} sessions each. Top performers show potential for case studies.`
                                            : 'Analyze workspace activity patterns to identify success factors'}
                                    </p>
                                </div>
                                <div>
                                    <strong className="text-indigo-800 dark:text-indigo-200">📊 User Retention:</strong>
                                    <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                                        {dailyUserStats && dailyUserStats.length > 0
                                            ? `Average ${Math.round(dailyUserStats.reduce((sum, day) => sum + day.uniqueUserCount, 0) / dailyUserStats.length)} daily active users. ${dailyUserStats[dailyUserStats.length - 1]?.uniqueUserCount > dailyUserStats[0]?.uniqueUserCount
                                                ? 'Growing user engagement trend.'
                                                : 'Focus on user retention strategies.'
                                            }`
                                            : 'Monitor daily active user trends for retention insights'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ChartSection>
                </div>
            </NoSSR>
        </>
    );
}

GameStatsPage.getLayout = (page: ReactElement) => (
    <AdminLayout>{page}</AdminLayout>
);