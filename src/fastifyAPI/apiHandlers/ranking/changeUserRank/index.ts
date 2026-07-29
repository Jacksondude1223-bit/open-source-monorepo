import { readminCollections } from '~/services/mongo.service';
import * as RobloxService from '~/services/roblox.service';
import * as GroupActionsService from '~/services/group-actions.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';

export const changeUserRank = async (req: FastifyRequest<{
    Headers: { ["api-key"]: string }
    Params: { rankId: string; userId: string; }
    Body: {}
}>, res: FastifyReply) => {
    const { params: pathParameters } = req;
    const { RankingKey, GroupRoles, RobloxBot } = req;

    const rankId = pathParameters.rankId;
    if (!rankId) {
        return res.status(400).send({
            success: false,
            reason: 'Missing rankId'
        })
    }
    if (!RankingKey.rankingEnabled) {
        return res.status(401).send({
            success: false,
            reason: 'Ranking is not enabled for this key.'
        })
    }
    const foundRank = await readminCollections.group_role.findOne({
        groupId: RankingKey.groupId,
        $or: [
            { id: parseInt(rankId) },
            { rank: parseInt(rankId) }
        ]

    });
    if (!foundRank) {
        return res.status(404).send({
            success: false,
            reason: 'Rank not found.'
        })
    }
    if (!RankingKey.allowedRanks.includes(foundRank.id)) {
        return res.status(401).send({
            success: false,
            reason: 'Rank is not allowed to be ranked to for this key.'
        })
    }

    const userId = pathParameters.userId;
    if (await isUserGDPRIgnored(userId)) {
        return res.status(200).send({
            success: false,
            reason: 'User is GDPR ignored'
        });
    }
    if (!userId) {
        return res.status(400).send({
            success: false,
            reason: 'Missing userId'
        })
    }

    const foundRobloxUser = await RobloxService.getUserInfo(userId);
    if (!foundRobloxUser) {
        return res.status(400).send({
            success: false,
            reason: 'User not found.'
        })
    }


    const action = await GroupActionsService.rankUser('group', RankingKey.groupId, RankingKey.groupId, userId, foundRank.id, 'ranking-api', {
        rankingKeyId: RankingKey.id,
    });

    if (action == 'loggedOut') {
        return res.status(500).send({
            success: false,
            reason: 'Bot is logged out, action has been marked as failed.'
        })
    }
    if (action == true) {
        return res.send({
            success: true,
            message: 'Ranking request completed.'
        })
    }

    return res.status(500).send({
        success: false,
        reason: action
    })
};