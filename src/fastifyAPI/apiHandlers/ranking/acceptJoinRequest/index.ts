import * as RobloxService from '~/services/roblox.service';
import * as GroupActionsService from '~/services/group-actions.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';

export const acceptJoinRequest = async (req: FastifyRequest<{
    Params: { userId: string }
    Body: {}
}>, res: FastifyReply) => {
    const { params: pathParamaters } = req;
    const { RankingKey, GroupRoles, RobloxBot } = req;

    if (!RankingKey.enableJoinRequestManagement) {
        return res.status(401).send({
            success: false,
            reason: 'Join Request management is not enabled for this key.'
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
        return res.status(404).send({
            success: false,
            reason: 'User not found.'
        })
    }


    const action = await GroupActionsService.handleJoinRequest('group', RankingKey.groupId, RankingKey.groupId, userId, true, 'ranking-api', {
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
            message: 'User was accepted into the group'
        })
    }

    return res.status(500).send({
        success: false,
        reason: action
    })
};