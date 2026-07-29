import { SlashCommandBuilder } from "discord.js";

export const closeRateCommand =
    new SlashCommandBuilder()
        .setName('close_rate')
        .setDescription('Closes a ticket and asks the user for a rating')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for closing the ticket')
                .setRequired(true)
        )