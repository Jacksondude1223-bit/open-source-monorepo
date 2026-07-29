import { ObjectId, WithId } from 'mongodb';
import { z } from 'zod';
import { workspacePremiumProcedure } from '~/server/procedures';
import { ActivityRequirement, Department, Game, GroupMember, RunningGamePlayers, RunningGames, UserGameSession, UserGameSessionDistributionSummary } from '~/services/NewMongoTypes';
import { Categories, Filter, Sort } from '~/services/NewMongoTypes/View.type';
import { RequirementTypes } from '~/services/NewMongoTypes/UserGameSessionDistributionSummary.type';
import { readminCollections } from '~/services/mongo.service';
import BetterRobloxSearch, { getUserThumbnail, batchGetRobloxUsers } from '~/services/roblox.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { andFilters, memberDepartmentIds, memberRoleIds, roleIdInFilter } from '~/services/groupMember.helpers';

// export type ExtendedUserGameSessionDistributionSummary = UserGameSessionDistributionSummary & {
//   department: Department;
//   index: number;
//   member: GroupMember;
//   playerInGame: RunningGamePlayers;
//   lastSession: UserGameSession;
//   thumbnail: string;
//   totalSessionsClaimed: number;
//   gameSession?: {
//     runningGame: RunningGames | null;
//     game: Game | null;
//   }
// }

type UGSDSProperties = 'minutes.total' | 'minutes.active' | 'minutes.typing' | 'minutes.inactive' | 'minutes.messages' | 'sessions';

function getValueByPath(obj: any, path: UGSDSProperties) {
  return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
}

// Function to map filter names to their corresponding nested properties
function mapFilterToProperty(filterName: Categories): UGSDSProperties {
  const mapping = {
    totalMinutes: 'minutes.total',
    activeMinutes: 'minutes.active',
    typingMinutes: 'minutes.typing',
    idleMinutes: 'minutes.inactive',
    messages: 'minutes.messages',
    sessions: 'attendedSessions',
  };
  return mapping[filterName] as UGSDSProperties;
}

// Function to build the filter query
function buildFilterQuery(filters: Filter[]) {
  return filters.reduce((query, filter) => {
    const filterPath = mapFilterToProperty(filter.name);
    if (!filterPath) {
      throw new Error(`Unsupported filter category: ${filter.name}`);
    }
    const filterOperations = {
      '<': '$lt',
      '>': '$gt',
      '=': '$eq',
      '!=': '$ne',
      '<=': '$lte',
      '>=': '$gte',
    };
    const operation = filterOperations[filter.type];
    if (!operation) {
      throw new Error(`Unsupported filter operation: ${filter.type}`);
    }

    //@ts-expect-error
    query[filterPath] = { [operation]: filter.value };
    return query;
  }, {});
}

// Function to build the sort query
function buildSortQuery(sort: Sort[]) {
  return sort.reduce((query, sortItem) => {
    const sortPath = mapFilterToProperty(sortItem.name);
    if (!sortPath) {
      throw new Error(`Unsupported sort category: ${sortItem.name}`);
    }
    //@ts-expect-error
    query[sortPath] = sortItem.type === 'ASC' ? 1 : -1;
    return query;
  }, {});
}


function createPseudoDistributionSummary(userId: string, groupId: string, distributionNum: string): UserGameSessionDistributionSummary {
  return {
    userId: userId,
    groupId: groupId,
    distribution: distributionNum,
    sessions: [],
    minutes: {
      total: 0,
      active: 0,
      inactive: 0,
      typing: 0,
      messages: 0,
    },
    attendedSessions: [],
    goals: {},
    created: new Date()
  };
}

// Per-requirement breakdown of a single goal for the Views "Goals" column.
type GoalRequirementProgress = {
  type: RequirementTypes;
  label: string;
  at: number;
  goal: number;
  metGoal: boolean;
  percentage: number;
};

// A user's progress against one applicable activity goal, surfaced inline in the
// Views table so managers can see who hit which goals this distribution.
export type ViewGoalProgress = {
  goalId: string;
  name: string;
  type: 'global' | 'game';
  requirements: GoalRequirementProgress[];
  metCount: number;
  totalCount: number;
  metAll: boolean;
};

// Maps each requirement type to its label and the matching field on the goal.
const GOAL_REQUIREMENT_DEFS: { type: RequirementTypes; label: string; field: 'minimumMinutes' | 'minimumActiveMinutes' | 'minimumMessages' | 'minimumSessions' }[] = [
  { type: 'minutes', label: 'Total Minutes', field: 'minimumMinutes' },
  { type: 'activeMinutes', label: 'Active Minutes', field: 'minimumActiveMinutes' },
  { type: 'minimumMessages', label: 'Messages', field: 'minimumMessages' },
  { type: 'minimumSessions', label: 'Sessions', field: 'minimumSessions' },
];

// Build a goal's progress from a user's at-values. Only requirements with a
// non-zero target are included; a goal with no active requirement returns null.
function buildGoalProgress(goal: ActivityRequirement, ats: Record<RequirementTypes, number>): ViewGoalProgress | null {
  const requirements: GoalRequirementProgress[] = [];
  for (const def of GOAL_REQUIREMENT_DEFS) {
    const goalValue = goal[def.field] || 0;
    if (goalValue <= 0) continue;
    const at = Math.round(ats[def.type] || 0);
    requirements.push({
      type: def.type,
      label: def.label,
      at,
      goal: goalValue,
      metGoal: at >= goalValue,
      percentage: goalValue === 0 ? 100 : Math.round((100 / goalValue) * at),
    });
  }
  if (requirements.length === 0) return null;
  const metCount = requirements.filter((r) => r.metGoal).length;
  return {
    goalId: goal._id!.toString(),
    name: goal.name,
    type: goal.type,
    requirements,
    metCount,
    totalCount: requirements.length,
    metAll: metCount === requirements.length,
  };
}



// Function to build the filter predicate
function buildFilterPredicate(filters: Filter[]) {
  return (summary: UserGameSessionDistributionSummary) => {
    return filters.every(filter => {
      const filterPath = mapFilterToProperty(filter.name);
      const value = getValueByPath(summary, filterPath);
      if (value === undefined) {
        return false;
      }
      switch (filter.type) {
        case '<':
          return value < filter.value;
        case '>':
          return value > filter.value;
        case '=':
          return value === filter.value;
        case '!=':
          return value !== filter.value;
        case '<=':
          return value <= filter.value;
        case '>=':
          return value >= filter.value;
        default:
          return true;
      }
    });
  };
}

// Function to build the sort comparator
function buildSortComparator(sort: Sort[]) {
  return (a: UserGameSessionDistributionSummary, b: UserGameSessionDistributionSummary) => {
    for (let sortItem of sort) {
      const sortPath = mapFilterToProperty(sortItem.name);
      const aValue = getValueByPath(a, sortPath);
      const bValue = getValueByPath(b, sortPath);
      if (!sortPath) {
        continue;
      }
      if (aValue < bValue) {
        return sortItem.type === 'ASC' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortItem.type === 'ASC' ? 1 : -1;
      }
    }
    return 0;
  };
}


export const computeViewData = workspacePremiumProcedure
  .input(
    z.object({
      groupId: z.string(),
      viewId: z.string(),
      distributionNum: z.number().nullable(),
      compareDistributionNum: z.number().nullable().optional(),
      gameId: z.number().nullable().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      nameSearch: z.string().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const { department } = ctx;

    const { groupId, viewId, distributionNum, compareDistributionNum, gameId = null, page = 1, pageSize = 10, nameSearch } = input;

    if (!department.permissions.reports.view) {
      throw ReturnNormalFailure(
        'UNAUTHORIZED',
        'You must be a workspace admin to do this operation',
      );
    }

    const [foundView, distribution, departments, activityGoals] = await Promise.all([
      readminCollections.workspace_view.findOne({ groupId, viewId }),
      readminCollections.distribution.findOne({
        groupId,
        ...(distributionNum ? { num: distributionNum } : { isCurrent: true })
      }),
      readminCollections.department.find({ groupId }).toArray(),
      readminCollections.activity_requirements.find({ groupId }).toArray(),
    ])

    if (!foundView) {
      throw ReturnNormalFailure('NOT_FOUND', 'View not found');
    }

    if (!distribution) {
      throw ReturnNormalFailure('NOT_FOUND', 'Distribution not found');
    }

    const [departmentRoles, departmentMembers] = await Promise.all([
      readminCollections.department_role.find({
        departmentId: { $in: foundView.departments },
      }).toArray(),
      readminCollections.department_users.find({
        departmentId: { $in: foundView.departments }
      }).toArray()
    ]);

    const departmentRoleMembers = await readminCollections.group_member.find(andFilters( // This is an extremly slow find. It takes a full second
      { groupId },
      {
        $or: [
          // Matches any of the member's roles, not just their highest.
          ...(roleIdInFilter(departmentRoles.map(role => role.roleId)).$or ?? []),
          { userId: { $in: departmentMembers.map(member => parseInt(member.userId)) } }
        ]
      },
    )).toArray();

    // Build filter and sort queries
    // const filterQuery = buildFilterQuery(foundView.filters);
    // const sortQuery = buildSortQuery(foundView.sort);

    const allUserIds = departmentRoleMembers.map(member => member.userId.toString());

    // Resolve every department a member belongs to (via their role's department
    // mapping or a direct department membership). `group_member.departmentId` is
    // frequently unset, so relying on it alone would drop all goal data.
    const roleToDepartments = new Map<number, Set<string>>();
    for (const role of departmentRoles) {
      if (!roleToDepartments.has(role.roleId)) roleToDepartments.set(role.roleId, new Set());
      roleToDepartments.get(role.roleId)!.add(role.departmentId.toString());
    }
    const userToDepartments = new Map<string, Set<string>>();
    for (const member of departmentMembers) {
      const key = member.userId.toString();
      if (!userToDepartments.has(key)) userToDepartments.set(key, new Set());
      userToDepartments.get(key)!.add(member.departmentId.toString());
    }
    const memberDepartments = new Map<string, Set<string>>();
    for (const member of departmentRoleMembers) {
      const key = member.userId.toString();
      const set = new Set<string>();
      // Every department the member reaches, through any of their roles.
      for (const departmentId of memberDepartmentIds(member)) set.add(departmentId.toString());
      for (const roleId of memberRoleIds(member)) {
        roleToDepartments.get(roleId)?.forEach((d) => set.add(d));
      }
      userToDepartments.get(key)?.forEach((d) => set.add(d));
      memberDepartments.set(key, set);
    }

    let distributionSummaryWithPseudo: UserGameSessionDistributionSummary[];

    if (gameId != null) {
      // Game-scoped view: re-aggregate raw play sessions for just the selected
      // game so every metric (and goal progress) reflects only that game,
      // instead of the pre-summed all-games distribution summary.
      const memberUserIdNumbers = departmentRoleMembers.map(member => parseInt(member.userId.toString()));
      const scoped = await readminCollections.user_game_session.aggregate<{
        _id: number;
        total: number; active: number; inactive: number; typing: number; messages: number;
        attended: string[][]; sessionIds: ObjectId[];
      }>([
        {
          $match: {
            groupId: parseInt(groupId),
            distribution: distribution.num,
            gameId,
            userId: { $in: memberUserIdNumbers },
          },
        },
        {
          $group: {
            _id: '$userId',
            total: { $sum: { $ifNull: ['$minutes.total', 0] } },
            active: { $sum: { $ifNull: ['$minutes.active', 0] } },
            inactive: { $sum: { $ifNull: ['$minutes.inactive', 0] } },
            typing: { $sum: { $ifNull: ['$minutes.typing', 0] } },
            messages: { $sum: { $ifNull: ['$minutes.messages', 0] } },
            attended: { $push: { $ifNull: ['$attendedSessions', []] } },
            sessionIds: { $push: '$_id' },
          },
        },
      ]).toArray();

      const scopedMap = new Map(scoped.map(s => [s._id.toString(), s]));
      distributionSummaryWithPseudo = allUserIds.map(userId => {
        const s = scopedMap.get(userId);
        if (!s) return createPseudoDistributionSummary(userId, groupId, distribution.num.toString());
        return {
          userId,
          groupId,
          distribution: distribution.num.toString(),
          sessions: s.sessionIds,
          minutes: {
            total: s.total,
            active: s.active,
            inactive: s.inactive,
            typing: s.typing,
            messages: s.messages,
          },
          attendedSessions: s.attended.flat(),
          goals: {},
          created: new Date(),
        } as UserGameSessionDistributionSummary;
      });
    } else {
      // Default view: use the pre-aggregated all-games distribution summary.
      const query = {
        groupId,
        distribution: distribution.num.toString(),
        userId: { $in: allUserIds },
      };

      const distributionSummary = await readminCollections.user_game_session_distribution_summary.find(query/*, { sort: sortQuery }*/).toArray();

      const summaryMap = new Map(distributionSummary.map(summary => [summary.userId.toString(), summary]));
      distributionSummaryWithPseudo = allUserIds.map(userId =>
        summaryMap.get(userId) || createPseudoDistributionSummary(userId, groupId, distribution.num.toString())
      );
    }

    let filteredAndPseudoSummaries = distributionSummaryWithPseudo.filter(buildFilterPredicate(foundView.filters));
    filteredAndPseudoSummaries.sort(buildSortComparator(foundView.sort));

    if (nameSearch != '') {
      const foundUsers = await BetterRobloxSearch(nameSearch?.toString() || '', groupId);
      filteredAndPseudoSummaries = filteredAndPseudoSummaries.filter(summary => foundUsers.includes(summary.userId.toString()));
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSummary: (UserGameSessionDistributionSummary & { index: number })[] = [];
    for (let i = startIndex; i < endIndex && i < filteredAndPseudoSummaries.length; i++) {
      //@ts-expect-error chill
      paginatedSummary.push({ ...filteredAndPseudoSummaries[i], index: i + 1 });
    }

    // Batch-resolve names from roblox_user and role names from group_role
    const memberUserIds = departmentRoleMembers.map(m => m.userId);
    const robloxUsersMap = await batchGetRobloxUsers(memberUserIds);
    const roleIds = [...new Set(departmentRoleMembers.map(m => m.roleId))];
    const rolesForLookup = await readminCollections.group_role.find({ groupId, id: { $in: roleIds } }).toArray();
    const roleNameMap = new Map(rolesForLookup.map(r => [r.id, r.name]));

    // Resolve tags + note counts inline so staff don't have to right-click a row
    // to see who is tagged. Only resolves for the current page of users.
    const pageUserIds = paginatedSummary.map(u => u.userId.toString());
    const [groupTags, tagMembers, noteCounts] = await Promise.all([
      readminCollections.workspace_tag.find({ groupId }).toArray(),
      readminCollections.workspace_tag_member.find({ groupId, userId: { $in: pageUserIds } }).toArray(),
      readminCollections.user_note.aggregate<{ _id: string; count: number }>([
        { $match: { groupId, userId: { $in: pageUserIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]).toArray(),
    ]);
    const tagMap = new Map(groupTags.map(t => [t.tagId, t]));
    const noteCountMap = new Map(noteCounts.map(n => [n._id.toString(), n.count]));

    // Optional distribution comparison: pull the comparison distribution's
    // summaries for the current page of users so the UI can surface deltas
    // (who improved, who declined) to make recognition/discipline easy at scale.
    let comparisonMap = new Map<string, UserGameSessionDistributionSummary>();
    const comparisonActive = compareDistributionNum != null && compareDistributionNum !== distribution.num;
    if (comparisonActive) {
      const comparisonSummaries = await readminCollections.user_game_session_distribution_summary.find({
        groupId,
        distribution: compareDistributionNum!.toString(),
        userId: { $in: pageUserIds },
      }).toArray();
      comparisonMap = new Map(comparisonSummaries.map(s => [s.userId.toString(), s]));
    }

    const computedSummary = await Promise.all(paginatedSummary.map(async user => {
      const foundGroupMember = departmentRoleMembers.find(member => member.userId.toString() === user.userId.toString());
      const foundDepartment = departments.find(dep => dep._id.toString() == foundGroupMember?.departmentId?.toString());

      // Resolve which activity goals actually apply to this member (their
      // department, or — when scoped to a game — only global/this-game goals)
      // and compute met/not-met per requirement for the inline Goals column.
      const userDepartments = memberDepartments.get(user.userId.toString()) || new Set<string>();
      const applicableGoals = activityGoals.filter((goal) => {
        const matchesDepartment = goal.departments.some((d) => userDepartments.has(d.toString()));
        if (!matchesDepartment) return false;
        if (gameId != null) {
          return goal.type !== 'game' || goal.gameId === gameId.toString();
        }
        return true;
      });

      const goalProgress: ViewGoalProgress[] = [];
      for (const goal of applicableGoals) {
        let ats: Record<RequirementTypes, number>;
        if (gameId != null) {
          // Game-scoped: derive at-values from this game's aggregated metrics.
          ats = {
            minutes: user.minutes?.total || 0,
            activeMinutes: (user.minutes?.active || 0) + (user.minutes?.typing || 0),
            minimumMessages: user.minutes?.messages || 0,
            minimumSessions: user.attendedSessions?.length || 0,
          };
        } else {
          // Default: reuse the stored per-goal progress (already game-aware for
          // game-specific goals) computed when summaries were last calculated.
          const stored = (user.goals || {})[goal._id!.toString()] as Record<RequirementTypes, { at: number }> | undefined;
          ats = {
            minutes: stored?.minutes?.at ?? 0,
            activeMinutes: stored?.activeMinutes?.at ?? 0,
            minimumMessages: stored?.minimumMessages?.at ?? 0,
            minimumSessions: stored?.minimumSessions?.at ?? 0,
          };
        }
        const built = buildGoalProgress(goal, ats);
        if (built) goalProgress.push(built);
      }

      // Enrich member with resolved names
      const rUser = foundGroupMember ? robloxUsersMap.get(foundGroupMember.userId) : null;
      const enrichedMember = foundGroupMember ? {
        ...foundGroupMember,
        name: rUser?.name || foundGroupMember.userId.toString(),
        displayName: rUser?.displayName || foundGroupMember.userId.toString(),
        rankName: roleNameMap.get(foundGroupMember.roleId) || '',
      } : null;

      const [thumbnail, playerInGame, lastSession, totalSessionsClaimed] = await Promise.all([
        getUserThumbnail(user.userId),
        foundGroupMember?.inGame ? readminCollections.running_game_players.findOne({
          _id: foundGroupMember?.playerId,
        }) : null,
        readminCollections.user_game_session.findOne(foundGroupMember?.lastSessionId ? {
          _id: foundGroupMember?.lastSessionId,

        } : {
          groupId: parseInt(groupId),
          userId: parseInt(user.userId),
        }, { sort: { created: -1 } }),
        readminCollections.session.countDocuments({
          groupId: groupId,
          claims: { $in: [user.userId] },
          date: { $gte: new Date(distribution.from), $lte: new Date(distribution.to || new Date()) }
        })
      ]);

      let gameSession = { runningGame: null, game: null } as { runningGame: WithId<RunningGames> | null; game: WithId<Game> | null; };
      if (playerInGame) {
        const runningGame = await readminCollections.running_games.findOne({
          _id: playerInGame.runningGameId,
          groupId,
        });
        const game = await readminCollections.game.findOne({
          gameId: runningGame?.gameId,
          groupId,
        })

        gameSession = {
          runningGame,
          game,
        };
      }


      return {
        ...user,
        department: foundDepartment,
        member: enrichedMember,
        thumbnail,
        playerInGame,
        lastSession,
        totalSessionsClaimed,
        gameSession,
        goalProgress,
        tags: tagMembers
          .filter(tm => tm.userId.toString() === user.userId.toString())
          .map(tm => tagMap.get(tm.tagId))
          .filter((t): t is NonNullable<typeof t> => Boolean(t)),
        noteCount: noteCountMap.get(user.userId.toString()) || 0,
        comparison: comparisonActive
          ? (() => {
            const prev = comparisonMap.get(user.userId.toString());
            return {
              total: Math.round(prev?.minutes?.total || 0),
              active: Math.round(prev?.minutes?.active || 0),
              idle: Math.round(prev?.minutes?.inactive || 0),
              typing: Math.round(prev?.minutes?.typing || 0),
              messages: Math.round(prev?.minutes?.messages || 0),
              sessions: prev?.attendedSessions?.length || 0,
              plays: prev?.sessions?.length || 0,
            };
          })()
          : null,
      };
    }));


    // Return the computed data
    return {
      response: computedSummary,
      view: foundView,
      pagination: {
        page,
        pageSize,
        total: filteredAndPseudoSummaries.length,
        totalPages: Math.ceil(filteredAndPseudoSummaries.length / pageSize)
      }
    }
  });
