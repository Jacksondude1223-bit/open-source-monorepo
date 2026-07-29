import { SlashCommandBuilder } from "discord.js";

export const closeCommand =
    new SlashCommandBuilder()
        .setName('close')
        .setDescription('Allows the support agent to close the ticket without prompting the user for a rating')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for closing the ticket')
                .setRequired(true)
        )