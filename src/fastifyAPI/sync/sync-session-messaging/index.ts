import { dmUserDiscord } from '~/services/discord.service';
import { returnDiscordMessageFormatForDate, sendWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { SessionClaim, SessionClaimV2 } from '~/services/NewMongoTypes/Session.type';

export const syncSessionMessaging = async () => {
    console.log('Perofmring session messaing')
    const sessionsToSend = await readminCollections.session.find({
        notifyTime: { $lte: new Date() },
        endsAt: { $gte: new Date() },
    }).toArray();

    for (const session of sessionsToSend) {

        const sessionStartNotifications = await readminCollections.discord_logging.find({
            groupId: session.groupId,
            event: { $in: ['all', 'session-start'] }
        }).toArray();
        const sessionEndNotifications = await readminCollections.discord_logging.find({
            groupId: session.groupId,
            event: { $in: ['all', 'session-end'] }
        }).toArray();

        const game = await readminCollections.game.findOne({
            groupId: session.groupId,
            placeId: session.template.placeId
        })
        if (game) {
            const gameLink = `https://roblox.com/games/${game?.placeId}/${game?.name.split(' ').join('-')}`;
            const sessionLink = `https://panel.readmin.app/workspaces/${game.groupId}/sessions/session/${session._id.toString()}`;

            if (session.sentDMS == false) {
                await readminCollections.session.updateOne({
                    _id: session._id
                }, {
                    $set: {
                        sentDMS: true
                    }
                })
                for (const claimedUser of session.claims) {
                    const foundServer = Object.keys(session.servers).find(serverId => Object.keys(session.servers[serverId]?.claims || {}).includes(claimedUser))
                    if (foundServer) {
                        const actualServer = session.servers[foundServer];
                        const foundClaim = session.newClaimingSystem ? (actualServer?.claims as SessionClaimV2[]).find(a => a.userId == claimedUser) : (actualServer?.claims as { [userId: string]: SessionClaim })[claimedUser];
                        if (foundClaim) {
                            await dmUserDiscord(claimedUser,
                                `Your session at ${game.name} is about to start!`,
                                `The session starts at ${returnDiscordMessageFormatForDate(session.date, 'short_date/time')}!\nGame Link: ${gameLink}\nSession Link: ${sessionLink}`, 'blue', undefined, { groupId: game.groupId, category: 'sessionReminders', variables: { gameName: game.name, sessionDate: returnDiscordMessageFormatForDate(session.date, 'short_date/time'), gameLink, sessionLink } })

                        }
                    }
                }

            }

            if (!session.sentStartMessage) {
                // if the date that the session starts is greater than or equal to now

                if (session.date <= new Date()) {
                    for (const notification of sessionStartNotifications) {
                        await sendWebhookMessage(notification.webhookUrl, 'green',
                            `Session Started — ${game.name}`,
                            `A session at **${game.name}** is now live. Hop in and get started!`,
                            game?.images?.thumbnail || undefined,
                            sessionLink,
                            undefined,
                            {
                                timestamp: session.date,
                                footerText: `${game.name} • Powered by ReAdmin`,
                                fields: [
                                    { name: 'Started', value: returnDiscordMessageFormatForDate(session.date, 'relative_time'), inline: true },
                                    { name: 'Ends', value: returnDiscordMessageFormatForDate(session.endsAt, 'relative_time'), inline: true },
                                    { name: 'Links', value: `[▶️ Play](${gameLink}) • [📋 Session](${sessionLink})`, inline: false },
                                ],
                            })
                    }
                    await readminCollections.session.updateOne({
                        _id: session._id
                    }, {
                        $set: {
                            sentStartMessage: true
                        }
                    })
                }
            }

            if (!session.sentEndMessage) {
                if (session.endsAt >= new Date()) {
                    for (const notification of sessionEndNotifications) {
                        await sendWebhookMessage(notification.webhookUrl, 'red',
                            `Session Ended — ${game.name}`,
                            `The session at **${game.name}** has wrapped up. Thanks to everyone who attended!`,
                            game?.images?.thumbnail || undefined,
                            sessionLink,
                            undefined,
                            {
                                timestamp: session.endsAt,
                                footerText: `${game.name} • Powered by ReAdmin`,
                                fields: [
                                    { name: 'Ended', value: returnDiscordMessageFormatForDate(session.endsAt, 'relative_time'), inline: true },
                                    { name: 'Links', value: `[▶️ Play](${gameLink}) • [📋 Session](${sessionLink})`, inline: false },
                                ],
                            })
                    }
                    await readminCollections.session.updateOne({
                        _id: session._id
                    }, {
                        $set: {
                            sentEndMessage: true
                        }
                    })
                }
            }

        }
    }

    console.log('Finished messaging')
    return true;
};