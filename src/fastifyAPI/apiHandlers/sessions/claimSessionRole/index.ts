import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { createDiscordEvent, returnDiscordMessageFormatForDate, sendWebhookMessage } from '~/services/discord.service';
import { getUserInfo, getUserThumbnail } from '~/services/roblox.service';
import { addMinutesToDate } from '~/utils/DateUtils';
import fetchImageAsBase64 from '~/utils/fetchImageAsBase64';
import { FastifyRequest, FastifyReply } from 'fastify';

export const claimSessionRole = async (req: FastifyRequest<{
    Params: { sessionId: string; serverId: string }
    Body: { userId: string; roleId: string; subroleId: string }
}>, res: FastifyReply) => {
    const { workspace, body, params: pathParamaters } = req;

    try {

        const sessionId = pathParamaters.sessionId as string;
        const serverId = pathParamaters.serverId as string;

        const { userId, roleId, subroleId } = body;
        if (!userId || !roleId || !subroleId) {
            return res.status(400).send({ success: false, message: 'Invalid request' })
        }

        const groupId = workspace.groupId;

        const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
        if (!session) {
            return res.status(400).send({ success: false, message: 'Session not found' })
        }

        const server = session.servers[serverId];
        if (!server) {
            return res.status(400).send({ success: false, message: 'Server not found' })
        }

        const template = session.template;
        if (!template) {
            return res.status(400).send({ success: false, message: 'Template not found' })
        }

        const role = await readminCollections.session_roles.findOne({ groupId, id: roleId });
        if (!role) {
            return res.status(400).send({ success: false, message: 'Role not found' })
        }

        const subrole = role.roles.find(r => r.id == subroleId);
        if (!subrole) {
            return res.status(400).send({ success: false, message: 'Subrole not found' })
        }


        if (template.createDiscordEvent && session.createdDiscordEvent !== true) {
            const game = await readminCollections.game.findOne({ groupId, placeId: template.placeId })
            const discordIntergration = await readminCollections.discord_bots.findOne({ groupId });
            if (discordIntergration) {
                await createDiscordEvent({
                    guildId: discordIntergration.guildId,
                    name: template.name,
                    location: `https://roblox.com/games/${game?.placeId}/${game?.name.split(' ').join('-')}`,
                    scheduled_start_time: session.date,
                    scheduled_end_time: addMinutesToDate(session.date, template.sessionDuration == 0 ? 60 : template.sessionDuration),
                    entity_type: 3,
                    image: await fetchImageAsBase64(game?.images?.thumbnail || 'https://t3.rbxcdn.com/3a2f877d534961358c99e018f3bdbd4b'),
                    description: template.description
                })
                await readminCollections.session.updateOne({
                    _id: session._id
                },
                    {
                        $set: { createdDiscordEvent: true }
                    });
            }
        }

        await readminCollections.session.updateOne({
            _id: session._id
        }, {
            $addToSet: { claims: userId },
            $set: {
                [`servers.${serverId}.claims.${userId}`]: {
                    claimedRole: subrole.id,
                    claimedBy: userId,
                    claimedAt: new Date(),
                    state: 'none'
                }
            }
        })


        const foundLoggingMechanisms = await readminCollections.discord_logging.find({
            groupId: workspace.groupId,
            event: { $in: ['all', 'session-role-claimed'] }
        }).toArray();

        for (const loggingMechanism of foundLoggingMechanisms) {
            const url = loggingMechanism.webhookUrl;
            const userInfo = await getUserInfo(userId);
            const userThumbnail = await getUserThumbnail(userId);
            await sendWebhookMessage(
                url,
                'blue',
                'Session Role Claimed',
                `**${userInfo?.name || userId}** claimed a role for **${session.template.name}**.`,
                userThumbnail,
                undefined,
                undefined,
                {
                    timestamp: new Date(),
                    footerText: `${session.template.name} • Powered by ReAdmin`,
                    ...(userInfo?.name ? { author: { name: userInfo.name, icon_url: userThumbnail || undefined } } : {}),
                    fields: [
                        { name: 'Role', value: subrole.name || template.name, inline: true },
                        { name: 'Session', value: session.template.name, inline: true },
                        { name: 'Starts', value: returnDiscordMessageFormatForDate(session.date, 'relative_time'), inline: true },
                    ],
                },
            )
        }



        return res.send({ success: true })
    } catch (e) {
        console.error('Get Info Error', e);
        console.error(e);
        console.error('Get Info Error');
        return res.status(500).send({ success: false })
    }
};