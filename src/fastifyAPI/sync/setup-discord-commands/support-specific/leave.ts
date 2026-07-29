import { SlashCommandBuilder } from "discord.js";

export const leaveCommand =
    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Allows the support agent to leave the ticket')