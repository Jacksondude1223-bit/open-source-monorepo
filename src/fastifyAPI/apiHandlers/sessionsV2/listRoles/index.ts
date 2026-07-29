import { FastifyRequest, FastifyReply } from 'fastify';
import { readminCollections } from '~/services/mongo.service';

// GET /sessions/v2/roles
// Returns the workspace's role groups in a clean, predictable shape. Each group
// contains its claimable subroles with their constraints.
export const listRoles = async (req: FastifyRequest, res: FastifyReply) => {
    const { workspace } = req;

    try {
        const roleGroups = await readminCollections.session_roles
            .find({ groupId: workspace.groupId }, { sort: { created: 1 } })
            .toArray();

        const data = roleGroups.map((group) => ({
            id: group.id,
            name: group.name,
            roles: group.roles.map((role) => ({
                id: role.id,
                name: role.name,
                maxUsers: role.maxUsers,
                minRank: role.minRank,
                claimOnce: role.claimOnce,
            })),
            created: group.created,
        }));

        return res.send({ success: true, data });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
