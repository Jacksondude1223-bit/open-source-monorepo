import * as GroupActionsService from '~/services/group-actions.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export const shout = async (req: FastifyRequest<{
    Body: { message: string }
}>, res: FastifyReply) => {
    const { body } = req;
    const { RankingKey, GroupRoles, RobloxBot } = req;

    if (!RankingKey.enableShouting) {
        return res.status(401).send({
            success: false,
            reason: 'Shout management is not enabled for this key.'
        })
    }

    const message = body.message;
    if (!message) {
        return res.status(400).send({
            success: false,
            reason: 'Missing message'
        })
    }

    const action = await GroupActionsService.shout('group', RankingKey.groupId, RankingKey.groupId, message, 'ranking-api', {
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
            message: 'Shout has been posted'
        })
    }

    return res.status(500).send({
        success: false,
        reason: action
    })
};