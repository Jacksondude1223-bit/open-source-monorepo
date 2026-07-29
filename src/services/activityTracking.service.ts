import { ObjectId, WithId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { MongoTypes } from '~/services/mongo.service';
import { iso8601ToTimezone } from '~/utils/DateUtils';
import { getGroupInfo, getUserInfo } from '~/services/roblox.service';
import { dmUserDiscord } from '~/services/discord.service';
import playerJoinHandler from '~/fastifyAPI/apiHandlers/internal/events-handler/messageTypes/playerJoin';
import {
    canonicalUserKey,
    ensureUserIdentity,
    legacyNumericUserId,
    legacyUserIdFromKey,
    resolveUserIdentity,
} from '~/services/userIdentity.service';
import { playerPlatform } from '~/services/NewMongoTypes/RunningGamePlayers.type';
import { handleCallDiscordClose } from '~/services/callDiscord.service';

/**
 * Shared activity-join logic used by both the playerJoin handler and the
 * consent handler. Splitting it keeps the two transports in lockstep and lets
 * privacy mode gate tracking without duplicating the (sizeable) session-creation
 * block.
 *
 * Key invariant: resolveJoinContext only READS. No identity document or session
 * record is written until startTrackingSession runs — so a player who is
 * filtered out (non-staff in staff-only mode) or hasn't consented leaves no
 * trace, which is the whole point of privacy mode.
 */

export type ActivityJoinBody = {
    playerId: number;
    userKey?: string;
    platform: playerPlatform;
    safechat: boolean;
    datetime?: number;
    username?: string;
    displayName?: string;
    tzOffset?: string;
    thumbnailUrl?: string;
    groupRank?: number;
    groupRole?: string;
    domain?: { serializedUser?: string; domainType?: string; domainId?: number; scopedId?: number };
};

export type JoinContext = {
    userKey: string;
    globalUserId: number | null;
    isStaff: boolean;
    ban: WithId<MongoTypes.WorkspaceBans> | null;
    distributionNum: number;
};

/** Resolve identity/staff/ban for a joining player — reads only, never writes. */
export async function resolveJoinContext(
    workspace: WithId<MongoTypes.Workspace>,
    body: ActivityJoinBody,
): Promise<JoinContext> {
    const { groupId } = workspace;
    const userKey = canonicalUserKey(body.userKey ?? body.playerId);

    const identity = await resolveUserIdentity(userKey);
    const globalUserId = legacyUserIdFromKey(userKey) ?? identity?.globalUserId ?? null;

    const [currentDistribution, role] = await Promise.all([
        readminCollections.distribution.findOne({ groupId, isCurrent: true }),
        globalUserId !== null
            ? readminCollections.group_member.findOne({ userId: globalUserId, groupId })
            : Promise.resolve(null),
    ]);

    // Prefer the synced group_member rank; fall back to the rank read off the
    // Player instance in-game (works for scoped users with no group_member row).
    let isStaff = role ? role.rankId >= workspace.minSyncRole : false;
    if (!role && typeof body.groupRank === 'number') {
        isStaff = body.groupRank >= workspace.minSyncRole;
    }

    const banUserIds = globalUserId !== null && String(globalUserId) !== userKey
        ? [userKey, String(globalUserId)]
        : [userKey];
    const ban = await readminCollections.workspace_bans.findOne({ groupId, userId: { $in: banUserIds }, active: true });

    return { userKey, globalUserId, isStaff, ban, distributionNum: currentDistribution?.num || 0 };
}

/**
 * Create the tracking records for a joining player (running_game_players +
 * user_game_session), capture their identity, and run the join side effects.
 * Only called once tracking is actually permitted.
 */
export async function startTrackingSession(
    workspace: WithId<MongoTypes.Workspace>,
    runningGame: WithId<MongoTypes.RunningGames>,
    body: ActivityJoinBody,
    ctx: JoinContext,
    joinDate: Date,
): Promise<{ sessionId: ObjectId; runningPlayerId: ObjectId }> {
    const { groupId } = workspace;
    const internalGameId = runningGame.internalGameId;
    const { userKey, globalUserId, isStaff, ban } = ctx;
    const { platform, safechat, username, displayName, tzOffset, datetime, thumbnailUrl, groupRank, groupRole, domain } = body;

    // Identity capture happens here (a write) — only when we actually track.
    await ensureUserIdentity(userKey, {
        username,
        displayName,
        thumbnailUrl,
        serializedUser: domain?.serializedUser,
        domainType: domain?.domainType,
        domainId: domain?.domainId,
        scopedId: domain?.scopedId,
    }).catch((e) => {
        console.error('ensureUserIdentity failed on join', userKey, e);
    });

    const running_player = await readminCollections.running_game_players.insertOne({
        runningGameId: runningGame._id,
        groupId,
        userId: userKey,
        userKey,
        internalGameId,
        platform,
        isStaff,
        ...(typeof groupRank === 'number' ? { capturedRank: groupRank } : {}),
        ...(groupRole ? { capturedRole: groupRole } : {}),
        joined: joinDate,
    });

    const user_session = await readminCollections.user_game_session.insertOne({
        runningGameId: runningGame._id,
        runningPlayerId: running_player.insertedId,
        staff: isStaff,
        useMilliseconds: datetime !== undefined,
        distribution: ctx.distributionNum,
        groupId: parseInt(groupId),
        gameId: runningGame.gameId,
        placeId: runningGame.placeId,
        internalGameId,
        platform,
        userId: legacyNumericUserId(userKey),
        userKey,
        started: datetime ? new Date(datetime) : joinDate,
        active: true,
        inGame: true,
        safeChat: safechat,
        created: joinDate,
    });

    if (user_session?.insertedId) {
        await readminCollections.running_game_players.updateOne(
            { _id: running_player.insertedId },
            { $set: { userSessionId: user_session.insertedId } },
        );
    }

    await readminCollections.running_games.updateOne(
        { _id: runningGame._id },
        { $push: { players: userKey } },
    );

    // group_member is keyed by global Roblox ID; an unlinked scoped player has
    // no record there to update.
    if (globalUserId !== null) {
        await readminCollections.group_member.updateOne(
            { groupId, userId: globalUserId },
            {
                $set: {
                    inGame: true,
                    inGameId: internalGameId,
                    inRunningGameId: runningGame._id,
                    lastSessionId: user_session.insertedId,
                    sessionId: user_session.insertedId,
                    playerId: running_player.insertedId,
                    safeChat: safechat,
                    timezone: iso8601ToTimezone(tzOffset || ''),
                },
            },
        );
    }

    if (isStaff && globalUserId !== null) {
        const groupInfo = await getGroupInfo(groupId);
        dmUserDiscord(String(globalUserId), `Your time is now being tracked at ${groupInfo?.displayName}.`, `We will continue to track your session until you leave, and then we will send you an updated summary.`, 'blue', `Powered by ReAdmin. This content is not endorsed by ReAdmin, LLC. To disable messaging do /opt-into-messaing false. This came from: https://panel.readmin.app/workspaces/${workspace.groupId}`, { workspace, category: 'sessionTracking', variables: { groupName: groupInfo?.displayName } });
    }

    try {
        playerJoinHandler({
            groupId,
            userId: userKey,
            internalGameId,
            platform,
            safechat,
            banned: ban ? ban.reason : false,
        });
    } catch (e) {
        // non-fatal
    }

    try {
        // users.roblox.com only knows global IDs; an unlinked scoped player has
        // nothing to fetch — their name came from the join payload.
        if (globalUserId !== null) {
            getUserInfo(globalUserId);
        }
    } catch (e) {
        // non-fatal
    }

    return { sessionId: user_session.insertedId, runningPlayerId: running_player.insertedId };
}

/**
 * Close any call the leaving player still has open on this server.
 *
 * The game module is supposed to end the call itself (support/end with
 * `userLeft`), but a crash or an ungraceful disconnect never sends that. An
 * orphaned open ticket blocks the player from opening another call, so this is
 * the server-side safety net. Never throws — a leave must not fail over this.
 */
export async function closeOpenCallsForLeavingPlayer(
    groupId: string,
    runningGameId: ObjectId,
    callerId: number,
): Promise<void> {
    if (!Number.isFinite(callerId)) return;
    try {
        const openCalls = await readminCollections.in_game_support_ticket.find({
            groupId,
            runningGameId,
            callerId,
            status: { $in: ['open', 'claimed'] },
        }).toArray();
        if (openCalls.length === 0) return;

        await readminCollections.in_game_support_ticket.updateMany(
            { _id: { $in: openCalls.map(c => c._id) } },
            {
                $set: {
                    status: 'closed',
                    closed: {
                        user: 'ReAdmin',
                        reason: 'userLeft',
                        date: new Date(),
                        // The server this call belongs to is still running, so it
                        // needs to be told the call ended (sendData sweeps for
                        // unacknowledged closures).
                        serverAcknowledged: false,
                    },
                },
            },
        );

        for (const call of openCalls) {
            handleCallDiscordClose(call).catch(() => { });
        }
    } catch (e) {
        console.error('Failed to close open calls for leaving player', groupId, callerId, e);
    }
}

/**
 * Delete all data for a single tracking session — used on leave when a player
 * in a consent-required workspace never granted consent. Removes the session,
 * its events, this visit's chats, and the running-game/group-member references,
 * leaving no retained record. Past (already-consented) sessions are untouched.
 *
 * Note: the OpenSearch chat mirror is not pruned here — see the follow-up note;
 * Mongo is the system of record and is fully cleared.
 */
export async function deleteSessionData(
    workspace: WithId<MongoTypes.Workspace>,
    runningGame: WithId<MongoTypes.RunningGames>,
    session: WithId<MongoTypes.UserGameSession>,
    runningPlayer?: WithId<MongoTypes.RunningGamePlayers> | null,
): Promise<void> {
    const userKey = session.userKey ?? String(session.userId);
    const globalUserId = legacyUserIdFromKey(userKey) ?? null;

    await Promise.all([
        readminCollections.user_game_session_event.deleteMany({ userGameSession: session._id }),
        readminCollections.user_game_session.deleteOne({ _id: session._id }),
        readminCollections.running_game_chats.deleteMany({
            runningGameId: runningGame._id,
            $or: [{ userKey }, { userId: userKey }],
        }),
        runningPlayer
            ? readminCollections.running_game_players.deleteOne({ _id: runningPlayer._id })
            : readminCollections.running_game_players.deleteMany({ runningGameId: runningGame._id, userKey }),
        readminCollections.running_games.updateOne(
            { _id: runningGame._id },
            { $pull: { players: { $in: [userKey, String(session.userId)] } } },
        ),
    ]);

    if (globalUserId !== null) {
        await readminCollections.group_member.updateOne(
            { groupId: workspace.groupId, userId: globalUserId },
            { $set: { inGame: false }, $unset: { inGameId: '', sessionId: '', playerId: '' } },
        );
    }
}
