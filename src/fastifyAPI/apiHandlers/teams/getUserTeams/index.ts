import { readminCollections } from '~/services/mongo.service';
import { FastifyRequest, FastifyReply } from 'fastify';

// Returns every team a given user belongs to, including the role they hold on
// each team. Use this to see what team(s) someone is on.
export const getUserTeams = async (req: FastifyRequest<{
    Params: { userId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).send({ success: false, reason: 'User ID was not provided' });
    }

    try {
        const memberships = await readminCollections.team_member.find({
            groupId: workspace.groupId,
            userId,
        }).toArray();

        if (memberships.length === 0) {
            return res.send({ success: true, teams: [] });
        }

        const teams = await readminCollections.team.find({
            groupId: workspace.groupId,
            _id: { $in: memberships.map((m) => m.teamId) },
        }).toArray();

        const teamById = new Map(teams.map((team) => [team._id.toString(), team]));

        const resolved = memberships.map((membership) => {
            const team = teamById.get(membership.teamId.toString());
            const role = team?.roles.find((r) => r.id === membership.roleId);
            return {
                teamId: membership.teamId.toString(),
                teamName: team?.name || null,
                roleId: membership.roleId,
                roleName: role?.name || null,
                isLead: role?.isLead || false,
                created: membership.created,
            };
        });

        return res.send({ success: true, teams: resolved });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
