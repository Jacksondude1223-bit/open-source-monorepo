import { env } from "~/services/env";
import proxyFetch from "../utils/proxyFetch";

export interface BloxlinkUser {
    discordID: string;
    robloxID: string;
    resolved?: {
        discord?: {
            id: string;
            username: string;
            discriminator: string;
            avatar?: string;
        };
        roblox?: {
            id: string;
            username: string;
            displayName?: string;
            avatar?: string;
        };
    };
}

export async function getRobloxIdFromDiscordId(discordId: string): Promise<string | undefined> {
    try {
        const robloxAccount = await proxyFetch(`https://api.blox.link/v4/public/discord-to-roblox/${discordId}`, {
            headers: { "Authorization": env.BLOXLINK_TOKEN }
        });

        if (!robloxAccount.ok) {
            throw new Error(`Bloxlink API error: ${robloxAccount.status}`);
        }

        const robloxAccountResponse = await robloxAccount.json() as { robloxID?: string };
        return robloxAccountResponse.robloxID;
    } catch (error) {
        console.error('Error fetching Roblox ID from Discord ID:', error);
        return undefined;
    }
}