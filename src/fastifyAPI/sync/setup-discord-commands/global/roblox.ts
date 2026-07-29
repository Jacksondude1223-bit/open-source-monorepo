import { InteractionContextType, SlashCommandBuilder } from "discord.js";

export const robloxCommand =
    new SlashCommandBuilder()
        .setName('roblox')
        .setDescription('ReAdmin integrations')
        .setDMPermission(true)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(subcommand =>
            subcommand.setName('activity')
                .setDescription('Get your activity')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('punishments')
                .setDescription('Get your punishments')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('workspace')
                .setDescription('Get information about your workspace')
        );