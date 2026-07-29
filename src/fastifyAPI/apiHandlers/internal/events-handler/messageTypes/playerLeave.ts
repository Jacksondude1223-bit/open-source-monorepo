import { sendWebhookMessage } from "~/services/discord.service";
import { readminCollections } from "~/services/mongo.service";
import * as Roblox from '~/services/roblox.service';

export default async function playerLeaveHandler(event: {
    groupId: string;
    userId: string;
    internalGameId: string;
}) {
    const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: event.groupId,
        event: { $in: ['all', 'player-leave'] }
    }).toArray();

    for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await Roblox.getUserInfo(event.userId);
        const userThumbnail = await Roblox.getUserThumbnail(event.userId);

        await sendWebhookMessage(url, 'red', 'Player Left', `${userInfo?.name} has left the game`, userThumbnail);
    }
}