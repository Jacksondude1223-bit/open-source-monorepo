import { SlashCommandBuilder } from "discord.js";

export const workspacesCommand =
    new SlashCommandBuilder()
        .setName('workspaces')
        .setDescription('Allows support agents to perform workspace related commands')
        .addSubcommandGroup(subcommand =>
            subcommand
                .setName('sync')
                .setDescription('Allows the support agent to re-sync the workspace')
                .addSubcommand(sub =>
                    sub
                        .setName('roles')
                        .setDescription('Syncs group roles')
                        .addIntegerOption(option =>
                            option.setName('groupid')
                                .setDescription('The group ID you want to sync')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('members')
                        .setDescription('Syncs group members')
                        .addIntegerOption(option =>
                            option.setName('groupid')
                                .setDescription('The group ID you want to sync')
                                .setRequired(true)
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists the workspaces the user is in')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('exit')
                .setDescription('Exits a workspace')
                .addIntegerOption(option =>
                    option.setName('groupid')
                        .setDescription('The group ID you want to exit')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('New join option')
                .addIntegerOption(option =>
                    option.setName('groupid')
                        .setDescription('The group ID you want to join')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('New leave option')
                .addIntegerOption(option =>
                    option.setName('groupid')
                        .setDescription('The group ID you want to leave')
                        .setRequired(false)
                )
        );