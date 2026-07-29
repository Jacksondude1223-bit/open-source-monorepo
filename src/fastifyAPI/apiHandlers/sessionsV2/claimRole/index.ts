import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 } from 'uuid';
import StringToObjectID from '~/utils/StringToObjectID';
import { readminCollections } from '~/services/mongo.service';
import { createDiscordEvent, returnDiscordMessageFormatForDate, sendWebhookMessage } from '~/services/discord.service';
import { getUserInfo, getUserThumbnail } from '~/services/roblox.service';
import { addMinutesToDate } from '~/utils/DateUtils';
import fetchImageAsBase64 from '~/utils/fetchImageAsBase64';
import { buildRoleNameMap, NormalizedClaim } from '~/fastifyAPI/apiHandlers/sessionsV2/_normalize';

// POST /sessions/v2/:sessionId/servers/:serverId/claims
// Claims a role on a session server for a user. The body is flat and explicit:
//   { userId, roleGroupId, roleId }
// where roleGroupId is the role-group id and roleId is the subrole within it.
export const claimRole = async (req: FastifyRequest<{
    Params: { sessionId: string; serverId: string };
    Body: { userId: string; roleGroupId: string; roleId: string };
}>, res: FastifyReply) => {
    const { workspace, body } = req;
    const { sessionId, serverId } = req.params;
    const { userId, roleGroupId, roleId } = body || {};

    if (!userId || !roleGroupId || !roleId) {
        return res.status(400).send({
            success: false,
            reason: 'userId, roleGroupId and roleId are all required',
        });
    }

    let objectId;
    try {
        objectId = StringToObjectID(sessionId);
    } catch {
        return res.status(400).send({ success: false, reason: 'Invalid session ID' });
    }

    const groupId = workspace.groupId;

    try {
        const session = await readminCollections.session.findOne({ groupId, _id: objectId });
        if (!session) {
            return res.status(404).send({ success: false, reason: 'Session not found' });
        }

        const server = session.servers?.[serverId];
        if (!server) {
            return res.status(404).send({ success: false, reason: 'Server not found' });
        }

        const template = session.template;
        if (!template) {
            return res.status(400).send({ success: false, reason: 'Session has no template' });
        }

        const roleGroup = await readminCollections.session_roles.findOne({ groupId, id: roleGroupId });
        if (!roleGroup) {
            return res.status(404).send({ success: false, reason: 'Role group not found' });
        }

        const subrole = roleGroup.roles.find((r) => r.id === roleId);
        if (!subrole) {
            return res.status(404).send({ success: false, reason: 'Role not found' });
        }

        // Lazily create the Discord scheduled event the first time a role is claimed.
        if (template.createDiscordEvent && session.createdDiscordEvent !== true) {
            const game = await readminCollections.game.findOne({ groupId, placeId: template.placeId });
            const discordIntegration = await readminCollections.discord_bots.findOne({ groupId });
            if (discordIntegration) {
                await createDiscordEvent({
                    guildId: discordIntegration.guildId,
                    name: template.name,
                    location: `https://roblox.com/games/${game?.placeId}/${game?.name.split(' ').join('-')}`,
                    scheduled_start_time: session.date,
                    scheduled_end_time: addMinutesToDate(session.date, template.sessionDuration === 0 ? 60 : template.sessionDuration),
                    entity_type: 3,
                    image: await fetchImageAsBase64(game?.images?.thumbnail || 'https://t3.rbxcdn.com/3a2f877d534961358c99e018f3bdbd4b'),
                    description: template.description,
                });
                await readminCollections.session.updateOne(
                    { _id: session._id },
                    { $set: { createdDiscordEvent: true } },
                );
            }
        }

        const claimedAt = new Date();
        const claimId = v4();

        await readminCollections.session.updateOne({ _id: session._id }, {
            $addToSet: { claims: userId },
            $set: {
                [`servers.${serverId}.claims.${userId}`]: {
                    claimedRole: subrole.id,
                    claimedBy: userId,
                    claimedAt,
                    claimId,
                    state: 'none',
                },
            },
        });

        // Fire any configured Discord logging webhooks (best-effort).
        const loggingMechanisms = await readminCollections.discord_logging.find({
            groupId,
            event: { $in: ['all', 'session-role-claimed'] },
        }).toArray();

        for (const mechanism of loggingMechanisms) {
            try {
                const userInfo = await getUserInfo(userId);
                const userThumbnail = await getUserThumbnail(userId);
                await sendWebhookMessage(
                    mechanism.webhookUrl,
                    'blue',
                    'Session Role Claimed',
                    `**${userInfo?.name || userId}** claimed a role for **${template.name}**.`,
                    userThumbnail,
                    undefined,
                    undefined,
                    {
                        timestamp: new Date(),
                        footerText: `${template.name} • Powered by ReAdmin`,
                        ...(userInfo?.name ? { author: { name: userInfo.name, icon_url: userThumbnail || undefined } } : {}),
                        fields: [
                            { name: 'Role', value: subrole.name || template.name, inline: true },
                            { name: 'Session', value: template.name, inline: true },
                            { name: 'Starts', value: returnDiscordMessageFormatForDate(session.date, 'relative_time'), inline: true },
                        ],
                    },
                );
            } catch {
                // Logging failures must never block a claim.
            }
        }

        const roleNameMap = await buildRoleNameMap(groupId);
        const claim: NormalizedClaim = {
            userId,
            roleId: subrole.id,
            roleName: roleNameMap.get(subrole.id) ?? subrole.name,
            state: 'none',
            claimedBy: userId,
            claimedAt,
            claimId,
        };

        return res.status(201).send({ success: true, data: claim });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
