import { FastifyRequest, FastifyReply } from 'fastify';
import { syncUserInfoOnDemand } from '~/fastifyAPI/sync/sync-user-info';

/**
 * On-demand refresh of a single Roblox user's cached info (name / displayName /
 * thumbnail). Workspace-scoped via the `loader-id` header. Rate-limited to once per
 * hour per user by syncUserInfoOnDemand's cooldown (returns 429 while cooling down).
 */
export const syncUser = async (req: FastifyRequest<{
    Params: { userId: string };
}>, res: FastifyReply) => {
    const { userId } = req.params;

    const numericUserId = parseInt(userId);
    if (!userId || Number.isNaN(numericUserId) || numericUserId <= 0) {
        return res.status(400).send({ success: false, reason: 'A valid numeric userId is required.' });
    }

    const result = await syncUserInfoOnDemand(numericUserId);

    switch (result.status) {
        case 'synced':
            return res.send({ success: true, status: 'synced', lastUpdated: result.lastUpdated });
        case 'cooldown':
            return res.status(429)
                .header('Retry-After', result.retryAfterSeconds)
                .send({
                    success: false,
                    status: 'cooldown',
                    reason: 'This user was synced recently. Try again later.',
                    retryAfterSeconds: result.retryAfterSeconds,
                    lastUpdated: result.lastUpdated,
                });
        case 'no_oauth':
            return res.status(409).send({ success: false, status: 'no_oauth', reason: 'No OAuth-linked workspace is available to sync this user.' });
        default:
            return res.status(500).send({ success: false, status: 'error', reason: 'Failed to sync user.' });
    }
};
