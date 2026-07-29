import { InteractionContextType, SlashCommandBuilder } from "discord.js";

export const rankCommand =
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Rank a group member if you have workspace permissions')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName('roblox-name')
                .setDescription('The Roblox username of who you want to rank')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('roleset')
                .setDescription('The rank you want to role the user to')
                .setRequired(true)
                .setAutocomplete(true)
        );