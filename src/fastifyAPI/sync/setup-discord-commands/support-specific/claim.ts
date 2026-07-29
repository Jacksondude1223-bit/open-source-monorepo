import { SlashCommandBuilder } from "discord.js";

export const claimCommand =
    new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Claims a ticket')