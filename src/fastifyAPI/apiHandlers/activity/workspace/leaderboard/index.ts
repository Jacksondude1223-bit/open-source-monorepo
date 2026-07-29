import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';


export const getLeaderboard = async (req: FastifyRequest<{
    Body: {};
}>, res: FastifyReply) => {
    const workspace = req.workspace;

    try {
        const distribution = await readminCollections.distribution.findOne({
            groupId: workspace.groupId,
            isCurrent: true,
        })
        const staffMembers = await readminCollections.group_member.find({
            groupId: workspace.groupId,
            rankId: { $gte: workspace.minSyncRole },
        }, { projection: { userId: 1 } }).toArray();
        const staffUserIds = staffMembers.map((member) => member.userId.toString());
        const leaderboard = await readminCollections.user_game_session_distribution_summary.find({
            groupId: workspace.groupId,
            distribution: distribution?.num.toString(),
            userId: { $in: staffUserIds },
        }, {
            limit: 50,
            sort: {
                'minutes.total': -1
            }
        }).toArray();
        return res.send({ success: true, leaderboard })
    } catch (e) {
        return res.status(500).send({ success: false })
    }
};