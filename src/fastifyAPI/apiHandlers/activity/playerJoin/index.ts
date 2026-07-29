import { FastifyRequest, FastifyReply } from 'fastify';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';
import { canonicalUserKey, isUserKeyGDPRIgnored } from '~/services/userIdentity.service';
import { ActivityJoinBody, resolveJoinContext, startTrackingSession } from '~/services/activityTracking.service';
import { getTrackingConsentStatus } from '~/services/trackingConsent.service';

export type playerSessionIds = {
    runningGamePlayer: string;
    userGameSession: string;
}

export const playerJoin = async (req: FastifyRequest<{
    // userKey/displayName/thumbnailUrl/groupRank/domain are sent by updated game
    // modules; older deployed loaders send only playerId. The response now also
    // carries `tracked` (and `consent` when privacy mode is on) — older modules
    // ignore these and behave as before, since the privacy flags default off.
    Body: ActivityJoinBody & { gameId: string };
}>, res: FastifyReply) => {
    const joinDate = new Date();
    const body = req.body;
    const { workspace, runningGame } = req;

    try {
        const userKey = canonicalUserKey(body.userKey ?? body.playerId);

        // Honour GDPR removal across linked keys (global ignore list).
        if (await isUserGDPRIgnored(userKey) || await isUserKeyGDPRIgnored(userKey)) {
            return res.status(200).send({
                success: true,
                banned: false,
                isStaff: false,
                tracked: false,
                sessionId: "GDPR_IGNORED",
                runningPlayerId: "GDPR_IGNORED",
            });
        }

        const { groupId } = workspace;
        const ctx = await resolveJoinContext(workspace, body);

        // Permanent opt-out — set when an admin fulfils a data-deletion request.
        // Honoured on every join regardless of privacy settings, like a GDPR
        // ignore: the player is never tracked again.
        const consentStatus = await getTrackingConsentStatus(groupId, userKey);
        if (consentStatus === 'denied') {
            return res.send({ success: true, tracked: false, isStaff: ctx.isStaff, consent: 'denied' });
        }

        // ── Privacy mode (Roblox scoped-ID rollout) ─────────────────────────
        // Both flags default OFF, so when unset this whole block is skipped and
        // the default path (always track) runs exactly as before.
        const privacy = workspace.privacySettings || {};

        // Staff-only mode: non-staff are never tracked (no session, no prompt).
        if (privacy.trackStaffOnly && !ctx.isStaff) {
            // Still report a ban so the game kicks.
            return res.send({
                success: true,
                tracked: false,
                isStaff: false,
                banned: !!ctx.ban,
                ...(ctx.ban ? { reason: ctx.ban.reason } : {}),
            });
        }

        // Consent governs RETENTION, not collection: we track from join either
        // way. `needsConsent` tells the game to show the in-game prompt — if the
        // player doesn't grant, the session is deleted when they leave (see the
        // leave handlers) and they're prompted again next visit.
        const needsConsent = !!privacy.requireConsent && consentStatus !== 'granted';

        const { sessionId, runningPlayerId } = await startTrackingSession(workspace, runningGame, body, ctx, joinDate);

        return res.send(ctx.ban
            ? { success: true, tracked: true, needsConsent, banned: true, reason: ctx.ban.reason, isStaff: ctx.isStaff, expiration: ctx.ban.expires ? ctx.ban.expires.toLocaleString() : 'never', sessionId, runningPlayerId }
            : { success: true, tracked: true, needsConsent, banned: false, isStaff: ctx.isStaff, sessionId, runningPlayerId });

    } catch (e) {
        console.error('Player Join Error', e);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Player Join Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'internal server errro' });
    }
};
