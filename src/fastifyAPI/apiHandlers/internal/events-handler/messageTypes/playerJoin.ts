import { sendWebhookMessage } from "~/services/discord.service";
import { readminCollections } from "~/services/mongo.service";
import * as Roblox from '~/services/roblox.service';

export default async function playerJoinHandler(event: {
    groupId: string;
    userId: string;
    internalGameId: string;
    platform: string;
    safechat: boolean;
    banned: false | string;
}) {

    const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: event.groupId,
        event: { $in: ['all', 'player-join'] }
    }).toArray();

    for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await Roblox.getUserInfo(event.userId);
        const userThumbnail = await Roblox.getUserThumbnail(event.userId);

        if (event.banned) {
            await sendWebhookMessage(url, 'red', 'Banned Player Joined', `${userInfo?.name} has joined the game, but is banned from all games`, userThumbnail);
        } else {
            await sendWebhookMessage(url, 'green', 'Player Joined', `${userInfo?.name} has joined the game`, userThumbnail);
        }
    }

    return true;

}