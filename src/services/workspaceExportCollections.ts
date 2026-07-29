import { Filter, ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';

/**
 * The registry of what "all of a workspace's data" actually means — every
 * collection a full takeout covers, and how each one is scoped to a workspace.
 *
 * Shared by the exporter (generateWorkspaceExport.ts) and the self-host
 * importer (workspaceImport.service.ts) so a bundle always round-trips: a
 * collection missing here is exported by neither and imported by neither.
 *
 * Scoping is not uniform, which is the whole reason this lives in one place:
 *  - most collections carry a string `groupId`
 *  - the session collections carry a *numeric* `groupId`
 *  - `site_alert` carries a `groupIds` array
 *  - the live-server collections (chats/logs) carry no group field at all and
 *    are reachable only through their parent `running_games` row
 *
 * Deliberately excluded: cross-workspace and global collections that are not
 * the workspace's to take (`user`, `user_identity`, `roblox_user`,
 * `readmin_resume`, `content_report`, `gdpr_removed_user`), internal caches and
 * sync bookkeeping (`image_cache`, `discord_command_sync`, `workspace_export`),
 * and credential material (`user_auth_session`).
 */

export type CollectionKey = keyof typeof readminCollections;

export type WorkspaceCollectionSpec = {
  /** Key in readminCollections, and the file name used inside the bundle. */
  key: CollectionKey;
  /** Short note shown in the UI / manifest so an admin knows what the file is. */
  label: string;
  /**
   * Filter selecting this workspace's documents. `runningGameIds` is only
   * populated for the live-server collections that need it.
   */
  filter: (ctx: WorkspaceScope) => Filter<any>;
  /**
   * True when the collection holds sensitive material an admin should be aware
   * of (raw API keys, bot tokens). Still exported — it is their data — but
   * flagged in the manifest.
   */
  sensitive?: boolean;
};

export type WorkspaceScope = {
  groupIdStr: string;
  groupIdNum: number;
  /** `_id`s of this workspace's running_games rows; empty when none are live. */
  runningGameIds: ObjectId[];
};

/** Standard case: a string `groupId` field. */
const byGroupId = (ctx: WorkspaceScope): Filter<any> => ({ groupId: ctx.groupIdStr });
/** The session collections store `groupId` as a number. */
const byNumericGroupId = (ctx: WorkspaceScope): Filter<any> => ({ groupId: ctx.groupIdNum });

/**
 * running_game_chats / running_game_logs have no group field — they hang off a
 * running_games row and are deleted with it when a server ends (see
 * sync-game-killer/clearOld.ts), so only currently-live servers have any. A
 * workspace with nothing running exports zero of these, and an empty `$in`
 * would match nothing anyway — but we return a filter that is explicitly
 * unsatisfiable to make that intent obvious rather than incidental.
 */
const byRunningGame = (ctx: WorkspaceScope): Filter<any> =>
  ctx.runningGameIds.length ? { runningGameId: { $in: ctx.runningGameIds } } : { _id: { $in: [] } };

export const WORKSPACE_COLLECTIONS: WorkspaceCollectionSpec[] = [
  // Core workspace configuration
  { key: 'workspace', label: 'Workspace settings', filter: byGroupId, sensitive: true },
  { key: 'department', label: 'Departments', filter: byGroupId },
  { key: 'department_role', label: 'Department roles', filter: byGroupId },
  { key: 'department_users', label: 'Department members', filter: byGroupId },
  { key: 'group_role', label: 'Roblox group roles', filter: byGroupId },
  { key: 'distribution', label: 'Distributions (pay periods)', filter: byGroupId },
  { key: 'activity_requirements', label: 'Activity requirements', filter: byGroupId },
  { key: 'site_alert', label: 'Site alerts', filter: (ctx) => ({ groupIds: ctx.groupIdStr }) },
  { key: 'workspace_banner', label: 'Workspace banners', filter: byGroupId },

  // Members and staff records
  { key: 'group_member', label: 'Group members', filter: byGroupId },
  { key: 'group_member_details', label: 'Member details', filter: byGroupId },
  { key: 'group_member_milestone', label: 'Member milestones', filter: byGroupId },
  { key: 'user_note', label: 'Staff notes', filter: byGroupId },
  { key: 'write_ups', label: 'Write-ups / disciplinary records', filter: byGroupId },
  { key: 'inactivity', label: 'Inactivity notices', filter: byGroupId },
  { key: 'manual_minutes', label: 'Manually credited minutes', filter: byGroupId },
  { key: 'time_entry', label: 'Timeclock entries', filter: byGroupId },
  { key: 'workspace_bans', label: 'Workspace bans', filter: byGroupId },
  { key: 'workspace_tag', label: 'User tags', filter: byGroupId },
  { key: 'workspace_tag_member', label: 'User tag assignments', filter: byGroupId },
  { key: 'promotion_request', label: 'Promotion requests', filter: byGroupId },
  { key: 'group_audit_log', label: 'Audit log', filter: byGroupId },

  // Teams
  { key: 'team', label: 'Teams', filter: byGroupId },
  { key: 'team_member', label: 'Team members', filter: byGroupId },
  { key: 'team_role_link', label: 'Team role links', filter: byGroupId },
  { key: 'team_document', label: 'Team documents', filter: byGroupId },
  { key: 'team_feedback', label: 'Team feedback', filter: byGroupId },
  { key: 'time_off_request', label: 'Time-off requests', filter: byGroupId },
  { key: 'expense_request', label: 'Expense requests', filter: byGroupId },

  // Applications and hiring
  { key: 'application', label: 'Application forms', filter: byGroupId },
  { key: 'response', label: 'Application responses', filter: byGroupId },
  { key: 'job_posting', label: 'Job postings', filter: byGroupId },
  { key: 'job_application', label: 'Job applications', filter: byGroupId },

  // Sessions / trainings
  { key: 'session', label: 'Sessions', filter: byGroupId },
  { key: 'sessions_template', label: 'Session templates', filter: byGroupId },
  { key: 'session_roles', label: 'Session roles', filter: byGroupId },
  { key: 'session_claim_release', label: 'Session claim releases', filter: byGroupId },

  // Activity tracking
  { key: 'user_game_session', label: 'Tracked game sessions', filter: byNumericGroupId },
  { key: 'user_game_session_event', label: 'Game session events', filter: byNumericGroupId },
  {
    key: 'user_game_session_distribution_summary',
    label: 'Per-distribution activity summaries',
    filter: byGroupId,
  },
  { key: 'user_game_session_yearly_summary', label: 'Yearly activity summaries', filter: byGroupId },
  { key: 'workspace_tracking_consent', label: 'Tracking consent decisions', filter: byGroupId },
  { key: 'workspace_data_request_log', label: 'Data request audit trail', filter: byGroupId },

  // Games and live servers
  { key: 'game', label: 'Games', filter: byGroupId, sensitive: true },
  { key: 'game_command', label: 'Game commands', filter: byGroupId },
  { key: 'running_games', label: 'Live game servers', filter: byGroupId },
  { key: 'running_game_players', label: 'Live server players', filter: byGroupId },
  { key: 'running_game_chats', label: 'Live server chat logs', filter: byRunningGame },
  { key: 'running_game_logs', label: 'Live server output logs', filter: byRunningGame },
  { key: 'in_game_support_ticket', label: 'In-game support tickets', filter: byGroupId },
  { key: 'in_game_call_ban', label: 'In-game call bans', filter: byGroupId },
  { key: 'readmin_module_error_report', label: 'Module error reports', filter: byGroupId },

  // Ranking / automation
  { key: 'ranking_key', label: 'Ranking API keys', filter: byGroupId, sensitive: true },
  { key: 'roblox_bots', label: 'Roblox bot accounts', filter: byGroupId, sensitive: true },
  { key: 'discord_bots', label: 'Discord bot configuration', filter: byGroupId, sensitive: true },
  { key: 'discord_logging', label: 'Discord logging configuration', filter: byGroupId },
  { key: 'group_oauth_authorization', label: 'Roblox OAuth authorizations', filter: byGroupId, sensitive: true },
  { key: 'roblox_group_action_queue', label: 'Queued group actions', filter: byGroupId },
  { key: 'rank_retry_queue', label: 'Rank retry queue', filter: byGroupId },

  // Flows
  { key: 'flow', label: 'Flows (automations)', filter: byGroupId },
  { key: 'flow_run', label: 'Flow runs', filter: byGroupId },
  { key: 'flow_approval', label: 'Flow approvals', filter: byGroupId },
  { key: 'flow_counter', label: 'Flow counters', filter: byGroupId },

  // Tasks, feed and hub
  { key: 'task', label: 'Tasks', filter: byGroupId },
  { key: 'task_board', label: 'Task boards', filter: byGroupId },
  { key: 'feed', label: 'Activity feed', filter: byGroupId },
  { key: 'hub_container', label: 'Hub containers', filter: byGroupId },
  { key: 'hub_resource', label: 'Hub resources', filter: byGroupId },
  { key: 'hub_resource_open', label: 'Hub resource opens', filter: byGroupId },

  // Orders / point of sale
  { key: 'orders', label: 'Orders', filter: byGroupId },
  { key: 'order_counter', label: 'Order counters', filter: byGroupId },
  { key: 'product', label: 'Products', filter: byGroupId },
  { key: 'product_category', label: 'Product categories', filter: byGroupId },
  { key: 'pos_config', label: 'Point-of-sale configuration', filter: byGroupId },
  { key: 'device_profile', label: 'Device profiles', filter: byGroupId },

  // Views and saved exports
  { key: 'workspace_view', label: 'Saved views', filter: byGroupId },
  { key: 'workspace_view_export', label: 'View export history', filter: byGroupId },

  // Account-level records tied to this workspace
  { key: 'cancellation_feedback', label: 'Cancellation feedback', filter: byGroupId },
  { key: 'setup_assist_request', label: 'Setup assistance requests', filter: byGroupId },
  { key: 'partnership_request', label: 'Partnership requests', filter: byGroupId },
];

/** Resolve the scope every collection filter is built from. */
export async function resolveWorkspaceScope(groupIdStr: string): Promise<WorkspaceScope> {
  const groupIdNum = parseInt(groupIdStr, 10);

  // Live-server chats/logs are reachable only through their parent rows, so
  // resolve those ids once up front rather than per collection.
  const runningGames = await readminCollections.running_games
    .find({ groupId: groupIdStr }, { projection: { _id: 1 } })
    .toArray();

  return {
    groupIdStr,
    groupIdNum,
    runningGameIds: runningGames.map((g) => g._id).filter((id): id is ObjectId => !!id),
  };
}

/** Look up a spec by the file name used inside a bundle. Used by the importer. */
export function findCollectionSpec(key: string): WorkspaceCollectionSpec | undefined {
  return WORKSPACE_COLLECTIONS.find((c) => c.key === key);
}
