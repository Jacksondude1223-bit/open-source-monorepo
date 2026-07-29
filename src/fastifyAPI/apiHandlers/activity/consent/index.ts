import { FastifyRequest, FastifyReply } from 'fastify';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { canonicalUserKey } from '~/services/userIdentity.service';
import { recordTrackingConsentGrant } from '~/services/trackingConsent.service';

/**
 * Records a player's in-game activity-tracking consent decision (privacy mode).
 * The game calls this after showing the in-game privacy prompt — never a website
 * (Roblox ToS).
 *
 * The session already exists (created at join — consent governs retention, not
 * collection), so this only persists the outcome:
 *  - granted: remember the grant so the session is kept and future visits track
 *    silently without re-prompting.
 *  - declined: persist nothing. The session is deleted when the player leaves
 *    (see the leave handlers), and they're prompted again next visit.
 */
export const consent = async (req: FastifyRequest<{
    Body: { gameId: string; playerId?: string; userKey?: string; granted: boolean };
}>, res: FastifyReply) => {
    const body = req.body;
    const { workspace, runningGame } = req;

    try {
        if (typeof body.granted !== 'boolean') {
            return res.status(400).send({ success: false, error: 'Missing consent decision' });
        }

        const userKey = canonicalUserKey(body.userKey ?? body.playerId ?? '');
        if (!userKey) {
            return res.status(400).send({ success: false, error: 'Missing player' });
        }

        if (body.granted) {
            await recordTrackingConsentGrant(workspace.groupId, userKey, runningGame.internalGameId);
        }
        // A decline persists nothing — the unretained session is cleaned up on leave.

        return res.send({ success: true, consent: body.granted ? 'granted' : 'declined' });

    } catch (e) {
        console.error('Consent Error', e);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Consent Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
