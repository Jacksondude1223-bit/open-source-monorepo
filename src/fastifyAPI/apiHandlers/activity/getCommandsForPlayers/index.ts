import { readminCollections } from '~/services/mongo.service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { getDepartmentForUserId } from '~/services/workspaces.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { memberRankIds } from '~/services/groupMember.helpers';
import { departmentScopeIds } from '~/services/departmentPermissions.service';

export const getCommandsForPlayers = async (req: FastifyRequest<{
    Querystring: { playerIds: string; };
}>, res: FastifyReply) => {
    const queryStringParameters = req.query;

    const { workspace, runningGame } = req;
    const groupId = workspace.groupId;
    const { playerIds } = queryStringParameters;

    try {
        const { gameId, placeId } = runningGame;
        const foundCommands = await readminCollections.game_command.find({ groupId, gameId, placeId }).toArray();

        const permissions: { [userId: string]: { [commandId: string]: boolean; } } = {};

        // /verify (self-service identity linking) is being dogfooded — restrict
        // it to site-role Founders so regular players don't see or use it yet.
        // When it ships, drop this lookup and grant it to everyone instead.
        const idList = playerIds.split(',');
        const founderUsers = await readminCollections.user.find({
            robloxId: { $in: idList },
            role: 'Founder',
        }).toArray();
        const founderIds = new Set(founderUsers.map(u => u.robloxId.toString()));

        for (const userId of idList) {
            permissions[userId] = {};
            permissions[userId]['readmin_verify'] = founderIds.has(userId);
            const groupMember = await readminCollections.group_member.findOne({ groupId, userId: parseInt(userId) });
            const department = groupMember ? await getDepartmentForUserId(userId, groupId) : null;
            // Exact-membership tests, so they need every rank/department the
            // member holds — unlike the `>= minSyncRole` threshold checks
            // elsewhere, which stay correct against the derived highest scalar.
            const memberRanks = groupMember ? memberRankIds(groupMember).map(r => r.toString()) : [];
            const memberDepartmentScope = departmentScopeIds(department).map(id => id.toString());
            for (const command of foundCommands) {
                const perms = command.permissions;
                permissions[userId][command.id] = false;
                if (!command.enabled) {
                    continue;
                }
                if (perms.usableByUsers.includes(userId)) {
                    permissions[userId][command.id] = true;
                    continue;
                }
                if (memberRanks.some(rank => perms.usableByGroupRole.includes(rank))) {
                    permissions[userId][command.id] = true;
                    continue;
                }
                if (perms.usableByDepartments.length == 0) {
                    continue; // Skip just because I want to bypass the owner check.
                }
                const allowedDepartments = perms.usableByDepartments.map(a => a.toString());
                if (memberDepartmentScope.some(id => allowedDepartments.includes(id)) || department?.isOwner) {
                    permissions[userId][command.id] = true;
                    continue;
                }

            }
        }

        return res.send({ success: true, permissions })


    } catch (e) {
        console.error(e);
        sendReAdminInternalWebhookMessage('gameErrors', 'red', 'Send Command Error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).send({ success: false, reason: 'Internal server error' })
    }

};