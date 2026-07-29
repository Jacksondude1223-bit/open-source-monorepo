import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import StringToObjectID from '~/utils/StringToObjectID';

// Returns a single team along with its members (and the team role each holds).
export const getTeam = async (req: FastifyRequest<{
    Params: { teamId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { teamId } = req.params;

    if (!teamId) {
        return res.status(400).send({ success: false, reason: 'Team ID was not provided' });
    }

    try {
        const team = await readminCollections.team.findOne({
            _id: StringToObjectID(teamId),
            groupId: workspace.groupId,
        });

        if (!team) {
            return res.status(404).send({ success: false, reason: 'Team not found' });
        }

        const members = await readminCollections.team_member.find({
            groupId: workspace.groupId,
            teamId: team._id,
        }).toArray();

        const roleById = new Map(team.roles.map((role) => [role.id, role]));
        const resolvedMembers = members.map((member) => ({
            userId: member.userId,
            roleId: member.roleId,
            roleName: roleById.get(member.roleId)?.name || null,
            isLead: roleById.get(member.roleId)?.isLead || false,
            created: member.created,
        }));

        return res.send({ success: true, team, members: resolvedMembers });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
