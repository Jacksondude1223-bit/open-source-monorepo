import { env } from "~/services/env";
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createHash } from 'crypto';
import { readminCollections } from '~/services/mongo.service';
import { gameCommand } from "./global/game";
import { optIntoMessagingCommand } from "./global/opt-into-messaging";
import { robloxCommand } from "./global/roblox";
import { replyCommand } from "./global/reply";
import { claimCommand } from "./support-specific/claim";
import { closeCommand } from "./support-specific/close";
import { closeRateCommand } from "./support-specific/closeRate";
import { joinCommand } from "./support-specific/join";
import { leaveCommand } from "./support-specific/leave";
import { workspacesCommand } from "./support-specific/workspaces";
import { rankCommand } from "./global/rank";

const rest = new REST().setToken(env.DISCORD_TOKEN);

const globalCommands = [
    gameCommand.toJSON(),
    optIntoMessagingCommand.toJSON(),
    // pingCommand.toJSON(),
    rankCommand.toJSON(),
    robloxCommand.toJSON(),
    replyCommand.toJSON(),
];

const supportCommands = [
    claimCommand.toJSON(),
    closeCommand.toJSON(),
    closeRateCommand.toJSON(),
    joinCommand.toJSON(),
    leaveCommand.toJSON(),
    workspacesCommand.toJSON()
]

export const READMiN_GUILD_ID = env.DISCORD_CLIENT_ID == '1124803971937214694' /* dev bot */ ? '1081082952328425543' /* dev */ : '845829826626584606';

// Only push commands to Discord when the command definitions actually changed
// for this bot/env. We hash the serialized command bodies and store the hash in
// `discord_command_sync` keyed by client id; if it matches, we skip the PUTs.
// Pass `force` to bypass the cache (e.g. manual re-sync).
export default async function setupDiscordCommands(force = false) {
    const hash = createHash('sha256')
        .update(JSON.stringify({ global: globalCommands, support: supportCommands, guild: READMiN_GUILD_ID }))
        .digest('hex');

    const clientId = env.DISCORD_CLIENT_ID;

    if (!force) {
        const existing = await readminCollections.discord_command_sync.findOne({ clientId });
        if (existing?.hash === hash) {
            console.log(`Discord commands unchanged for ${clientId}, skipping sync.`);
            return;
        }
    }

    const global = await rest.put(Routes.applicationCommands(clientId), { body: globalCommands })
    console.log('Setup Discord Commands Response:', global);
    const supportSpecific = await rest.put(Routes.applicationGuildCommands(clientId, READMiN_GUILD_ID), { body: supportCommands })
    console.log('Setup Discord Commands Response:', supportSpecific);

    await readminCollections.discord_command_sync.updateOne(
        { clientId },
        { $set: { clientId, hash, updated: new Date() } },
        { upsert: true },
    );
}