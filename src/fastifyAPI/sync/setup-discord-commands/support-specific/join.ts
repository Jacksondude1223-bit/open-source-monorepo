import { SlashCommandBuilder } from "discord.js";

export const joinCommand =
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('Allows a support agent to join a ticket')