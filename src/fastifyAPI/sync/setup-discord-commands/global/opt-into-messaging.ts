import { SlashCommandBuilder } from "discord.js";

export const optIntoMessagingCommand =
    new SlashCommandBuilder()
        .setName('opt-into-messaging')
        .setDescription('Disable or enable automated messages from ReAdmin panel')
        .addBooleanOption(option =>
            option.setName('opt-in')
                .setDescription('Opt in or out of messaging')
                .setRequired(true)
        )