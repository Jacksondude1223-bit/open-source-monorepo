import { WithId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { MongoTypes } from '~/services/mongo.service';
import { canonicalUserKey, resolveUserIdentity, legacyUserIdFromKey } from '~/services/userIdentity.service';

/**
 * Per-workspace activity-tracking consent (Roblox scoped-ID privacy mode).
 *
 * Two distinct things share this collection:
 *
 *  - 'granted' — remembered consent. The player opted in; track + keep, and
 *    don't re-prompt on future visits.
 *  - 'denied'  — an explicit, permanent opt-out. Set when an admin fulfils a
 *    data-DELETION request (see workspaceUserData.service.ts). Honoured at EVERY
 *    join regardless of the workspace's requireConsent setting — the player is
 *    never tracked again, like a per-workspace GDPR ignore.
 *
 * A transient in-game DECLINE (the player closes/declines the consent prompt)
 * persists NOTHING here: consent governs retention, so an un-granted visit is
 * simply deleted when the player leaves and they're prompted again next time.
 *
 * All lookups resolve across the player's linked identity keys (a decision under
 * any key applies to all of them).
 */

export type ConsentStatus = 'granted' | 'denied';

function candidateKeysFrom(key: string, identity: MongoTypes.UserIdentity | null): string[] {
    const keys = new Set<string>([key, ...(identity?.keys ?? [])]);
    const globalUserId = legacyUserIdFromKey(key) ?? identity?.globalUserId ?? null;
    if (globalUserId !== null) {
        keys.add(String(globalUserId));
    }
    return [...keys];
}

/**
 * The consent decision for a player in a workspace, resolved across linked keys.
 * Null = no decision (must prompt when requireConsent is on). Pass a
 * pre-resolved identity to avoid a duplicate lookup.
 */
export async function getTrackingConsentStatus(
    groupId: string,
    userKey: string,
    identity?: MongoTypes.UserIdentity | null,
): Promise<ConsentStatus | null> {
    const key = canonicalUserKey(userKey);
    const resolved = identity !== undefined ? identity : await resolveUserIdentity(key);
    const record = await readminCollections.workspace_tracking_consent.findOne({
        groupId,
        userKey: { $in: candidateKeysFrom(key, resolved) },
    });
    return record?.status ?? null;
}

/** True when the player has previously granted tracking consent in this workspace. */
export async function hasTrackingConsent(groupId: string, userKey: string): Promise<boolean> {
    return (await getTrackingConsentStatus(groupId, userKey)) === 'granted';
}

/** True when the player is permanently opted out (e.g. after a data-deletion request). */
export async function isTrackingDenied(groupId: string, userKey: string): Promise<boolean> {
    return (await getTrackingConsentStatus(groupId, userKey)) === 'denied';
}

/** Persist (or update) a consent decision for a player in a workspace. */
export async function setTrackingConsent(
    groupId: string,
    userKey: string,
    status: ConsentStatus,
    internalGameId?: string,
): Promise<void> {
    const key = canonicalUserKey(userKey);
    const now = new Date();
    await readminCollections.workspace_tracking_consent.updateOne(
        { groupId, userKey: key },
        {
            $set: { status, updatedAt: now, ...(internalGameId ? { decidedInGameId: internalGameId } : {}) },
            $setOnInsert: { groupId, userKey: key, decidedAt: now },
        },
        { upsert: true },
    );
}

/** Convenience for the in-game consent grant path. */
export async function recordTrackingConsentGrant(
    groupId: string,
    userKey: string,
    internalGameId?: string,
): Promise<void> {
    await setTrackingConsent(groupId, userKey, 'granted', internalGameId);
}

/**
 * Whether a session for this player should be kept at the end of their visit.
 * False (delete on leave) when they explicitly opted out, or when consent is
 * required and they never granted it. True otherwise.
 */
export async function shouldRetainSession(workspace: WithId<MongoTypes.Workspace>, userKey: string): Promise<boolean> {
    const status = await getTrackingConsentStatus(workspace.groupId, userKey);
    if (status === 'denied') {
        return false;
    }
    if (!workspace.privacySettings?.requireConsent) {
        return true;
    }
    return status === 'granted';
}
