import { WithId } from 'mongodb';
import {
    Game,
    Session,
    SessionClaim,
    SessionClaimV2,
    SessionServerType,
    UserState,
} from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';

// ──────────────────────────────────────────────────────────────────────────
// Sessions API v2 — normalization layer
//
// The raw `session` documents are awkward for third-party developers: server
// claims are keyed by UUID maps, claims can be EITHER an object map or an array,
// game / role names are not resolved, and there is no notion of a session
// "status". Everything below converts a raw document into a flat, predictable,
// fully-resolved shape that is pleasant to consume from any language.
// ──────────────────────────────────────────────────────────────────────────

export type SessionStatus = 'scheduled' | 'live' | 'ended';

export interface NormalizedClaim {
    userId: string;
    roleId: string | null;
    roleName: string | null;
    state: UserState;
    claimedBy: string;
    claimedAt: Date;
    claimId: string | null;
}

export interface NormalizedAttendee {
    userId: string;
    state: UserState | null;
    addedBy: string;
}

export interface NormalizedServer {
    id: string;
    nickname: string | null;
    linked: boolean;
    linkedServerId: string | null;
    linkedJobId: string | null;
    linkedBy: string | null;
    claims: NormalizedClaim[];
    attendees: NormalizedAttendee[];
}

export interface NormalizedGame {
    gameId: number | null;
    placeId: number | null;
    name: string | null;
    thumbnail: string | null;
}

export interface NormalizedSession {
    id: string;
    groupId: string;
    name: string;
    description: string;
    status: SessionStatus;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    appearsAt: Date | null;
    templateId: string | null;
    oneOff: boolean;
    game: NormalizedGame | null;
    roleGroupIds: string[];
    servers: NormalizedServer[];
    counts: { servers: number; claims: number; attendees: number };
    createdBy: string | null;
    createdAt: Date;
}

// Builds a lookup of subrole id -> subrole name for an entire workspace so claim
// roles can be resolved to human-readable names without N extra queries.
export async function buildRoleNameMap(groupId: string): Promise<Map<string, string>> {
    const roleGroups = await readminCollections.session_roles.find({ groupId }).toArray();
    const map = new Map<string, string>();
    for (const group of roleGroups) {
        for (const subrole of group.roles) {
            map.set(subrole.id, subrole.name);
        }
    }
    return map;
}

// Builds a placeId -> game lookup for a set of sessions in a single query.
export async function buildGameMap(groupId: string, placeIds: number[]): Promise<Map<number, WithId<Game>>> {
    const unique = Array.from(new Set(placeIds.filter((id) => typeof id === 'number')));
    const map = new Map<number, WithId<Game>>();
    if (unique.length === 0) return map;
    const games = await readminCollections.game.find({ groupId, placeId: { $in: unique } }).toArray();
    for (const game of games) {
        map.set(game.placeId, game);
    }
    return map;
}

export function getSessionStatus(session: Pick<Session, 'date' | 'endsAt'>, now = new Date()): SessionStatus {
    const starts = new Date(session.date).getTime();
    const ends = new Date(session.endsAt).getTime();
    if (now.getTime() < starts) return 'scheduled';
    if (now.getTime() > ends) return 'ended';
    return 'live';
}

function normalizeClaims(
    claims: SessionServerType['claims'],
    roleNameMap: Map<string, string>,
): NormalizedClaim[] {
    if (!claims) return [];

    const toNormalized = (userId: string, claim: SessionClaim | SessionClaimV2): NormalizedClaim => ({
        userId,
        roleId: claim.claimedRole ?? null,
        roleName: claim.claimedRole ? roleNameMap.get(claim.claimedRole) ?? null : null,
        state: claim.state ?? 'none',
        claimedBy: claim.claimedBy,
        claimedAt: claim.claimedAt,
        claimId: claim.claimId ?? null,
    });

    // V2 array form: each entry carries its own userId.
    if (Array.isArray(claims)) {
        return claims.map((claim) => toNormalized(claim.userId, claim));
    }

    // Legacy map form: keyed by userId.
    return Object.entries(claims).map(([userId, claim]) => toNormalized(userId, claim));
}

function normalizeAttendees(attendees: SessionServerType['attendees']): NormalizedAttendee[] {
    if (!attendees) return [];
    return Object.entries(attendees).map(([userId, attendee]) => ({
        userId,
        state: attendee.state ?? null,
        addedBy: attendee.addedBy,
    }));
}

export function normalizeServer(
    serverId: string,
    server: SessionServerType,
    roleNameMap: Map<string, string>,
): NormalizedServer {
    return {
        id: serverId,
        nickname: server.nickname ?? null,
        linked: server.linkedToServer ?? false,
        linkedServerId: server.linkedServerReAdminId ?? null,
        linkedJobId: server.linkedServerJobId ?? null,
        linkedBy: server.linkedByUser ?? null,
        claims: normalizeClaims(server.claims, roleNameMap),
        attendees: normalizeAttendees(server.attendees),
    };
}

export function normalizeSession(
    session: WithId<Session>,
    gameMap: Map<number, WithId<Game>>,
    roleNameMap: Map<string, string>,
    now = new Date(),
): NormalizedSession {
    const servers = Object.entries(session.servers || {}).map(([serverId, server]) =>
        normalizeServer(serverId, server, roleNameMap),
    );

    const placeId = session.template?.placeId ?? null;
    const game = placeId != null ? gameMap.get(placeId) : undefined;

    const claimCount = servers.reduce((sum, server) => sum + server.claims.length, 0);
    const attendeeCount = servers.reduce((sum, server) => sum + server.attendees.length, 0);

    return {
        id: session._id.toString(),
        groupId: session.groupId,
        name: session.template?.name ?? 'Session',
        description: session.template?.description ?? '',
        status: getSessionStatus(session, now),
        startsAt: session.date,
        endsAt: session.endsAt,
        durationMinutes: session.template?.sessionDuration ?? 0,
        appearsAt: session.notifyTime ?? null,
        templateId: session.templateId ? session.templateId.toString() : null,
        oneOff: session.oneOffSession ?? false,
        game: placeId != null
            ? {
                gameId: game?.gameId ?? session.template?.gameId ?? null,
                placeId,
                name: game?.name ?? null,
                thumbnail: game?.images?.thumbnail ?? null,
            }
            : null,
        roleGroupIds: session.template?.roles ?? [],
        servers,
        counts: { servers: servers.length, claims: claimCount, attendees: attendeeCount },
        createdBy: session.createdBy ?? null,
        createdAt: session.created,
    };
}

// Opaque cursor helpers (cursor = encoded numeric offset). Keeps the public
// contract clean (`cursor` / `nextCursor`) without leaking internal paging.
export function encodeCursor(offset: number): string {
    return Buffer.from(`o:${offset}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): number {
    if (!cursor) return 0;
    try {
        const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
        const match = /^o:(\d+)$/.exec(decoded);
        if (!match || !match[1]) return 0;
        return Math.max(0, parseInt(match[1], 10) || 0);
    } catch {
        return 0;
    }
}
