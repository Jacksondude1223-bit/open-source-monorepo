import { SlashCommandBuilder } from "discord.js";

export const gameCommand =
    new SlashCommandBuilder().setName('game')
        .setDescription('ReAdmin integrations')
        .setDMPermission(true)
        .addSubcommand(subcommand =>
            subcommand.setName('info')
                .setDescription('Get information about a game')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('Name of the game to look for')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('server')
                .setDescription('Get information about a running server')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('Name of the game to look for')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('The server to look for')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommandGroup(group =>
            group.setName('player')
                .setDescription('Manage players in your game')
                .addSubcommand(subcommand =>
                    subcommand.setName('info')
                        .setDescription('Get player session information')
                        .addStringOption(option =>
                            option.setName('player-name')
                                .setDescription('Name of the player your searcing for')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('kick')
                        .setDescription('Kick user from game')
                        .addStringOption(option =>
                            option.setName('player-name')
                                .setDescription('Name of the player your searcing for')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                        .addStringOption(option =>
                            option.setName('reason')
                                .setDescription('Reason for kicking this user')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('notify')
                        .setDescription('Notify user in game')
                        .addStringOption(option =>
                            option.setName('player-name')
                                .setDescription('Name of the game to look for')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                        .addStringOption(option =>
                            option.setName('message')
                                .setDescription('Message to send to this user')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('ban')
                        .setDescription('Ban user in game')
                        .addStringOption(option =>
                            option.setName('player-name')
                                .setDescription('Name of the player to look for')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                        .addStringOption(option =>
                            option.setName('reason')
                                .setDescription('Reason to ban this user')
                                .setRequired(true)
                        )
                )
        );