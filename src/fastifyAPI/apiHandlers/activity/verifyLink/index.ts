import { FastifyRequest, FastifyReply } from 'fastify';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { canonicalUserKey } from '~/services/userIdentity.service';
import { redeemLinkCode } from '~/services/userLinkCode.service';

/**
 * In-game redemption of a panel-issued link code. The player runs `/verify
 * <code>`; the game server submits the code together with its own view of the
 * player's userKey (which may be domain-scoped). On success the player's
 * in-game identity is merged onto the panel identity that minted the code, so
 * their activity across this game stitches to their panel/global identity
 * retroactively. See userLinkCode.service.ts.
 */
export const verifyLink = async (req: FastifyRequest<{
    Body: { gameId: string; code: string; playerId?: string; userKey?: string };
}>, res: FastifyReply) => {
    const { runningGame } = req;
    const { code } = req.body;

    try {
        const userKey = canonicalUserKey(req.body.userKey ?? req.body.playerId ?? '');
        if (!code || !userKey) {
            return res.status(400).send({ success: false, error: 'Missing code or player' });
        }

        const result = await redeemLinkCode(code, userKey, runningGame.internalGameId);
        if (!result.ok) {
            // A bad/expired/used code is an expected outcome, not a server error —
            // return 200 so the game surfaces the reason to the player directly.
            return res.send({ success: false, reason: result.reason });
        }

        return res.send({ success: true, linkedTo: result.username });
    } catch (e) {
        console.error('Verify Link Error', e);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Verify Link Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
