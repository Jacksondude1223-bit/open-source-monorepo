import { InteractionContextType, SlashCommandBuilder } from "discord.js";

export const replyCommand =
    new SlashCommandBuilder()
        .setName('reply')
        .setDescription('Reply to the user in a ReAdmin support call channel')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send to the user in-game')
                .setRequired(true)
        );
