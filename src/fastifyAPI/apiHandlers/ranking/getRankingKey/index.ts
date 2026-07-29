import { GroupRole } from '~/services/types/roblox.types';
import { FastifyRequest, FastifyReply } from 'fastify';

export const getRankingKey = async (req: FastifyRequest<{
}>, res: FastifyReply) => {
    const { RankingKey, GroupRoles, RobloxBot } = req;

    return res.send({
        success: true,
        keyInfo: {
            ...RankingKey, key: false, allowedRanks: RankingKey.allowedRanks.map(roleId => {
                const rank = GroupRoles?.find(role => role.id == roleId) as GroupRole;
                return { name: rank.name, apiId: rank.rank, rank: rank.rank, id: rank.id }
            })
        },
    })
};