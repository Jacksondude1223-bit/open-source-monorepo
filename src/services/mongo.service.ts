import { Collection, CreateIndexesOptions, IndexSpecification, MongoClient } from "mongodb";
import { env } from "~/services/env";
import * as MongoTypes from "./NewMongoTypes";
export { MongoTypes };

/**
 * TLS is decided by the connection string, not forced here.
 *
 * `mongodb+srv://` turns it on by default — which is what every managed provider
 * hands you — and `mongodb://…?tls=true` opts in explicitly. A mongod running on
 * the same box as the panel speaks no TLS at all, so forcing it made the obvious
 * self-hosted setup, `mongodb://127.0.0.1:27017`, fail every connection attempt
 * and surface as "Topology is closed" on the first query.
 */
export const mongoClient = new MongoClient(env.MONGODB_URI, {
    appName: `${env.APP_NAME}-${env.NODE_ENV}`,
    retryReads: true,
    retryWrites: true,
    serverSelectionTimeoutMS: 30000,
});

// Replace single connect() with robust retry logic
let isConnecting = false;

async function wait(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

async function connectWithRetry() {
    if (isConnecting) return;
    isConnecting = true;

    const initialDelay = 1000; // ms
    const maxDelay = 30000; // ms
    const maxAttempts = 20;

    let attempt = 0;
    let delay = initialDelay;

    while (true) {
        attempt++;
        try {
            await mongoClient.connect();
            // Connected successfully
            // eslint-disable-next-line no-console
            console.info(`MongoDB connected (attempt ${attempt})`);
            break;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`MongoDB connection attempt ${attempt} failed:`, err);
            if (attempt >= maxAttempts) {
                // If configured to stop after maxAttempts, keep trying in background but don't throw
                // eslint-disable-next-line no-console
                console.warn(`Reached configured max attempts (${maxAttempts}); will continue retrying in background.`);
            }
            // Exponential backoff with jitter
            const jitter = Math.floor(Math.random() * delay);
            const waitMs = Math.min(delay + jitter, maxDelay);
            // eslint-disable-next-line no-console
            console.info(`Retrying MongoDB connection in ${waitMs}ms`);
            await wait(waitMs);
            delay = Math.min(delay * 2, maxDelay);
        }
    }

    isConnecting = false;
}

// Start initial connection attempt in background
connectWithRetry().catch((err) => {
    // Shouldn't throw, but log just in case
    // eslint-disable-next-line no-console
    console.error("Unexpected error in MongoDB connectWithRetry:", err);
});

// Reconnect on close/error events
mongoClient.on && mongoClient.on("close", () => {
    // eslint-disable-next-line no-console
    console.warn("MongoDB connection closed, attempting reconnect...");
    connectWithRetry().catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Error while reconnecting to MongoDB after close:", err);
    });
});

mongoClient.on && mongoClient.on("error", (err: any) => {
    // eslint-disable-next-line no-console
    console.error("MongoDB client error event:", err);
    // Attempt reconnect if not connected
    connectWithRetry().catch((e) => {
        // eslint-disable-next-line no-console
        console.error("Error while reconnecting to MongoDB after error event:", e);
    });
});

export const readminDatabase = mongoClient.db(env.MONGODB_DATABASE);
export const readminCollections = {
    activity_requirements: readminDatabase.collection<MongoTypes.ActivityRequirement>("activity_requirement"),
    application: readminDatabase.collection<MongoTypes.Application>("application"),
    department: readminDatabase.collection<MongoTypes.Department>("department"),
    department_role: readminDatabase.collection<MongoTypes.DepartmentRole>("department_role"),
    department_users: readminDatabase.collection<MongoTypes.DepartmentUser>("department_user"),
    discord_bots: readminDatabase.collection<MongoTypes.DiscordBots>("discord_bots"),
    discord_command_sync: readminDatabase.collection<{ clientId: string; hash: string; updated: Date }>("discord_command_sync"),
    discord_logging: readminDatabase.collection<MongoTypes.DiscordLogging>("discord_logging"),
    group_member_milestone: readminDatabase.collection<MongoTypes.GroupMemberMilestone>("group_member_milestone"),
    distribution: readminDatabase.collection<MongoTypes.Distribution>("distribution"),
    hub_resource: readminDatabase.collection<MongoTypes.HubResource>("hub_resource"),
    hub_container: readminDatabase.collection<MongoTypes.HubContainer>("hub_container"),
    hub_resource_open: readminDatabase.collection<MongoTypes.HubResourceOpen>("hub_resource_open"),
    game: readminDatabase.collection<MongoTypes.Game>("game"),
    game_command: readminDatabase.collection<MongoTypes.GameCommand>("game_command"),
    group_audit_log: readminDatabase.collection<MongoTypes.GroupAuditLog>("group_audit_log"),
    group_member: readminDatabase.collection<MongoTypes.GroupMember>("group_member"),
    group_member_details: readminDatabase.collection<MongoTypes.GroupMemberDetails>("group_member_details"),
    group_oauth_authorization: readminDatabase.collection<MongoTypes.GroupOAuthAuthorization>("group_oauth_authorization"),
    group_role: readminDatabase.collection<MongoTypes.GroupRole>("group_role"),
    image_cache: readminDatabase.collection<MongoTypes.ImageCache>("image_cache"),
    inactivity: readminDatabase.collection<MongoTypes.Inactivity>("inactivity"),
    manual_minutes: readminDatabase.collection<MongoTypes.ManualMinutes>("manual_minutes"),
    time_entry: readminDatabase.collection<MongoTypes.TimeEntry>("time_entry"),
    queued_game_action: readminDatabase.collection<MongoTypes.QueuedGameAction>("queued_game_action"),
    ranking_key: readminDatabase.collection<MongoTypes.RankingKey>("ranking_key"),
    response: readminDatabase.collection<MongoTypes.Response>("response"),
    roblox_bots: readminDatabase.collection<MongoTypes.RobloxBots>("roblox_bots"),
    rank_retry_queue: readminDatabase.collection<MongoTypes.RankRetryQueue>("rank_retry_queue"),
    roblox_group_action_queue: readminDatabase.collection<MongoTypes.RobloxGroupActionQueue>("roblox_group_action_queue"),
    running_game_players: readminDatabase.collection<MongoTypes.RunningGamePlayers>("running_game_players"),
    running_game_logs: readminDatabase.collection<MongoTypes.RunningGameLogs>("running_game_logs"),
    running_game_chats: readminDatabase.collection<MongoTypes.RunningGameChats>("running_game_chats"),
    running_games: readminDatabase.collection<MongoTypes.RunningGames>("running_games"),
    session: readminDatabase.collection<MongoTypes.Session>("session_v2"),
    session_claim_release: readminDatabase.collection<MongoTypes.SessionClaimRelease>("session_claim_release"),
    session_roles: readminDatabase.collection<MongoTypes.SessionRoles>("session_roles_v2"),
    sessions_template: readminDatabase.collection<MongoTypes.SessionsTemplate>("sessions_template_v2"),
    site_alert: readminDatabase.collection<MongoTypes.SiteAlert>("site_alert"),
    workspace_banner: readminDatabase.collection<MongoTypes.WorkspaceBanner>("workspace_banner"),
    feed: readminDatabase.collection<MongoTypes.Feed>("feed"),
    task: readminDatabase.collection<MongoTypes.Task>("task"),
    task_board: readminDatabase.collection<MongoTypes.TaskBoard>("task_board"),
    ticket: readminDatabase.collection<MongoTypes.Ticket>("ticket"),
    in_game_support_ticket: readminDatabase.collection<MongoTypes.InGameSupportTicket>("in_game_support_ticket"),
    in_game_call_ban: readminDatabase.collection<MongoTypes.InGameCallBan>("in_game_call_ban"),
    user: readminDatabase.collection<MongoTypes.User>("user"),
    user_auth_session: readminDatabase.collection<MongoTypes.UserAuthSession>("user_auth_session"),
    user_game_session: readminDatabase.collection<MongoTypes.UserGameSession>("user_game_session_v2"),
    user_identity: readminDatabase.collection<MongoTypes.UserIdentity>("user_identity"),
    user_link_code: readminDatabase.collection<MongoTypes.UserLinkCode>("user_link_code"),
    workspace_tracking_consent: readminDatabase.collection<MongoTypes.WorkspaceTrackingConsent>("workspace_tracking_consent"),
    user_game_session_event: readminDatabase.collection<MongoTypes.UserGameSessionEvent>("user_game_session_event"),
    user_game_session_distribution_summary: readminDatabase.collection<MongoTypes.UserGameSessionDistributionSummary>("user_game_session_distribution_summary"),
    user_game_session_yearly_summary: readminDatabase.collection<MongoTypes.UserGameSessionYearlySummary>("user_game_session_yearly_summary"),
    user_note: readminDatabase.collection<MongoTypes.UserNote>("user_note"),
    workspace: readminDatabase.collection<MongoTypes.Workspace>("workspace"),
    workspace_bans: readminDatabase.collection<MongoTypes.WorkspaceBans>("workspace_bans"),
    workspace_tag: readminDatabase.collection<MongoTypes.Tag>("workspace_tag"),
    workspace_tag_member: readminDatabase.collection<MongoTypes.TagMember>("workspace_tag_member"),
    workspace_view: readminDatabase.collection<MongoTypes.View>("workspace_view"),
    workspace_view_export: readminDatabase.collection<MongoTypes.ViewDownload>("workspace_view_export"),
    write_ups: readminDatabase.collection<MongoTypes.WriteUps>("write_ups"),
    orders: readminDatabase.collection<MongoTypes.Order>("order"),
    product: readminDatabase.collection<MongoTypes.Product>("product"),
    product_category: readminDatabase.collection<MongoTypes.ProductCategory>("product_category"),
    pos_config: readminDatabase.collection<MongoTypes.PosConfig>("pos_config"),
    order_counter: readminDatabase.collection<MongoTypes.OrderCounter>("order_counter"),
    device_profile: readminDatabase.collection<MongoTypes.DeviceProfile>("device_profile"),
    readmin_module_error_report: readminDatabase.collection<MongoTypes.ReAdminModuleErrorReport>("readmin_module_error_report"),
    gdpr_removed_user: readminDatabase.collection<MongoTypes.GDPRRemovedUser>("gdpr_removed_user"),
    workspace_data_request_log: readminDatabase.collection<MongoTypes.WorkspaceDataRequestLog>("workspace_data_request_log"),
    workspace_export: readminDatabase.collection<MongoTypes.WorkspaceExport>("workspace_export"),
    roblox_user: readminDatabase.collection<MongoTypes.RobloxUser>("roblox_user"),
    promotion_request: readminDatabase.collection<MongoTypes.PromotionRequest>("promotion_request"),
    team: readminDatabase.collection<MongoTypes.Team>("team"),
    team_member: readminDatabase.collection<MongoTypes.TeamMember>("team_member"),
    team_role_link: readminDatabase.collection<MongoTypes.TeamRoleLink>("team_role_link"),
    team_document: readminDatabase.collection<MongoTypes.TeamDocument>("team_document"),
    time_off_request: readminDatabase.collection<MongoTypes.TimeOffRequest>("time_off_request"),
    expense_request: readminDatabase.collection<MongoTypes.ExpenseRequest>("expense_request"),
    team_feedback: readminDatabase.collection<MongoTypes.TeamFeedback>("team_feedback"),
    job_posting: readminDatabase.collection<MongoTypes.JobPosting>("job_posting"),
    job_application: readminDatabase.collection<MongoTypes.JobApplication>("job_application"),
    readmin_resume: readminDatabase.collection<MongoTypes.ReAdminResume>("readmin_resume"),
    content_report: readminDatabase.collection<MongoTypes.ContentReport>("content_report"),
    cancellation_feedback: readminDatabase.collection<MongoTypes.CancellationFeedback>("cancellation_feedback"),
    setup_assist_request: readminDatabase.collection<MongoTypes.SetupAssistRequest>("setup_assist_request"),
    partnership_request: readminDatabase.collection<MongoTypes.PartnershipRequest>("partnership_request"),
    flow: readminDatabase.collection<MongoTypes.Flow>("flow"),
    flow_counter: readminDatabase.collection<MongoTypes.FlowCounter>("flow_counter"),
    flow_run: readminDatabase.collection<MongoTypes.FlowRun>("flow_run"),
    flow_approval: readminDatabase.collection<MongoTypes.FlowApproval>("flow_approval"),
};

type ManagedIndex = {
    collection: Collection<any>;
    key: IndexSpecification;
    options?: CreateIndexesOptions;
};

const MANAGED_INDEXES: ManagedIndex[] = [
    // ═══ Roblox users ═══
    { collection: readminCollections.roblox_user, key: { id: 1 }, options: { unique: true, name: 'idx_id_unique' } },
    // Lowercased-name indexes power the index-eligible case-insensitive prefix/exact
    // search in BetterRobloxSearch / findRobloxUserByExactName. Without these the
    // service was doing a full collection scan per keystroke.
    { collection: readminCollections.roblox_user, key: { nameLower: 1 }, options: { name: 'idx_nameLower' } },
    { collection: readminCollections.roblox_user, key: { displayNameLower: 1 }, options: { name: 'idx_displayNameLower' } },
    // Cluster-created, non-unique and descending — a distinct spec from idx_id_unique
    // above, so the two coexist. Kept so a restored cluster matches production.
    { collection: readminCollections.roblox_user, key: { id: -1 } },

    // ═══ Members ═══
    { collection: readminCollections.group_member, key: { groupId: 1, userId: 1 }, options: { unique: true, name: 'idx_groupId_userId_unique' } },
    { collection: readminCollections.group_member, key: { groupId: 1, roleId: 1 }, options: { name: 'idx_groupId_roleId' } },
    // Multi-role members: roleIds/rankIds/departmentIds hold the full set while
    // the scalars above stay as the derived highest/primary. These are multikey
    // indexes, so `find({ groupId, roleIds: X })` is a drop-in for the scalar
    // form. Each MUST lead with the scalar groupId — Mongo refuses a compound
    // index spanning two array fields, so these three can never be combined.
    { collection: readminCollections.group_member, key: { groupId: 1, roleIds: 1 }, options: { name: 'idx_groupId_roleIds' } },
    { collection: readminCollections.group_member, key: { groupId: 1, rankIds: 1 }, options: { name: 'idx_groupId_rankIds' } },
    { collection: readminCollections.group_member, key: { groupId: 1, departmentIds: 1 }, options: { name: 'idx_groupId_departmentIds' } },
    // Supports the sync-marker leave sweep at the end of SyncMembers
    // (find { groupId, lastSeenSyncId: { $ne: syncId } }).
    { collection: readminCollections.group_member, key: { groupId: 1, lastSeenSyncId: 1 }, options: { name: 'idx_groupId_lastSeenSyncId' } },
    // Cluster-created.
    { collection: readminCollections.group_member, key: { roleId: 1 } },
    { collection: readminCollections.group_member, key: { userId: 1 } },
    { collection: readminCollections.group_member, key: { groupId: 1, roleId: 1, userId: 1 } },

    // ═══ Identity ═══
    // Identity layer for the scoped-user-ID migration. Lookups are always
    // by member key; the unique multikey index also guarantees a key can
    // belong to at most one person (linking merges documents).
    //
    // NOTE: the hosted cluster carries `{keys: 1}` NON-unique. Same key with
    // different uniqueness is an IndexOptionsConflict, so on that cluster this
    // entry fails and logs — it does not stop the rest. Drop the existing
    // `keys_1` first if you want the invariant enforced; the build then also
    // fails if any key is genuinely shared between two identity documents,
    // which is the thing worth knowing about.
    { collection: readminCollections.user_identity, key: { keys: 1 }, options: { unique: true, name: 'idx_keys_unique' } },
    { collection: readminCollections.user_identity, key: { globalUserId: 1 }, options: { sparse: true, name: 'idx_globalUserId_sparse' } },
    // Cluster-created. `primaryKey` replaces a text index on the same field.
    { collection: readminCollections.user_identity, key: { globalUserId: -1 } },
    { collection: readminCollections.user_identity, key: { primaryKey: 1 } },

    // Identity link codes. Codes are looked up by value on redeem; the TTL
    // index lets Mongo reap expired/used codes (expiresAt is bumped well
    // past consumption is not needed — a consumed code can expire normally).
    { collection: readminCollections.user_link_code, key: { code: 1 }, options: { unique: true, name: 'idx_code_unique' } },
    { collection: readminCollections.user_link_code, key: { identityKey: 1 }, options: { name: 'idx_identityKey' } },
    { collection: readminCollections.user_link_code, key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: 'idx_expiresAt_ttl' } },

    // ═══ Accounts ═══
    // `robloxId` replaces a text index on the same field. This is the lookup on
    // the authenticated request path — without it every such request collection-scans.
    { collection: readminCollections.user, key: { robloxId: 1 } },
    { collection: readminCollections.user, key: { discordId: 1 } },

    // Per-workspace tracking consent. Looked up by (groupId, userKey) at join;
    // unique so a player has one decision per workspace.
    { collection: readminCollections.workspace_tracking_consent, key: { groupId: 1, userKey: 1 }, options: { unique: true, name: 'idx_groupId_userKey_unique' } },

        // Data-subject tooling (workspace-admin export/delete of a player's
        // tracked activity). The lookup/export/delete path resolves the subject's
        // sessions by (groupId, userKey)/(groupId, userId) — indexed below — and
        // then reaches their events through the parent-session reference
        // (`userGameSession`), the same access path every other event read uses.
        // The events collection is deliberately NOT indexed by user: it is the
        // highest-write collection in the system (one row per activity tick), so
        // a user-keyed query there full-scans and hammers the DB. The audit log
        // is listed most-recent-first per workspace.
    { collection: readminCollections.user_game_session, key: { groupId: 1, userKey: 1 }, options: { name: 'idx_session_group_userKey' } },
    { collection: readminCollections.user_game_session, key: { groupId: 1, userId: 1 }, options: { name: 'idx_session_group_userId' } },
    // Events are only ever queried by their parent session — keep that path indexed.
    // A same-key index already exists under another name on the hosted cluster
    // (`userGameSession_-1`), so one of these two is a no-op wherever both are present.
    { collection: readminCollections.user_game_session_event, key: { userGameSession: 1 }, options: { name: 'idx_event_userGameSession' } },
    { collection: readminCollections.workspace_data_request_log, key: { groupId: 1, created: -1 }, options: { name: 'idx_data_request_group_created' } },
    { collection: readminCollections.workspace_export, key: { groupId: 1, created: -1 }, options: { name: 'idx_workspace_export_group_created' } },
    { collection: readminCollections.workspace_export, key: { processId: 1 }, options: { unique: true, name: 'idx_workspace_export_processId_unique' } },

    // Cluster-created activity indexes.
    { collection: readminCollections.user_game_session, key: { groupId: -1 } },
    { collection: readminCollections.user_game_session, key: { userId: -1 } },
    { collection: readminCollections.user_game_session, key: { runningGameId: -1 } },
    { collection: readminCollections.user_game_session, key: { staff: -1 } },
    { collection: readminCollections.user_game_session, key: { inGame: -1 } },
    { collection: readminCollections.user_game_session, key: { created: -1 } },
    { collection: readminCollections.user_game_session, key: { placeId: -1 } },
    { collection: readminCollections.user_game_session, key: { gameId: -1 } },
    { collection: readminCollections.user_game_session, key: { groupId: 1, userId: 1, started: -1, ended: -1 } },
    { collection: readminCollections.user_game_session_event, key: { userGameSession: -1 } },
    { collection: readminCollections.user_game_session_event, key: { date: -1 } },
    { collection: readminCollections.user_game_session_event, key: { groupId: 1 } },

    // ═══ Activity rollups (all cluster-created) ═══
    { collection: readminCollections.user_game_session_distribution_summary, key: { groupId: 1, userId: 1, distribution: 1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { groupId: -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { userId: -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { distribution: -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { 'minutes.active': -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { 'minutes.total': -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { 'minutes.typing': -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { 'minutes.inactive': -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { 'minutes.messages': -1 } },
    { collection: readminCollections.user_game_session_distribution_summary, key: { sessions: -1 } },
    { collection: readminCollections.user_game_session_yearly_summary, key: { groupId: 1 } },
    { collection: readminCollections.user_game_session_yearly_summary, key: { userId: 1 } },
    { collection: readminCollections.user_game_session_yearly_summary, key: { year: -1 } },

    // ═══ Job Postings + Resumes ═══
    { collection: readminCollections.job_posting, key: { groupId: 1, status: 1, visibility: 1 }, options: { name: 'idx_group_status_visibility' } },
    { collection: readminCollections.job_posting, key: { status: 1, visibility: 1, createdAt: -1 }, options: { name: 'idx_status_visibility_createdAt' } },
    { collection: readminCollections.job_application, key: { jobPostingId: 1, createdAt: -1 }, options: { name: 'idx_jobPostingId_createdAt' } },
    { collection: readminCollections.job_application, key: { reAdminUserId: 1, createdAt: -1 }, options: { name: 'idx_reAdminUserId_createdAt' } },
    { collection: readminCollections.job_application, key: { groupId: 1, status: 1 }, options: { name: 'idx_groupId_status' } },
    { collection: readminCollections.readmin_resume, key: { reAdminUserId: 1 }, options: { unique: true, name: 'idx_reAdminUserId_unique' } },
    { collection: readminCollections.readmin_resume, key: { slug: 1 }, options: { unique: true, sparse: true, name: 'idx_slug_unique_sparse' } },
    { collection: readminCollections.readmin_resume, key: { robloxId: 1 }, options: { name: 'idx_robloxId' } },
    { collection: readminCollections.content_report, key: { contentType: 1, contentId: 1, reportedBy: 1 }, options: { unique: true, partialFilterExpression: { status: 'open' }, name: 'idx_open_report_unique' } },
    { collection: readminCollections.content_report, key: { contentType: 1, contentId: 1 }, options: { name: 'idx_contentType_contentId' } },
    { collection: readminCollections.content_report, key: { status: 1, createdAt: -1 }, options: { name: 'idx_status_createdAt' } },

    // ═══ Flows ═══
    { collection: readminCollections.flow, key: { groupId: 1, enabled: 1, 'trigger.type': 1 }, options: { name: 'idx_group_enabled_trigger' } },
    { collection: readminCollections.flow_counter, key: { flowId: 1, key: 1 }, options: { unique: true, name: 'idx_flowId_key_unique' } },
    { collection: readminCollections.flow_run, key: { flowId: 1, created: -1 }, options: { name: 'idx_flowId_created' } },
    { collection: readminCollections.flow_run, key: { groupId: 1, created: -1 }, options: { name: 'idx_group_created' } },
    { collection: readminCollections.flow_run, key: { dedupeKey: 1 }, options: { sparse: true, name: 'idx_dedupeKey' } },
    { collection: readminCollections.flow_approval, key: { groupId: 1, status: 1, created: -1 }, options: { name: 'idx_group_status_created' } },

    // ═══ Timeclock ═══
    // Enforce a single active clock-in per user per workspace.
    { collection: readminCollections.time_entry, key: { groupId: 1, userId: 1, status: 1 }, options: { unique: true, partialFilterExpression: { status: 'active' }, name: 'idx_one_active_clockin' } },
    { collection: readminCollections.time_entry, key: { groupId: 1, distribution: 1, userId: 1 }, options: { name: 'idx_group_distribution_user' } },
    { collection: readminCollections.time_entry, key: { groupId: 1, clockIn: -1 }, options: { name: 'idx_group_clockIn' } },

    // ═══ Time off / Inactivity ═══
    // Workspaces are expected to grow to thousands of requests. Supports the paginated
    // list (sort by created) and the per-month timeline window (overlap query on
    // starts/ends), plus the per-user approval-context lookup.
    { collection: readminCollections.inactivity, key: { groupId: 1, created: -1 }, options: { name: 'idx_inactivity_group_created' } },
    { collection: readminCollections.inactivity, key: { groupId: 1, userId: 1, created: -1 }, options: { name: 'idx_inactivity_group_user_created' } },
    { collection: readminCollections.inactivity, key: { groupId: 1, starts: 1, ends: 1 }, options: { name: 'idx_inactivity_group_starts_ends' } },

    // Session attendance — audit of released claims, queried per distribution by (group, session, user).
    { collection: readminCollections.session_claim_release, key: { groupId: 1, sessionId: 1, userId: 1 }, options: { name: 'idx_claim_release_group_session_user' } },

    // ═══ Sessions ═══
    // `groupId` replaces a text index on the same field.
    { collection: readminCollections.session, key: { groupId: 1 } },
    { collection: readminCollections.session, key: { attendees: -1 } },

    // ═══ Workspace core (all cluster-created) ═══
    // Every in-game request resolves its workspace by loaderId — see loaderIdHook.
    { collection: readminCollections.workspace, key: { loaderId: 1 } },
    { collection: readminCollections.workspace, key: { groupId: 1 } },
    { collection: readminCollections.workspace, key: { 'owner.robloxId': -1 } },
    { collection: readminCollections.workspace_bans, key: { groupId: 1, userId: 1, active: 1 } },
    { collection: readminCollections.distribution, key: { groupId: 1 } },
    { collection: readminCollections.game, key: { gameId: 1 } },
    { collection: readminCollections.game, key: { groupId: 1 } },
    { collection: readminCollections.group_role, key: { groupId: 1 } },
    { collection: readminCollections.group_audit_log, key: { groupId: -1, userId: -1 } },
    { collection: readminCollections.group_audit_log, key: { date: -1 } },
    { collection: readminCollections.image_cache, key: { filePath: 1 } },
    { collection: readminCollections.image_cache, key: { expires: -1 } },

    // ═══ Departments (cluster-created; groupId replaces a text index) ═══
    { collection: readminCollections.department, key: { groupId: 1 } },
    { collection: readminCollections.department_role, key: { groupId: 1 } },
    { collection: readminCollections.department_role, key: { roleId: 1 } },
    { collection: readminCollections.department_role, key: { departmentId: -1 } },
    { collection: readminCollections.department_users, key: { groupId: 1 } },
    { collection: readminCollections.department_users, key: { userId: 1 } },
    { collection: readminCollections.department_users, key: { departmentId: -1 } },

    // ═══ Discord (cluster-created; both replace text indexes) ═══
    { collection: readminCollections.discord_bots, key: { guildId: 1 } },
    { collection: readminCollections.discord_logging, key: { groupId: 1, event: 1 } },

    // ═══ Live game state (cluster-created; internalGameId replaces a text index) ═══
    { collection: readminCollections.running_games, key: { internalGameId: 1 } },
    { collection: readminCollections.running_games, key: { groupId: 1 } },
    { collection: readminCollections.running_games, key: { gameId: 1, placeId: 1 } },
    { collection: readminCollections.running_game_players, key: { internalGameId: 1 } },
    { collection: readminCollections.running_game_players, key: { userId: 1 } },
    { collection: readminCollections.running_game_chats, key: { internalGameId: 1 } },
    { collection: readminCollections.running_game_chats, key: { runningGameId: 1 } },

    // ═══ Orders v2 / POS ═══
    // Catalog reads are per-group; orders are listed per (group, game) and filtered
    // by status/queue/distribution; idempotency keys dedupe retried sync ops;
    // per-game daily order numbering needs a fast (group, game, created) scan.
    { collection: readminCollections.product, key: { groupId: 1, archived: 1, sortOrder: 1 }, options: { name: 'idx_product_group_archived_sort' } },
    { collection: readminCollections.product, key: { groupId: 1, barcodeId: 1 }, options: { sparse: true, name: 'idx_product_group_barcode' } },
    { collection: readminCollections.product_category, key: { groupId: 1, sortOrder: 1 }, options: { name: 'idx_category_group_sort' } },
    { collection: readminCollections.pos_config, key: { groupId: 1, gameId: 1 }, options: { unique: true, name: 'idx_posconfig_group_game_unique' } },
    { collection: readminCollections.orders, key: { groupId: 1, gameId: 1, status: 1, queueId: 1 }, options: { name: 'idx_order_group_game_status_queue' } },
    { collection: readminCollections.orders, key: { groupId: 1, distribution: 1, created: -1 }, options: { name: 'idx_order_group_distribution_created' } },
    { collection: readminCollections.orders, key: { groupId: 1, gameId: 1, created: -1 }, options: { name: 'idx_order_group_game_created' } },
    // Idempotency: a create/transition op carrying the same key resolves to the
    // same order across retried sync ticks. Sparse + unique so legacy/no-key docs are unaffected.
    { collection: readminCollections.orders, key: { groupId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'idx_order_group_idempotency_unique' } },
    { collection: readminCollections.order_counter, key: { groupId: 1, gameId: 1, day: 1 }, options: { unique: true, name: 'idx_order_counter_group_game_day_unique' } },
    // Web-managed device profiles: looked up per-group for the settings list and
    // resolved by `key` in-game. Key is unique per group so a device's Profile attribute is unambiguous.
    { collection: readminCollections.device_profile, key: { groupId: 1, key: 1 }, options: { unique: true, name: 'idx_device_profile_group_key_unique' } },
    { collection: readminCollections.device_profile, key: { groupId: 1, sortOrder: 1 }, options: { name: 'idx_device_profile_group_sort' } },
];

void (async () => {
    const failures: string[] = [];

    for (const { collection, key, options } of MANAGED_INDEXES) {
        try {
            await collection.createIndex(key, { background: true, ...options });
        } catch (e) {
            // An index that already exists under a different name or with different
            // options lands here, as does a unique build blocked by existing duplicates.
            // Both are worth surfacing, and neither should stop the remaining indexes.
            failures.push(`${collection.collectionName} ${JSON.stringify(key)} — ${(e as Error).message}`);
        }
    }

    if (failures.length) {
        console.warn(`[mongo] ${failures.length} of ${MANAGED_INDEXES.length} indexes could not be created:`);
        for (const failure of failures) console.warn(`[mongo]   ${failure}`);
    } else {
        console.info(`[mongo] ${MANAGED_INDEXES.length} indexes verified.`);
    }
})();