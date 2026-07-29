import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Returns a staff member's activity for the workspace: their distribution summary
// (minutes / goals) for the current distribution plus their most recent game
// sessions. Pass ?limit= to control how many recent sessions are returned (max 50).
export const getUserActivity = async (req: FastifyRequest<{
    Params: { userId: string };
    Querystring: { limit?: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query?.limit || '20') || 20, 50);

    if (!userId) {
        return res.status(400).send({ success: false, reason: 'User ID was not provided' });
    }

    const numericGroupId = parseInt(workspace.groupId);
    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
        return res.status(400).send({ success: false, reason: 'User ID must be a Roblox id' });
    }

    try {
        const distribution = await readminCollections.distribution.findOne({
            groupId: workspace.groupId,
            isCurrent: true,
        }, { sort: { created: -1 } });

        const [summary, sessions] = await Promise.all([
            readminCollections.user_game_session_distribution_summary.findOne({
                groupId: workspace.groupId,
                distribution: distribution?.num.toString(),
                userId,
            }),
            readminCollections.user_game_session.find({
                groupId: numericGroupId,
                userId: numericUserId,
                ...(distribution ? { distribution: distribution.num } : {}),
            }, { sort: { created: -1 }, limit }).toArray(),
        ]);

        return res.send({ success: true, summary, sessions });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
