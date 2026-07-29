import * as RobloxService from '~/services/roblox.service';
import * as GroupActionsService from '~/services/group-actions.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';

export const exile = async (req: FastifyRequest<{
    Params: { userId: string }
}>, res: FastifyReply) => {
    const { params: pathParamaters } = req;
    const { RankingKey, GroupRoles, RobloxBot } = req;

    if (!RankingKey.enableExile) {
        return res.status(401).send({
            success: false,
            reason: 'Exile users is not enabled for this key.'
        })
    }
    const userId = pathParamaters.userId;
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


    const action = await GroupActionsService.exile('group', RankingKey.groupId, RankingKey.groupId, userId, 'ranking-api', {
        rankingKeyId: RankingKey.id
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
            message: 'User has been exiled.'
        })
    }

    return res.status(500).send({
        success: false,
        reason: action
    })
};