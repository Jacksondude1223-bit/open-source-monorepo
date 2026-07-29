import * as GroupActionsService from '~/services/group-actions.service';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getJoinRequests = async (req: FastifyRequest<{
    Querystring: { cursor?: string; }
}>, res: FastifyReply) => {
    const { query: queryStringParameters } = req;
    const { RankingKey, GroupRoles, RobloxBot } = req;

    if (!RankingKey.enableJoinRequestManagement) {
        return res.status(401).send({
            success: false,
            reason: 'Join Request management is not enabled for this key.'
        })
    }
    const action = await GroupActionsService.getJoinRequests('group', RankingKey.groupId, RankingKey.groupId, queryStringParameters?.cursor || '');
    return res.send(action);
};