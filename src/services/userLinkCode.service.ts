import { randomInt } from 'crypto';
import { readminCollections } from '~/services/mongo.service';
import { canonicalUserKey, linkUserIdentities } from '~/services/userIdentity.service';

// Excludes 0/O/1/I/L and vowels (no accidental words). 6 chars from this set is
// ~30 bits — ample for codes that live only minutes and are single-use.
const CODE_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return out;
}

export type IssuedLinkCode = { code: string; expiresAt: Date };

/**
 * Mint a fresh link code for a panel identity. Any prior unconsumed code for the
 * same identity is dropped so only one is ever live — a user who re-clicks
 * "generate" invalidates the old code rather than accumulating valid ones.
 */
export async function issueLinkCode(
    identityKey: string,
    info?: { username?: string },
): Promise<IssuedLinkCode> {
    const key = canonicalUserKey(identityKey);
    await readminCollections.user_link_code.deleteMany({ identityKey: key, consumedAt: { $exists: false } });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

    // Retry on the unique-index collision in the vanishingly rare event two live
    // codes generate the same string.
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        try {
            await readminCollections.user_link_code.insertOne({
                code,
                identityKey: key,
                username: info?.username,
                createdAt: now,
                expiresAt,
            });
            return { code, expiresAt };
        } catch (e: any) {
            if (e?.code === 11000) {
                continue;
            }
            throw e;
        }
    }
    throw new Error('Could not allocate a unique link code');
}

export type RedeemResult =
    | { ok: true; identityKey: string; username?: string }
    | { ok: false; reason: 'not_found' | 'expired' | 'already_used' };

/**
 * Redeem a code from in-game. On success, the player's userKey (the game
 * server's view, which may be domain-scoped) is merged onto the panel identity
 * that minted the code. Historical activity records are untouched — they resolve
 * to the merged person at read time.
 */
export async function redeemLinkCode(rawCode: string, redeemingUserKey: string, internalGameId?: string): Promise<RedeemResult> {
    const code = (rawCode || '').trim().toUpperCase();
    const userKey = canonicalUserKey(redeemingUserKey);
    if (!code) {
        return { ok: false, reason: 'not_found' };
    }

    // Atomically claim the code: only an unconsumed, unexpired doc flips to
    // consumed, so two servers racing the same code can't both win.
    const claimed = await readminCollections.user_link_code.findOneAndUpdate(
        { code, consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
        { $set: { consumedAt: new Date(), consumedByKey: userKey, consumedInGameId: internalGameId } },
        { returnDocument: 'after' },
    );

    if (!claimed) {
        // Distinguish the failure so the player gets an actionable message.
        const existing = await readminCollections.user_link_code.findOne({ code });
        if (!existing) {
            return { ok: false, reason: 'not_found' };
        }
        if (existing.consumedAt) {
            return { ok: false, reason: 'already_used' };
        }
        return { ok: false, reason: 'expired' };
    }

    await linkUserIdentities(claimed.identityKey, userKey);
    return { ok: true, identityKey: claimed.identityKey, username: claimed.username };
}
