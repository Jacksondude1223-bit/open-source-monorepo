import { ObjectId, Filter } from 'mongodb';
import { readminCollections, MongoTypes } from '~/services/mongo.service';
import {
    canonicalUserKey,
    isLegacyUserKey,
    resolveUserIdentity,
} from '~/services/userIdentity.service';
import { getTrackingConsentStatus, setTrackingConsent, ConsentStatus } from '~/services/trackingConsent.service';

/**
 * Workspace-scoped data-subject tooling: gather (data-access) or purge
 * (data-deletion) everything ReAdmin has passively tracked for one player
 * within one workspace, so a workspace admin can fulfil a request a player made
 * by "contacting the group" (the in-game privacy policy can't link them to the
 * website — Roblox ToS).
 *
 * Activity is keyed by a canonical `userKey` (see userIdentity.service.ts). One
 * person may be known by several linked keys (a legacy global id plus scoped
 * domain ids), so every match resolves the full identity first and matches
 * across all of them — mirroring how GDPR removal and tracking consent already
 * work. Legacy records written before the scoped-ID migration carry only the
 * numeric `userId`, so those are matched too (never the -1 scoped sentinel,
 * which would match every scoped player).
 *
 * Scope of a deletion (what the player's request governs): the passively
 * tracked activity collections only — sessions, session events, in-game chats,
 * the per-distribution/yearly rollups, and live running-game player rows — plus
 * the per-workspace tracking ignore so they are not re-tracked. It deliberately
 * does NOT touch the cross-workspace `user_identity` document (shared with other
 * workspaces) or admin-authored staff/HR records (notes, write-ups, timeclock,
 * inactivity) which are not consent-governed activity tracking.
 */

export type ResolvedSubject = {
    /** Canonical form of the key the admin looked up. */
    canonicalKey: string;
    /** Every string key this person is known by (incl. the global id as a string). */
    stringKeys: string[];
    /** Real global numeric Roblox ids among the keys — never the -1 scoped sentinel. */
    numericIds: number[];
    globalUserId: number | null;
    identity: MongoTypes.UserIdentity | null;
};

/** Resolve a looked-up key into the full set of identifiers an action must cover. */
export async function resolveSubject(userKey: string): Promise<ResolvedSubject> {
    const canonicalKey = canonicalUserKey(userKey);
    const identity = await resolveUserIdentity(canonicalKey);

    const stringKeySet = new Set<string>([canonicalKey, ...(identity?.keys ?? [])]);
    const globalUserId =
        (isLegacyUserKey(canonicalKey) ? parseInt(canonicalKey, 10) : null) ??
        identity?.globalUserId ??
        null;
    if (globalUserId !== null) stringKeySet.add(String(globalUserId));

    const stringKeys = [...stringKeySet];
    const numericIds = [
        ...new Set(
            stringKeys
                .map((k) => (isLegacyUserKey(k) ? parseInt(k, 10) : NaN))
                .filter((n) => Number.isFinite(n) && n > 0),
        ),
    ];

    return { canonicalKey, stringKeys, numericIds, identity, globalUserId };
}

// ── Per-collection match builders ───────────────────────────────────────────
// groupId is a string on the workspace but a number on session/event records.

/**
 * Match the subject's sessions. groupId is numeric on these records, and
 * (groupId, userKey)/(groupId, userId) are indexed — so this is the only
 * user-keyed activity query that hits an index. Events are NOT keyed by user;
 * they are reached through their parent session instead (see eventMatch).
 */
function sessionScopedMatch(
    groupIdNum: number,
    subject: ResolvedSubject,
): Filter<MongoTypes.UserGameSession> {
    const or: any[] = [{ userKey: { $in: subject.stringKeys } }];
    if (subject.numericIds.length) or.push({ userId: { $in: subject.numericIds } });
    return { groupId: groupIdNum, $or: or } as any;
}

/** Match running-game player rows / summaries (groupId + userId are strings here). */
function stringScopedMatch(groupIdStr: string, subject: ResolvedSubject): Filter<any> {
    return {
        groupId: groupIdStr,
        $or: [{ userKey: { $in: subject.stringKeys } }, { userId: { $in: subject.stringKeys } }],
    };
}

/** Match the per-distribution / yearly rollups, keyed by (groupId, userId) strings. */
function summaryMatch(groupIdStr: string, subject: ResolvedSubject): Filter<any> {
    return { groupId: groupIdStr, userId: { $in: subject.stringKeys } };
}

/**
 * One indexed pass over the subject's sessions in this workspace, returning
 * everything the event and chat scoping needs:
 *  - sessionIds: the parent-session `_id`s that events are matched by. Events
 *    are not indexed by user, so the only index-friendly way to find a
 *    player's events is to walk their (indexed) sessions and match events by
 *    `userGameSession` — the same access path every other event read uses.
 *  - runningGameIds / internalGameIds: the games the subject played here, used
 *    to scope running_game_chats (which has no groupId).
 * Must be computed BEFORE sessions are deleted in a purge.
 */
async function subjectSessionScope(groupIdNum: number, subject: ResolvedSubject) {
    const sessions = await readminCollections.user_game_session
        .find(sessionScopedMatch(groupIdNum, subject), {
            projection: { _id: 1, runningGameId: 1, internalGameId: 1 },
        })
        .toArray();

    const sessionIds: ObjectId[] = [];
    const runningGameIdHex = new Set<string>();
    const internalGameIds = new Set<string>();
    for (const s of sessions) {
        if (s._id) sessionIds.push(s._id);
        if (s.runningGameId) runningGameIdHex.add(s.runningGameId.toHexString());
        if (s.internalGameId) internalGameIds.add(s.internalGameId);
    }
    return {
        sessionIds,
        runningGameIds: [...runningGameIdHex].map((h) => new ObjectId(h)),
        internalGameIds: [...internalGameIds],
    };
}

/**
 * Match a subject's events through their parent sessions (`userGameSession`,
 * the only indexed access path on the events collection). Null when the
 * subject has no sessions here — there can be no events without a session.
 */
function eventMatch(sessionIds: ObjectId[]): Filter<MongoTypes.UserGameSessionEvent> | null {
    if (!sessionIds.length) return null;
    return { userGameSession: { $in: sessionIds } };
}

/** Build the chat filter from a precomputed scope. Null when the subject has no games here. */
function chatMatch(
    subject: ResolvedSubject,
    scope: { runningGameIds: ObjectId[]; internalGameIds: string[] },
): Filter<MongoTypes.RunningGameChats> | null {
    const gameOr: any[] = [];
    if (scope.runningGameIds.length) gameOr.push({ runningGameId: { $in: scope.runningGameIds } });
    if (scope.internalGameIds.length) gameOr.push({ internalGameId: { $in: scope.internalGameIds } });
    if (!gameOr.length) return null;
    return {
        $and: [
            { $or: [{ userKey: { $in: subject.stringKeys } }, { userId: { $in: subject.stringKeys } }] },
            { $or: gameOr },
        ],
    } as any;
}

// Defensive cap so a single export can't pull an unbounded number of docs into
// memory / over the wire. Counts always reflect the true totals; only the
// embedded record arrays are capped, with a `truncated` flag when they are.
const EXPORT_RECORD_LIMIT = 50_000;

export type WorkspaceUserDataExport = {
    generatedAt: Date;
    workspace: { groupId: string; groupName?: string };
    subject: {
        lookupKey: string;
        canonicalKey: string;
        keys: string[];
        globalUserId: number | null;
        username?: string;
        displayName?: string;
        thumbnailUrl?: string;
    };
    consent: { status: ConsentStatus | null };
    counts: Record<string, number>;
    truncated: Record<string, boolean>;
    records: {
        sessions: MongoTypes.UserGameSession[];
        events: MongoTypes.UserGameSessionEvent[];
        chats: MongoTypes.RunningGameChats[];
        distributionSummaries: MongoTypes.UserGameSessionDistributionSummary[];
        yearlySummaries: MongoTypes.UserGameSessionYearlySummary[];
        runningGamePlayers: MongoTypes.RunningGamePlayers[];
        identity: MongoTypes.UserIdentity | null;
    };
};

/**
 * Gather a downloadable bundle of everything tracked for a user in a workspace.
 * Returns the public bundle plus the resolved subject (for the audit log).
 */
export async function gatherWorkspaceUserData(
    groupIdStr: string,
    lookupKey: string,
    groupName?: string,
): Promise<{ bundle: WorkspaceUserDataExport; subject: ResolvedSubject }> {
    const groupIdNum = parseInt(groupIdStr, 10);
    const subject = await resolveSubject(lookupKey);

    const sessionFilter = sessionScopedMatch(groupIdNum, subject);
    const summFilter = summaryMatch(groupIdStr, subject);
    const rgpFilter = stringScopedMatch(groupIdStr, subject);
    // One indexed pass over the subject's sessions yields both the parent-session
    // ids events are matched by and the games their chats are scoped to.
    const scope = await subjectSessionScope(groupIdNum, subject);
    const eventFilter = eventMatch(scope.sessionIds);
    const chatFilter = chatMatch(subject, scope);

    const lim = { limit: EXPORT_RECORD_LIMIT };
    const [
        sessions,
        events,
        chats,
        distributionSummaries,
        yearlySummaries,
        runningGamePlayers,
        sessionCount,
        eventCount,
        chatCount,
        distCount,
        yearCount,
        rgpCount,
        consentStatus,
    ] = await Promise.all([
        readminCollections.user_game_session.find(sessionFilter, { sort: { started: 1 }, ...lim }).toArray(),
        eventFilter
            ? readminCollections.user_game_session_event.find(eventFilter, { sort: { date: 1 }, ...lim }).toArray()
            : Promise.resolve([] as MongoTypes.UserGameSessionEvent[]),
        chatFilter
            ? readminCollections.running_game_chats.find(chatFilter, { sort: { created: 1 }, ...lim }).toArray()
            : Promise.resolve([] as MongoTypes.RunningGameChats[]),
        readminCollections.user_game_session_distribution_summary.find(summFilter, lim).toArray(),
        readminCollections.user_game_session_yearly_summary.find(summFilter, lim).toArray(),
        readminCollections.running_game_players.find(rgpFilter, lim).toArray(),
        readminCollections.user_game_session.countDocuments(sessionFilter),
        eventFilter ? readminCollections.user_game_session_event.countDocuments(eventFilter) : Promise.resolve(0),
        chatFilter ? readminCollections.running_game_chats.countDocuments(chatFilter) : Promise.resolve(0),
        readminCollections.user_game_session_distribution_summary.countDocuments(summFilter),
        readminCollections.user_game_session_yearly_summary.countDocuments(summFilter),
        readminCollections.running_game_players.countDocuments(rgpFilter),
        getTrackingConsentStatus(groupIdStr, subject.canonicalKey, subject.identity),
    ]);

    const counts: Record<string, number> = {
        sessions: sessionCount,
        events: eventCount,
        chats: chatCount,
        distributionSummaries: distCount,
        yearlySummaries: yearCount,
        runningGamePlayers: rgpCount,
    };
    const truncated: Record<string, boolean> = {
        sessions: sessionCount > sessions.length,
        events: eventCount > events.length,
        chats: chatCount > chats.length,
        distributionSummaries: distCount > distributionSummaries.length,
        yearlySummaries: yearCount > yearlySummaries.length,
        runningGamePlayers: rgpCount > runningGamePlayers.length,
    };

    const bundle: WorkspaceUserDataExport = {
        generatedAt: new Date(),
        workspace: { groupId: groupIdStr, groupName },
        subject: {
            lookupKey: canonicalUserKey(lookupKey),
            canonicalKey: subject.canonicalKey,
            keys: subject.stringKeys,
            globalUserId: subject.globalUserId,
            username: subject.identity?.username,
            displayName: subject.identity?.displayName,
            thumbnailUrl: subject.identity?.thumbnailUrl,
        },
        consent: { status: consentStatus },
        counts,
        truncated,
        records: {
            sessions,
            events,
            chats,
            distributionSummaries,
            yearlySummaries,
            runningGamePlayers,
            identity: subject.identity,
        },
    };

    return { bundle, subject };
}

/**
 * Purge a user's tracked activity in a workspace and add them to the
 * per-workspace tracking ignore (consent = denied) so they are not re-tracked.
 * Returns the deleted counts plus the resolved subject (for the audit log).
 */
export async function purgeWorkspaceUserData(
    groupIdStr: string,
    lookupKey: string,
): Promise<{ counts: Record<string, number>; subject: ResolvedSubject }> {
    const groupIdNum = parseInt(groupIdStr, 10);
    const subject = await resolveSubject(lookupKey);

    // Events are reachable only through their parent session, and the chat
    // scope is derived from the subject's sessions — so resolve both (one
    // indexed pass) BEFORE any sessions are deleted.
    const scope = await subjectSessionScope(groupIdNum, subject);
    const chatFilter = chatMatch(subject, scope);
    const eventFilter = eventMatch(scope.sessionIds);

    const sessionFilter = sessionScopedMatch(groupIdNum, subject);
    const counts: Record<string, number> = {};

    counts.chats = chatFilter
        ? (await readminCollections.running_game_chats.deleteMany(chatFilter)).deletedCount ?? 0
        : 0;
    counts.events = eventFilter
        ? (await readminCollections.user_game_session_event.deleteMany(eventFilter)).deletedCount ?? 0
        : 0;
    counts.sessions = (await readminCollections.user_game_session.deleteMany(sessionFilter)).deletedCount ?? 0;
    counts.distributionSummaries =
        (await readminCollections.user_game_session_distribution_summary.deleteMany(summaryMatch(groupIdStr, subject)))
            .deletedCount ?? 0;
    counts.yearlySummaries =
        (await readminCollections.user_game_session_yearly_summary.deleteMany(summaryMatch(groupIdStr, subject)))
            .deletedCount ?? 0;
    counts.runningGamePlayers =
        (await readminCollections.running_game_players.deleteMany(stringScopedMatch(groupIdStr, subject)))
            .deletedCount ?? 0;

    // Add them to the per-workspace tracking ignore. Recorded under the canonical
    // key; the join-time check resolves across all linked keys (see
    // trackingConsent.service.ts), and playerJoin honours a 'denied' record on
    // every join regardless of the workspace's requireConsent setting.
    await setTrackingConsent(groupIdStr, subject.canonicalKey, 'denied');
    counts.trackingIgnore = 1;

    return { counts, subject };
}

export type TrackedUserLookupResult = {
    canonicalKey: string;
    keys: string[];
    globalUserId: number | null;
    username?: string;
    displayName?: string;
    thumbnailUrl?: string;
    sessionCount: number;
    lastSeen?: Date;
    consentStatus: ConsentStatus | null;
};

const LOOKUP_IDENTITY_LIMIT = 25;
const LOOKUP_RESULT_LIMIT = 25;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find people tracked in this workspace matching `query` (a userKey, a Roblox
 * id, or a username/display-name fragment). Returns only those with tracked
 * activity in this workspace, or an existing consent decision here (so an
 * already-opted-out / already-purged user is still findable).
 */
export async function lookupTrackedUsers(groupIdStr: string, query: string): Promise<TrackedUserLookupResult[]> {
    const q = query.trim();
    if (!q) return [];
    const groupIdNum = parseInt(groupIdStr, 10);

    // 1) Collect candidate identities by exact key, global id, or name fragment.
    const regex = { $regex: escapeRegExp(q), $options: 'i' };
    const identityOr: any[] = [{ keys: q }, { serializedUser: q }, { username: regex }, { displayName: regex }];
    if (/^\d+$/.test(q)) identityOr.push({ globalUserId: parseInt(q, 10) });

    const identities = await readminCollections.user_identity
        .find({ $or: identityOr })
        .limit(LOOKUP_IDENTITY_LIMIT)
        .toArray();

    // Resolve each candidate to a subject, plus the raw query itself so legacy
    // players with no identity document (digit key) are still found.
    const subjects = new Map<string, ResolvedSubject>();
    for (const identity of identities) {
        const subject = await resolveSubject(identity.primaryKey);
        subjects.set(subject.canonicalKey, subject);
    }
    if (!subjects.size || isLegacyUserKey(q)) {
        const direct = await resolveSubject(q);
        if (!subjects.has(direct.canonicalKey)) subjects.set(direct.canonicalKey, direct);
    }

    // 2) Keep only subjects actually tracked here (or with a consent decision here).
    const results: TrackedUserLookupResult[] = [];
    for (const subject of subjects.values()) {
        if (results.length >= LOOKUP_RESULT_LIMIT) break;
        const filter = sessionScopedMatch(groupIdNum, subject);
        const [sessionCount, lastSession, consentStatus] = await Promise.all([
            readminCollections.user_game_session.countDocuments(filter),
            readminCollections.user_game_session.findOne(filter, { sort: { started: -1 }, projection: { started: 1 } }),
            getTrackingConsentStatus(groupIdStr, subject.canonicalKey, subject.identity),
        ]);
        if (sessionCount === 0 && consentStatus === null) continue;
        results.push({
            canonicalKey: subject.canonicalKey,
            keys: subject.stringKeys,
            globalUserId: subject.globalUserId,
            username: subject.identity?.username,
            displayName: subject.identity?.displayName,
            thumbnailUrl: subject.identity?.thumbnailUrl,
            sessionCount,
            lastSeen: lastSession?.started,
            consentStatus,
        });
    }

    results.sort((a, b) => (b.lastSeen?.getTime() ?? 0) - (a.lastSeen?.getTime() ?? 0));
    return results;
}

/** Record an export/delete action against the workspace audit trail. */
export async function logDataRequest(params: {
    groupId: string;
    actorRobloxId: string;
    actorName?: string;
    subject: ResolvedSubject;
    action: MongoTypes.WorkspaceDataRequestAction;
    counts: Record<string, number>;
}): Promise<void> {
    await readminCollections.workspace_data_request_log.insertOne({
        groupId: params.groupId,
        actorRobloxId: params.actorRobloxId,
        actorName: params.actorName,
        subjectUserKey: params.subject.canonicalKey,
        subjectKeys: params.subject.stringKeys,
        ...(params.subject.globalUserId !== null ? { subjectGlobalUserId: params.subject.globalUserId } : {}),
        action: params.action,
        counts: params.counts,
        created: new Date(),
    });
}
