import { readminCollections } from '~/services/mongo.service';
import { MongoTypes } from '~/services/mongo.service';

/**
 * Canonical user keys — the single identity representation for activity data.
 *
 * Roblox's scoped-user-ID rollout (Oct 2026) means a bare numeric UserId is
 * only meaningful inside the experience it came from: new players get a
 * per-domain ID, and the same number can refer to different people in
 * different games. Every activity record therefore carries a `userKey`:
 *
 *  - Legacy global IDs: bare digits ("156"). Identical to the old userId
 *    fields, so existing data needs no rewrite.
 *  - Scoped players: the serialized engine `User` form (`User:ToString()`),
 *    treated as an opaque string. Roblox guarantees these never collide with
 *    global IDs.
 *
 * Cross-game/person resolution lives in the `user_identity` collection — see
 * UserIdentity.type.ts. Records are never rewritten when identities link;
 * only identity documents merge.
 */

const LEGACY_KEY_PATTERN = /^\d+$/;

export function isLegacyUserKey(userKey: string): boolean {
    return LEGACY_KEY_PATTERN.test(userKey);
}

export function canonicalUserKey(value: string | number): string {
    return String(value).trim();
}

/** The global Roblox user ID when the key itself is a legacy global ID, else null. */
export function legacyUserIdFromKey(userKey: string): number | null {
    return isLegacyUserKey(userKey) ? parseInt(userKey, 10) : null;
}

/**
 * Value for the numeric `userId` fields legacy readers still aggregate on.
 * Scoped keys have no global number; -1 marks them so old rollups can never
 * mistake a scoped player for a real global ID.
 */
export function legacyNumericUserId(userKey: string): number {
    return legacyUserIdFromKey(userKey) ?? -1;
}

export async function resolveUserIdentity(userKey: string): Promise<MongoTypes.UserIdentity | null> {
    return readminCollections.user_identity.findOne({ keys: userKey });
}

/**
 * The global Roblox user ID behind a key, if we know one — either the key is
 * itself global, or the person has linked a global identity. Null for
 * unlinked scoped players; callers must skip Roblox web/Open Cloud lookups
 * (users.roblox.com, thumbnails, group rank) when null.
 */
export async function resolveGlobalUserId(userKey: string): Promise<number | null> {
    const direct = legacyUserIdFromKey(userKey);
    if (direct !== null) {
        return direct;
    }
    const identity = await resolveUserIdentity(userKey);
    return identity?.globalUserId ?? null;
}

/**
 * Find-or-create the identity document for a key, refreshing name info and
 * lastSeen. In-game capture is the source of truth for names here: for scoped
 * players there is no users.roblox.com record to fall back on.
 */
export type IdentityInfo = {
    username?: string;
    displayName?: string;
    thumbnailUrl?: string;
    /** Decomposed Roblox `User` datatype, when the game captured it. */
    domainType?: string;
    domainId?: number;
    scopedId?: number;
    serializedUser?: string;
};

export async function ensureUserIdentity(
    userKey: string,
    info?: IdentityInfo,
): Promise<MongoTypes.UserIdentity | null> {
    const now = new Date();
    const globalUserId = legacyUserIdFromKey(userKey);

    // Only set fields the caller actually provided, so a later join missing
    // (say) a thumbnail never clobbers a previously-captured one.
    const set: Record<string, any> = { lastSeen: now, updated: now };
    if (info?.username) set.username = info.username;
    if (info?.displayName) set.displayName = info.displayName;
    if (info?.thumbnailUrl) set.thumbnailUrl = info.thumbnailUrl;
    if (info?.domainType) set.domainType = info.domainType;
    if (info?.domainId !== undefined) set.domainId = info.domainId;
    if (info?.scopedId !== undefined) set.scopedId = info.scopedId;
    if (info?.serializedUser) set.serializedUser = info.serializedUser;

    const update: Record<string, any> = {
        $setOnInsert: {
            keys: [userKey],
            primaryKey: userKey,
            firstSeen: now,
            created: now,
            ...(globalUserId !== null ? { globalUserId } : {}),
        },
        $set: set,
    };

    try {
        return await readminCollections.user_identity.findOneAndUpdate(
            { keys: userKey },
            update,
            { upsert: true, returnDocument: 'after' },
        );
    } catch (e: any) {
        // Two concurrent joins can race the upsert; the unique index on keys
        // rejects the loser. The winner's document is what we want.
        if (e?.code === 11000) {
            return resolveUserIdentity(userKey);
        }
        throw e;
    }
}

/**
 * Whether a person's identity has been verified across more than the single
 * game they were first seen in. This is the legibility signal for hiring: an
 * applicant with `verified: false` is presenting an unlinked, single-domain
 * identity — which after the scoped-ID rollout is the same shape a fresh
 * anonymous account has — so its absence reads as a risk signal rather than a
 * silent gap. Resolve by the applicant's panel/global key or any in-game key.
 */
export type IdentityVerification = {
    verified: boolean;
    /** Distinct identity keys linked to this person (1 = never linked). */
    linkedKeys: number;
    /** True once a global/OAuth anchor is known (panel login or a legacy ID). */
    hasGlobalAnchor: boolean;
    globalUserId?: number;
};

export async function getIdentityVerification(userKey: string): Promise<IdentityVerification> {
    const key = canonicalUserKey(userKey);
    const direct = legacyUserIdFromKey(key);
    const identity = await resolveUserIdentity(key);

    const linkedKeys = identity?.keys.length ?? 1;
    const globalUserId = direct ?? identity?.globalUserId;
    const hasGlobalAnchor = globalUserId !== undefined && globalUserId !== null;
    return {
        // "Verified" = we can tie this in-game identity to something outside the
        // one game: either a linked second key, or a confirmed global anchor.
        verified: linkedKeys > 1 || hasGlobalAnchor,
        linkedKeys,
        hasGlobalAnchor,
        globalUserId: hasGlobalAnchor ? globalUserId! : undefined,
    };
}

/**
 * GDPR-removal must follow a person across their linked keys: a removed user
 * rejoining under a *scoped* key (whose bare value the flat ignore list never
 * contained) still has to be ignored. Resolves the identity and checks every
 * linked key plus the global ID against the removal list.
 */
export async function isUserKeyGDPRIgnored(userKey: string): Promise<boolean> {
    const key = canonicalUserKey(userKey);
    const identity = await resolveUserIdentity(key);
    const candidateKeys = new Set<string>([key, ...(identity?.keys ?? [])]);
    const globalUserId = legacyUserIdFromKey(key) ?? identity?.globalUserId ?? null;
    if (globalUserId !== null) {
        candidateKeys.add(String(globalUserId));
    }
    const numericIds = [...candidateKeys]
        .map((k) => (isLegacyUserKey(k) ? parseInt(k, 10) : null))
        .filter((n): n is number => n !== null);
    if (numericIds.length === 0) {
        return false;
    }
    const hit = await readminCollections.gdpr_removed_user.findOne({ robloxId: { $in: numericIds } });
    return !!hit;
}

/**
 * Declare that two keys belong to the same person (consent-driven — e.g. the
 * Roblox User Account Linking API, or a verified claim in our own UI). Merges
 * the two identity documents; historical activity records are untouched and
 * resolve to the merged person at read time.
 */
export async function linkUserIdentities(userKeyA: string, userKeyB: string): Promise<MongoTypes.UserIdentity | null> {
    const keyA = canonicalUserKey(userKeyA);
    const keyB = canonicalUserKey(userKeyB);
    if (keyA === keyB) {
        return ensureUserIdentity(keyA);
    }

    const [identityA, identityB] = await Promise.all([
        ensureUserIdentity(keyA),
        ensureUserIdentity(keyB),
    ]);
    if (!identityA || !identityB) {
        return identityA ?? identityB;
    }
    if (identityA._id!.equals(identityB._id!)) {
        return identityA;
    }

    // Keep the older document so primaryKey (and anything externally holding
    // the identity _id) stays stable; fold the newer one into it.
    const [keep, fold] = identityA.created <= identityB.created
        ? [identityA, identityB]
        : [identityB, identityA];

    // The unique index on `keys` forbids a key existing in two documents, so
    // fold must be deleted before its keys move. A crash between the two ops
    // orphans fold's keys; the next join under one simply re-creates a fresh
    // (unlinked) identity — the link is lost, never the activity data.
    await readminCollections.user_identity.deleteOne({ _id: fold._id });
    return readminCollections.user_identity.findOneAndUpdate(
        { _id: keep._id },
        {
            $addToSet: { keys: { $each: fold.keys } },
            $set: {
                updated: new Date(),
                lastSeen: keep.lastSeen >= fold.lastSeen ? keep.lastSeen : fold.lastSeen,
                firstSeen: keep.firstSeen <= fold.firstSeen ? keep.firstSeen : fold.firstSeen,
                ...(keep.globalUserId === undefined && fold.globalUserId !== undefined
                    ? { globalUserId: fold.globalUserId }
                    : {}),
                ...(fold.updated > keep.updated && fold.username ? { username: fold.username } : {}),
                ...(fold.updated > keep.updated && fold.displayName ? { displayName: fold.displayName } : {}),
            },
        },
        { returnDocument: 'after' },
    );
}
