import { z } from 'zod';
import { founderProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';

export const adminReportsRouter = router({
    gameStatistics: router({
        getOverview: founderProcedure.query(async () => {
            const [
                totalGames,
                totalRunningGames,
                totalPlayers,
                totalGameSessions,
                totalWorkspacesWithGames,
                staffPlayersCount
            ] = await Promise.all([
                readminCollections.game.countDocuments(),
                readminCollections.running_games.countDocuments(),
                readminCollections.running_game_players.countDocuments(),
                readminCollections.user_game_session.countDocuments(),
                readminCollections.game.distinct('groupId').then(groups => groups.length),
                readminCollections.running_game_players.countDocuments({ isStaff: true })
            ]);

            const staffPercentage = totalPlayers > 0 ? Math.round((staffPlayersCount / totalPlayers) * 100) : 0;

            return {
                totalGames,
                totalRunningGames,
                totalPlayers,
                totalGameSessions,
                totalWorkspacesWithGames,
                staffPlayersCount,
                staffPercentage
            };
        }),

        getActivityByPeriod: founderProcedure
            .input(z.object({
                period: z.enum(['24h', '7d', '30d', '90d']).default('7d')
            }))
            .query(async ({ input }) => {
                const { period } = input;

                const now = new Date();
                const startDate = new Date();

                switch (period) {
                    case '24h':
                        startDate.setHours(now.getHours() - 24);
                        break;
                    case '7d':
                        startDate.setDate(now.getDate() - 7);
                        break;
                    case '30d':
                        startDate.setDate(now.getDate() - 30);
                        break;
                    case '90d':
                        startDate.setDate(now.getDate() - 90);
                        break;
                }

                const [gamesSessions, runningGamesCreated, playersJoined] = await Promise.all([
                    readminCollections.user_game_session.aggregate([
                        {
                            $match: {
                                created: { $gte: startDate }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$created' },
                                    month: { $month: '$created' },
                                    day: { $dayOfMonth: '$created' }
                                },
                                count: { $sum: 1 },
                                totalMinutes: { $sum: '$minutes.total' },
                                activeMinutes: { $sum: '$minutes.active' }
                            }
                        },
                        {
                            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                        }
                    ]).toArray(),

                    readminCollections.running_games.aggregate([
                        {
                            $match: {
                                created: { $gte: startDate }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$created' },
                                    month: { $month: '$created' },
                                    day: { $dayOfMonth: '$created' }
                                },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                        }
                    ]).toArray(),

                    readminCollections.running_game_players.aggregate([
                        {
                            $match: {
                                joined: { $gte: startDate }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$joined' },
                                    month: { $month: '$joined' },
                                    day: { $dayOfMonth: '$joined' }
                                },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                        }
                    ]).toArray()
                ]);

                return {
                    gamesSessions: gamesSessions.map(item => ({
                        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                        count: item.count,
                        totalMinutes: item.totalMinutes || 0,
                        activeMinutes: item.activeMinutes || 0
                    })),
                    runningGamesCreated: runningGamesCreated.map(item => ({
                        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                        count: item.count
                    })),
                    playersJoined: playersJoined.map(item => ({
                        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                        count: item.count
                    }))
                };
            }),

        getTopWorkspacesByActivity: founderProcedure
            .input(z.object({
                limit: z.number().min(5).max(50).default(10)
            }))
            .query(async ({ input }) => {
                const { limit } = input;

                const topWorkspaces = await readminCollections.user_game_session.aggregate([
                    {
                        $group: {
                            _id: '$groupId',
                            totalSessions: { $sum: 1 },
                            totalMinutes: { $sum: '$minutes.total' },
                            activeMinutes: { $sum: '$minutes.active' },
                            uniquePlayers: { $addToSet: '$userId' }
                        }
                    },
                    {
                        $addFields: {
                            uniquePlayerCount: { $size: '$uniquePlayers' }
                        }
                    },
                    {
                        $project: {
                            uniquePlayers: 0
                        }
                    },
                    {
                        $sort: { totalMinutes: -1 }
                    },
                    {
                        $limit: limit
                    }
                ]).toArray();

                // Get workspace info for each top workspace
                const workspaceIds = topWorkspaces.map(w => w._id.toString());
                const workspaces = await readminCollections.workspace.find({
                    groupId: { $in: workspaceIds }
                }).toArray();

                const workspaceMap = new Map(workspaces.map(w => [w.groupId, w]));

                return topWorkspaces.map(stat => ({
                    groupId: stat._id.toString(),
                    workspace: workspaceMap.get(stat._id.toString()),
                    totalSessions: stat.totalSessions,
                    totalMinutes: stat.totalMinutes,
                    activeMinutes: stat.activeMinutes,
                    uniquePlayerCount: stat.uniquePlayerCount
                }));
            }),

        getGameDistribution: founderProcedure.query(async () => {
            const gameDistribution = await readminCollections.game.aggregate([
                {
                    $group: {
                        _id: '$groupId',
                        gameCount: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: '$gameCount',
                        workspaceCount: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id': 1 }
                }
            ]).toArray();

            return gameDistribution.map(item => ({
                gamesPerWorkspace: item._id,
                workspaceCount: item.workspaceCount
            }));
        }),

        getPlayerDistribution: founderProcedure.query(async () => {
            const currentPlayers = await readminCollections.running_game_players.aggregate([
                {
                    $group: {
                        _id: '$runningGameId',
                        playerCount: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: {
                            $switch: {
                                branches: [
                                    { case: { $lte: ['$playerCount', 5] }, then: '1-5' },
                                    { case: { $lte: ['$playerCount', 10] }, then: '6-10' },
                                    { case: { $lte: ['$playerCount', 20] }, then: '11-20' },
                                    { case: { $lte: ['$playerCount', 50] }, then: '21-50' }
                                ],
                                default: '50+'
                            }
                        },
                        serverCount: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id': 1 }
                }
            ]).toArray();

            return currentPlayers.map(item => ({
                playerRange: item._id,
                serverCount: item.serverCount
            }));
        }),

        getPlatformDistribution: founderProcedure.query(async () => {
            const platformStats = await readminCollections.running_game_players.aggregate([
                {
                    $group: {
                        _id: '$platform',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]).toArray();

            return platformStats.map(item => ({
                platform: item._id,
                count: item.count
            }));
        }), getRecentActivity: founderProcedure
            .input(z.object({
                limit: z.number().min(10).max(100).default(50)
            }))
            .query(async ({ input }) => {
                const { limit } = input;

                // Get recent game sessions with aggregated data for more meaningful insights
                const recentSessions = await readminCollections.user_game_session.aggregate([
                    {
                        $match: {
                            created: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
                        }
                    },
                    {
                        $lookup: {
                            from: 'game',
                            localField: 'gameId',
                            foreignField: 'gameId',
                            as: 'gameInfo'
                        }
                    },
                    {
                        $lookup: {
                            from: 'workspace',
                            localField: 'groupId',
                            foreignField: 'groupId',
                            as: 'workspaceInfo'
                        }
                    },
                    {
                        $addFields: {
                            gameName: { $arrayElemAt: ['$gameInfo.name', 0] },
                            workspaceName: { $arrayElemAt: ['$workspaceInfo?.groupName', 0] },
                            totalMinutes: { $ifNull: ['$minutes.total', 0] },
                            activeMinutes: { $ifNull: ['$minutes.active', 0] }
                        }
                    },
                    {
                        $sort: { created: -1 }
                    },
                    {
                        $limit: limit
                    },
                    {
                        $project: {
                            id: '$_id',
                            userId: 1,
                            groupId: 1,
                            gameId: 1,
                            placeId: 1,
                            platform: 1,
                            staff: { $ifNull: ['$staff', false] },
                            inGame: 1,
                            totalMinutes: 1,
                            activeMinutes: 1,
                            created: 1,
                            gameName: { $ifNull: ['$gameName', 'Unknown Game'] },
                            workspaceName: { $ifNull: ['$workspaceName', 'Unknown Workspace'] },
                            activityRatio: {
                                $cond: {
                                    if: { $gt: ['$totalMinutes', 0] },
                                    then: { $multiply: [{ $divide: ['$activeMinutes', '$totalMinutes'] }, 100] },
                                    else: 0
                                }
                            }
                        }
                    }
                ]).toArray();

                return recentSessions;
            }),

        getTopGamesThisWeek: founderProcedure.query(async () => {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const topGames = await readminCollections.user_game_session.aggregate([
                {
                    $match: {
                        created: { $gte: weekAgo }
                    }
                },
                {
                    $group: {
                        _id: '$gameId',
                        sessionCount: { $sum: 1 },
                        totalMinutes: { $sum: '$minutes.total' },
                        uniquePlayers: { $addToSet: '$userId' },
                        averageSession: { $avg: '$minutes.total' }
                    }
                },
                {
                    $addFields: {
                        uniquePlayerCount: { $size: '$uniquePlayers' }
                    }
                },
                {
                    $lookup: {
                        from: 'game',
                        localField: '_id',
                        foreignField: 'gameId',
                        as: 'gameInfo'
                    }
                }, {
                    $addFields: {
                        gameName: { $arrayElemAt: ['$gameInfo.name', 0] },
                        placeId: { $arrayElemAt: ['$gameInfo.placeId', 0] },
                        groupId: { $arrayElemAt: ['$gameInfo.groupId', 0] }
                    }
                },
                {
                    $lookup: {
                        from: 'workspace',
                        localField: 'groupId',
                        foreignField: 'groupId',
                        as: 'workspaceInfo'
                    }
                },
                {
                    $addFields: {
                        workspaceName: { $arrayElemAt: ['$workspaceInfo?.groupName', 0] }
                    }
                },
                {
                    $sort: { totalMinutes: -1 }
                },
                {
                    $limit: 10
                }, {
                    $project: {
                        gameId: '$_id',
                        placeId: 1,
                        gameName: { $ifNull: ['$gameName', 'Unknown Game'] },
                        workspaceName: { $ifNull: ['$workspaceName', 'Unknown Workspace'] },
                        sessionCount: 1,
                        totalMinutes: 1,
                        uniquePlayerCount: 1,
                        averageSession: { $round: ['$averageSession', 1] }
                    }
                }
            ]).toArray(); return topGames;
        }),

        // New endpoints for business insights
        getWorkspaceCreationTrends: founderProcedure
            .input(z.object({
                period: z.enum(['30d', '90d', '1y']).default('90d')
            }))
            .query(async ({ input }) => {
                const { period } = input;
                const now = new Date();
                const startDate = new Date();

                switch (period) {
                    case '30d':
                        startDate.setDate(now.getDate() - 30);
                        break;
                    case '90d':
                        startDate.setDate(now.getDate() - 90);
                        break;
                    case '1y':
                        startDate.setFullYear(now.getFullYear() - 1);
                        break;
                }

                const workspaceCreationTrends = await readminCollections.workspace.aggregate([
                    {
                        $match: {
                            created: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$created' },
                                month: { $month: '$created' },
                                day: { $dayOfMonth: '$created' }
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                    }
                ]).toArray();

                return workspaceCreationTrends.map(item => ({
                    date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                    count: item.count
                }));
            }),

        getGameSessionTrends: founderProcedure
            .input(z.object({
                period: z.enum(['7d', '30d', '90d']).default('30d')
            }))
            .query(async ({ input }) => {
                const { period } = input;
                const now = new Date();
                const startDate = new Date();

                switch (period) {
                    case '7d':
                        startDate.setDate(now.getDate() - 7);
                        break;
                    case '30d':
                        startDate.setDate(now.getDate() - 30);
                        break;
                    case '90d':
                        startDate.setDate(now.getDate() - 90);
                        break;
                }

                // Aggregate by week to reduce database load
                const gameSessionTrends = await readminCollections.user_game_session.aggregate([
                    {
                        $match: {
                            created: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$created' },
                                week: { $week: '$created' }
                            },
                            sessionCount: { $sum: 1 },
                            totalMinutes: { $sum: '$minutes.total' },
                            activeMinutes: { $sum: '$minutes.active' },
                            uniqueUsers: { $addToSet: '$userId' }
                        }
                    },
                    {
                        $addFields: {
                            uniqueUserCount: { $size: '$uniqueUsers' },
                            averageSessionLength: { $divide: ['$totalMinutes', '$sessionCount'] }
                        }
                    },
                    {
                        $sort: { '_id.year': 1, '_id.week': 1 }
                    }
                ]).toArray();

                return gameSessionTrends.map(item => ({
                    weekLabel: `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`,
                    sessionCount: item.sessionCount,
                    totalMinutes: item.totalMinutes || 0,
                    activeMinutes: item.activeMinutes || 0,
                    uniqueUserCount: item.uniqueUserCount,
                    averageSessionLength: Math.round(item.averageSessionLength || 0)
                }));
            }),

        getTopWorkspacesWithOutliers: founderProcedure
            .input(z.object({
                limit: z.number().default(10)
            }))
            .query(async ({ input }) => {
                const { limit } = input;

                const allWorkspaces = await readminCollections.user_game_session.aggregate([
                    {
                        $group: {
                            _id: '$groupId',
                            totalSessions: { $sum: 1 },
                            totalMinutes: { $sum: '$minutes.total' },
                            activeMinutes: { $sum: '$minutes.active' },
                            uniquePlayers: { $addToSet: '$userId' }
                        }
                    },
                    {
                        $addFields: {
                            uniquePlayerCount: { $size: '$uniquePlayers' }
                        }
                    },
                    {
                        $project: {
                            uniquePlayers: 0
                        }
                    },
                    {
                        $sort: { totalMinutes: -1 }
                    },
                    {
                        $limit: limit * 3 // Get more to analyze outliers
                    }
                ]).toArray();

                // Calculate outlier threshold (10x the median to identify extreme outliers)
                const totalMinutes = allWorkspaces.map(w => w.totalMinutes).sort((a, b) => a - b);
                const median = totalMinutes[Math.floor(totalMinutes.length / 2)] || 0;
                const outlierThreshold = median * 10;

                // Separate outliers and normal workspaces
                const outliers = allWorkspaces.filter(w => w.totalMinutes > outlierThreshold);
                const normalWorkspaces = allWorkspaces.filter(w => w.totalMinutes <= outlierThreshold).slice(0, limit);

                // Get workspace info
                const allWorkspaceIds = [...outliers, ...normalWorkspaces].map(w => w._id.toString());
                const workspaces = await readminCollections.workspace.find({
                    groupId: { $in: allWorkspaceIds }
                }).toArray();

                const workspaceMap = new Map(workspaces.map(w => [w.groupId, w]));

                const processData = (ws: any[]) => ws.map(stat => ({
                    groupId: stat._id.toString(),
                    workspace: workspaceMap.get(stat._id.toString()),
                    totalSessions: stat.totalSessions,
                    totalMinutes: stat.totalMinutes,
                    activeMinutes: stat.activeMinutes,
                    uniquePlayerCount: stat.uniquePlayerCount,
                    totalHours: Math.round(stat.totalMinutes / 60)
                })); return {
                    normalWorkspaces: processData(normalWorkspaces),
                    outliers: processData(outliers),
                    outlierThreshold,
                    median: Math.round(median),
                    stats: {
                        totalAnalyzed: allWorkspaces.length,
                        outlierCount: outliers.length,
                        normalCount: normalWorkspaces.length
                    }
                };
            }),

        getDailyUserStats: founderProcedure
            .input(z.object({
                period: z.enum(['24h', '7d', '30d', '90d']).default('7d')
            }))
            .query(async ({ input }) => {
                const { period } = input;
                const now = new Date();
                const startDate = new Date();

                switch (period) {
                    case '24h':
                        startDate.setHours(now.getHours() - 24);
                        break;
                    case '7d':
                        startDate.setDate(now.getDate() - 7);
                        break;
                    case '30d':
                        startDate.setDate(now.getDate() - 30);
                        break;
                    case '90d':
                        startDate.setDate(now.getDate() - 90);
                        break;
                }

                // Get daily unique user counts
                const dailyUserStats = await readminCollections.user_game_session.aggregate([
                    {
                        $match: {
                            created: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$created' },
                                month: { $month: '$created' },
                                day: { $dayOfMonth: '$created' }
                            },
                            uniqueUsers: { $addToSet: '$userId' },
                            totalSessions: { $sum: 1 },
                            totalMinutes: { $sum: '$minutes.total' },
                            activeMinutes: { $sum: '$minutes.active' }
                        }
                    },
                    {
                        $addFields: {
                            uniqueUserCount: { $size: '$uniqueUsers' },
                            averageSessionLength: {
                                $cond: {
                                    if: { $gt: ['$totalSessions', 0] },
                                    then: { $divide: ['$totalMinutes', '$totalSessions'] },
                                    else: 0
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            uniqueUsers: 0
                        }
                    },
                    {
                        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                    }
                ]).toArray();

                return dailyUserStats.map(item => ({
                    date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                    uniqueUserCount: item.uniqueUserCount,
                    totalSessions: item.totalSessions,
                    totalMinutes: item.totalMinutes || 0,
                    activeMinutes: item.activeMinutes || 0,
                    averageSessionLength: Math.round(item.averageSessionLength || 0)
                }));
            }),

        getWorkspaceActivityStats: founderProcedure.query(async () => {
            // Get workspace activity analysis
            const workspaceActivity = await readminCollections.user_game_session.aggregate([
                {
                    $group: {
                        _id: '$groupId',
                        totalSessions: { $sum: 1 },
                        totalMinutes: { $sum: '$minutes.total' },
                        activeMinutes: { $sum: '$minutes.active' },
                        uniquePlayers: { $addToSet: '$userId' },
                        averageSessionLength: { $avg: '$minutes.total' }
                    }
                },
                {
                    $addFields: {
                        uniquePlayerCount: { $size: '$uniquePlayers' },
                        activityRatio: {
                            $cond: {
                                if: { $gt: ['$totalMinutes', 0] },
                                then: { $multiply: [{ $divide: ['$activeMinutes', '$totalMinutes'] }, 100] },
                                else: 0
                            }
                        }
                    }
                },
                {
                    $project: {
                        uniquePlayers: 0
                    }
                }
            ]).toArray();

            // Get workspace info for each workspace
            const workspaceIds = workspaceActivity.map(w => w._id.toString());
            const workspaces = await readminCollections.workspace.find({
                groupId: { $in: workspaceIds }
            }).toArray();

            const workspaceMap = new Map(workspaces.map(w => [w.groupId, w]));

            // Process and return workspace activity data
            const processedData = workspaceActivity.map(stat => ({
                groupId: stat._id.toString(),
                workspace: workspaceMap.get(stat._id.toString()),
                totalSessions: stat.totalSessions,
                totalMinutes: stat.totalMinutes || 0,
                activeMinutes: stat.activeMinutes || 0,
                uniquePlayerCount: stat.uniquePlayerCount,
                averageSessionLength: Math.round(stat.averageSessionLength || 0),
                activityRatio: Math.round(stat.activityRatio || 0),
                totalHours: Math.round((stat.totalMinutes || 0) / 60)
            }));

            // Sort by total activity time descending
            processedData.sort((a, b) => b.totalMinutes - a.totalMinutes);

            // Calculate summary statistics
            const totalWorkspaces = processedData.length;
            const totalActiveSessions = processedData.reduce((sum, w) => sum + w.totalSessions, 0);
            const totalActiveHours = processedData.reduce((sum, w) => sum + w.totalHours, 0);
            const totalUniquePlayers = new Set(workspaceActivity.flatMap(w => w.uniquePlayers || [])).size;

            return {
                workspaces: processedData,
                summary: {
                    totalWorkspaces,
                    totalActiveSessions,
                    totalActiveHours,
                    totalUniquePlayers,
                    averageSessionsPerWorkspace: Math.round(totalActiveSessions / totalWorkspaces),
                    averageHoursPerWorkspace: Math.round(totalActiveHours / totalWorkspaces)
                }
            };
        })
    })
})