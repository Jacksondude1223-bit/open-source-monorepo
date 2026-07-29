import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';


export const getUserMinutes = async (req: FastifyRequest<{
    Params: { path: { userId: string; } };
}>, res: FastifyReply) => {
    const params = req.params;
    const workspace = req.workspace;
    const userId = params.path.userId;

    if ('reason' in workspace) {
        return res.status(401).send({
            success: false,
            reason: workspace.reason
        })
    }

    if (!userId) {
        return res.status(401).send({
            success: false,
            reason: "User ID was not provided",
        });
    }

    try {
        const distribution = await readminCollections.distribution.findOne({
            groupId: workspace.groupId,
            isCurrent: true,

        })
        const summary = await readminCollections.user_game_session_distribution_summary.findOne({
            groupId: workspace.groupId,
            distribution: distribution?.num.toString(),
            userId

        })
        const staffMembers = await readminCollections.group_member.find({
            groupId: workspace.groupId,
            rankId: { $gte: workspace.minSyncRole },
        }, { projection: { userId: 1 } }).toArray();
        const staffUserIds = staffMembers.map((member) => member.userId.toString());
        const leaderboard = await (await readminCollections.user_game_session_distribution_summary.find({
            groupId: workspace.groupId,
            distribution: distribution?.num.toString(),
            userId: { $in: staffUserIds },
            'minutes.total': { $gt: summary?.minutes.total }
        })).toArray()

        return res.send({ success: true, workspace_position: leaderboard.length + 1, summary })
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }
};