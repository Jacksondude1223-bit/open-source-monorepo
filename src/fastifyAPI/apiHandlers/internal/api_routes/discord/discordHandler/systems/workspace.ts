import { APIApplicationCommandInteraction, APIInteractionResponse, InteractionResponseType } from "discord-api-types/v10";
import { DiscordBots, Workspace, User } from "~/services/NewMongoTypes";
import { readminCollections } from "~/services/mongo.service";
import { getGroupInfo, getUserInfo } from "~/services/roblox.service";
import { UserWorkspaceResponse, getUserWorkspace } from "~/services/workspaces.service";
import { JWTUser } from "~/services/types/JWT.type";
import { GroupInfoResponse, GroupInfoResponseOC } from "~/services/types/roblox.types";
import { sendFollowupFromCommand } from "~/services/discord.service";
import StringToObjectID from "~/utils/StringToObjectID";

export type WorkspaceDiscordValidationType = [DiscordBots, User, UserWorkspaceResponse, Workspace, GroupInfoResponseOC];

export default async function httpDiscordWorkspaceValidation(guild_id: string, user_id: string, fetchUn = true): Promise<false | WorkspaceDiscordValidationType | 'no-user'> {
  const [foundIntergration, user] = await Promise.all([
    readminCollections.discord_bots.findOne({ guildId: guild_id as string }),
    readminCollections.user.findOne({ discordId: user_id as string }),
  ]);

  if (!foundIntergration) {
    return false;
  }

  const [workspace, groupInfo] = await Promise.all([
    fetchUn ? readminCollections.workspace.findOne({ groupId: foundIntergration.groupId }) : () => { },
    fetchUn ? getGroupInfo(foundIntergration.groupId) : () => { }
  ]);

  if (!user) {
    return 'no-user';
  }

  if (!workspace) {
    return false;
  }

  const userWorkspace = await getUserWorkspace(foundIntergration.groupId, { dbUser: user } as unknown as JWTUser);

  if (!userWorkspace?.department) {
    return false;
  }

  return [foundIntergration, user, userWorkspace, workspace as Workspace, groupInfo as GroupInfoResponseOC];
}

async function httpHandleRobloxCommand(data: APIApplicationCommandInteraction, workspaceInfo: WorkspaceDiscordValidationType) {
  const [foundIntergration, user, userWorkspace, workspace, groupInfo] = workspaceInfo;
  const commandData = data.data as {
    guild_id: string; id: string; name: string; options: [{
      name: 'info' | 'server' | 'kick' | 'notify' | 'ban';
      options: [],
      type: 1,
    }], type: 1
  };
  const type = commandData.options[0].name as 'activity' | 'punishments' | 'workspace';

  if (type == 'activity') {

    const [current_distribution_summary, yearly_summary, activity_goals_call] = await Promise.all([
      readminCollections.user_game_session_distribution_summary.findOne({ groupId: workspace.groupId, userId: user.robloxId, distribution: workspace.currentDistribution.toString() }),
      readminCollections.user_game_session_yearly_summary.findOne({ groupId: workspace.groupId, userId: user.robloxId, year: new Date().getFullYear().toString() }),
      readminCollections.activity_requirements.find({ groupId: workspace.groupId })
    ])
    const activity_goals = await activity_goals_call.toArray();

    if (!current_distribution_summary) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          flags: 64,
          embeds: [
            {
              title: `ReAdmin`,
              description: `You have no activity at **${groupInfo?.displayName}**`,
              color: 0x0891ec,
            },
          ]
        }
      } as APIInteractionResponse
    }

    const keys = Object.keys(current_distribution_summary.goals);
    for (const key of keys) {
      const goalData = current_distribution_summary.goals[key];
      const goal = activity_goals.find(goal => goal._id.toString() == key);
      if (!goal) continue;
      sendFollowupFromCommand(data.application_id, data.token, {
        embeds: [
          {
            title: `ReAdmin - Activity Goal ${goal.name}`,
            description: `Your activity goals`,
            color: 0x0891ec,
            fields: [
              goalData?.minutes ? {
                name: 'Minumum Minutes',
                value: `${goalData?.minutes.metGoal ? '✅' : '❌'} ${goalData?.minutes.at.toLocaleString()}/${goalData?.minutes.goal.toLocaleString()}`
              } : {
                name: 'Minimum Minutes',
                value: 'No goal'
              },
              goalData?.activeMinutes ? {
                name: 'Active Minutes',
                value: `${goalData?.activeMinutes.metGoal ? '✅' : '❌'} ${goalData?.activeMinutes.at.toLocaleString()}/${goalData?.activeMinutes.goal.toLocaleString()}`
              } : {
                name: 'Active Minutes',
                value: 'No goal'
              },
              goalData?.minimumMessages ? {
                name: 'Minimum Messages',
                value: `${goalData?.minimumMessages.metGoal ? '✅' : '❌'} ${goalData?.minimumMessages.at.toLocaleString()}/${goalData?.minimumMessages.goal.toLocaleString()}`
              } : {
                name: 'Minimum Messages',
                value: 'No goal'
              },
              goalData?.minimumSessions ? {
                name: 'Minimum Sessions',
                value: `${goalData?.minimumSessions.metGoal ? '✅' : '❌'} ${goalData?.minimumSessions.at.toLocaleString()}/${goalData?.minimumSessions.goal.toLocaleString()}`
              } : {
                name: 'Minimum Sessions',
                value: 'No goal'
              },
            ]
          },
        ], flags: 64
      })
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: `ReAdmin`,
            description: `Your activity at **${groupInfo?.displayName}**`,
            color: 0x0891ec,
            fields: [
              {
                name: 'Current Distribution',
                value: `Total Minutes: ${current_distribution_summary.minutes.total.toLocaleString()}\nActive Minutes: ${current_distribution_summary.minutes.active.toLocaleString()}\nIdle Minutes: ${current_distribution_summary.minutes.inactive.toLocaleString()}`
              },
              {
                name: 'Yearly Summary',
                value: `Total Minutes: ${yearly_summary?.minutes?.total.toLocaleString() || '0'}\nActive Minutes: ${yearly_summary?.minutes?.active.toLocaleString() || '0'}\nIdle Minutes: ${yearly_summary?.minutes?.inactive.toLocaleString() || '0'}`
              },


            ],
          },
        ]
      }
    };


  }

  if (type == 'punishments') {

    const punishmentsCall = await readminCollections.write_ups.find({ groupId: workspace.groupId, userId: parseInt(user.robloxId) });
    const punishments = await punishmentsCall.toArray();

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: `ReAdmin`,
            description: `Your punishments at **${groupInfo?.displayName}**`,
            color: 0x0891ec,
            fields: await Promise.all(punishments.map(async punishment => {
              const punisher = await readminCollections.user.findOne({ robloxId: punishment.disciplinarianId.toString() })
              return {
                name: `${{ promotion: 'Promotion', writeup: 'Write Up', suspension: 'Suspension', termination: 'Termination', demotion: 'Demotion' }[punishment.type]}: ${punisher?.name} - ${new Date(punishment.created).toLocaleString()}`,
                value: punishment.reason
              }
            }))
          },
        ]
      }
    };

  }

  if (type == 'workspace') {
    const [workspaceOwner, minsyncrole] = await Promise.all([readminCollections.user.findOne({ robloxId: workspace.owner.robloxId }), readminCollections.group_role.findOne({ groupId: workspace.groupId, rank: parseInt(workspace.minSyncRole.toString()) })])

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: `ReAdmin`,
            description: `You are a member of the workspace **${groupInfo?.displayName || foundIntergration.groupId}**`,
            color: 0x0891ec,
            fields: [
              {
                name: 'Your Department',
                value: userWorkspace.department.name,
              },
              {
                name: 'Current Distribution',
                value: workspace.currentDistribution.toLocaleString(),
              },
              {
                name: 'Tracked Staff',
                value: workspace?.trackedStaff?.toLocaleString() || 'Unknown',
              },
              {
                name: 'Minimum Role to Track',
                value: `${minsyncrole?.name} (${minsyncrole?.rank})`
              },
              {
                name: 'Owner',
                value: `${workspaceOwner?.name} (${workspace.owner.robloxId})` || workspace.owner.robloxId
              },
              {
                name: 'Last Synced',
                value: new Date(workspace?.lastSynced || new Date()).toLocaleString()
              },
              {
                name: 'Workspace Created',
                value: new Date(workspace.created).toLocaleString()
              }
            ]
          },
        ]
      }
    } as APIInteractionResponse

  }

}
async function httpHandleGameCommand(data: APIApplicationCommandInteraction, workspaceInfo: WorkspaceDiscordValidationType) {
  const [foundIntergration, user, userWorkspace, workspace, groupInfo] = workspaceInfo;
  const commandData = data.data as {
    guild_id: string;
    id: string;
    name: 'game';
    options: [
      {
        name: 'info';
        options: [{
          name: 'game',
          type: 3,
          value: string;
        }],
        type: 1,
      } | {
        name: 'server';
        options: [{
          name: 'game',
          type: 3,
          value: string;
        }, {
          name: 'server',
          type: 3,
          value: string;
        }],
        type: 1,
      } | {
        name: 'player',
        options: [
          {
            name: 'info'
            options: [
              {
                name: 'player-name',
                type: 3,
                value: string,
              }
            ],
          } | {
            name: 'kick' | 'notify' | 'ban'
            options: [
              {
                name: 'player-name',
                type: 3,
                value: string,
              },
              {
                name: 'reason',
                type: 3,
                value: string,
              }
            ],
          }
        ],
        type: 2,
      }
    ], type: 1
  };
  const subcommandGroup = commandData.options[0].name;
  const type = commandData.options[0].options[0].name as 'info' | 'server' | 'kick' | 'notify' | 'ban';

  if (!userWorkspace.department.permissions.games.view) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: `ReAdmin`,
            description: `You do not have permission to view game information.`,
            color: 0x0891ec,
          },
        ]
      }
    } as APIInteractionResponse
  }
  //@ts-expect-error
  if (subcommandGroup == 'info' && commandData.options[0].options[0].name !== 'player') {
    const gameId = commandData.options[0].options[0].value;
    const foundGame = await readminCollections.game.findOne({
      _id: StringToObjectID(gameId as unknown as string)
    });
    if (!foundGame) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          flags: 64,
          embeds: [
            {
              title: `ReAdmin`,
              description: `This game does not exist.`,
              color: 0x0891ec,
            },
          ]
        }
      } as APIInteractionResponse
    }
    const runningServers = await readminCollections.running_games.find({ gameId: foundGame.gameId, placeId: foundGame.placeId }).toArray();
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: `ReAdmin`,
            description: `Information about game **${foundGame.name}**`,
            color: 0x0891ec,
            fields: [
              {
                name: 'Running Games',
                value: `${runningServers.length} servers with ${runningServers.reduce((accum, current) => {
                  return accum + current.players.length;
                }, 0)} players`
              },
              {
                name: 'Owner',
                value: foundGame?.placeInfo?.builder || ''
              },
              {
                name: 'First Seen',
                value: `${new Date(foundGame.created).toLocaleString()}`
              }
            ],
            image: {
              url: foundGame?.images?.icon
            }
          },
        ]
      }
    } as APIInteractionResponse
  }

  if (subcommandGroup == 'server') {
    const gameId = (commandData.options[0].options[0] as any).value;
    const serverId = commandData.options[0].options[1]?.value;
    const foundGame = await readminCollections.game.findOne({
      groupId: workspace.groupId,
      _id: StringToObjectID(gameId as unknown as string)
    });
    if (!foundGame) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          flags: 64,
          embeds: [
            {
              title: `ReAdmin`,
              description: `This game does not exist.`,
              color: 0x0891ec,
            },
          ]
        }
      } as APIInteractionResponse
    }
    const foundServer = await readminCollections.running_games.findOne({
      groupId: workspace.groupId,
      _id: StringToObjectID(serverId as unknown as string)
    });
    if (!foundServer) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          flags: 64,
          embeds: [
            {
              title: `ReAdmin`,
              description: `This server does not exist.`,
              color: 0x0891ec,
            },
          ]
        }
      } as APIInteractionResponse
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          {
            title: `ReAdmin`,
            description: `Information about running at game **${foundGame.name}**`,
            color: 0x0891ec,
            fields: [
              {
                name: 'Players',
                value: foundServer.players.length.toLocaleString()
              },
              {
                name: 'Place Version',
                value: parseInt(foundServer.placeVersion.toString()).toLocaleString()
              },
              {
                name: 'Personal Server ID',
                value: foundServer.privateServerId == '' ? 'Not a private server' : `${foundServer.privateServerId} owned by ${foundServer.privateServerOwnerId}`
              },
              {
                name: 'Last Pinged',
                value: new Date(foundServer.lastPing).toLocaleString()
              },
              {
                name: 'Started',
                value: new Date(foundServer.created).toLocaleString()
              },
            ],
            image: {
              url: foundGame?.images?.icon
            }
          },
        ]
      }
    } as APIInteractionResponse
  }
  if (subcommandGroup == 'player') {

    const userId = commandData.options[0].options[0].options[0].value as string;
    const runningUser = await readminCollections.running_game_players.findOne({ groupId: workspace.groupId, userId: userId.toString() })
    // Resolve username from roblox_user (canonical source)
    const playerRobloxUser = runningUser ? await getUserInfo(userId) : null;
    const playerUsername = playerRobloxUser?.name || userId;
    if (!runningUser) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          flags: 64,
          embeds: [
            {
              title: `ReAdmin`,
              description: `This user is not in any of your games.`,
              color: 0x0891ec,
            },
          ]
        }
      } as APIInteractionResponse
    }
    if (type == 'info') {
      const userGameSession = await readminCollections.user_game_session.findOne({
        _id: runningUser.userSessionId
      })
      if (!userGameSession) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: 64,
            embeds: [
              {
                title: `ReAdmin`,
                description: `This user is not in any of your games.`,
                color: 0x0891ec,
              },
            ]
          }
        } as APIInteractionResponse
      }
      const game = await readminCollections.game.findOne({
        gameId: userGameSession.gameId,
        placeId: userGameSession.placeId
      })
      if (!game) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: 64,
            embeds: [
              {
                title: `ReAdmin`,
                description: `This user is not in any of your games.`,
                color: 0x0891ec,
              },
            ]
          }
        } as APIInteractionResponse
      }


      const events = await readminCollections.user_game_session_event.find({ userSessionId: userGameSession._id }, { sort: { date: -1 }, limit: 10 }).toArray();

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: `ReAdmin`,
              description: `Information about player **${playerUsername}**`,
              color: 0x0891ec,
              fields: [
                {
                  name: 'Game',
                  value: game.name
                },
                {
                  name: 'Last 10 Events',
                  value: events.map(event => `${{
                    active: 'Player became active',
                    idle: 'Player went idle',
                    message: 'Player wrote ',
                    typing: 'Is typing',
                    join: 'Player joined',
                    leave: 'Player left',
                    log: '',
                    system: ''
                  }[event.type]}${event.type == 'message' ? ` ${event.message}` : ''} ${new Date(event.date).toLocaleTimeString()}`).join('\n')
                },
                {
                  name: 'Joined',
                  value: new Date(userGameSession.created).toLocaleString()
                },
              ],
              image: {
                url: game?.images?.icon
              }
            },
          ]
        }
      } as APIInteractionResponse
    }
    if (type == 'kick') {
      if (!userWorkspace.department.permissions.games.admin) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: 64,
            embeds: [
              {
                title: `ReAdmin`,
                description: `You do not have permission to kick players.`,
                color: 0x0891ec,
              },
            ]
          }
        } as APIInteractionResponse
      }
      const reason = commandData.options[0].options[0].options[1]?.value as string;
      await readminCollections.queued_game_action.insertOne({
        internalGameId: runningUser.internalGameId,
        runningGameId: runningUser.runningGameId,
        type: 'kick',
        userId: userId,
        message: reason,
        created: new Date()
      })
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: `ReAdmin`,
              description: `Kicked ${playerUsername} for: ${reason}`,
              color: 0x0891ec,
            },
          ]
        }
      };
    }
    if (type == 'ban') {
      if (!userWorkspace.department.permissions.games.manageBans) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: 64,
            embeds: [
              {
                title: `ReAdmin`,
                description: `You do not have permission to ban players.`,
                color: 0x0891ec,
              },
            ]
          }
        } as APIInteractionResponse
      }
      const reason = commandData.options[0].options[0].options[1]?.value as string;

      await readminCollections.workspace_bans.insertOne({
        groupId: workspace.groupId,
        userId: userId,
        reason: reason,
        disciplinarianId: user.robloxId as string,
        active: true,
        created: new Date()
      })

      await readminCollections.queued_game_action.insertOne({
        internalGameId: runningUser.internalGameId,
        runningGameId: runningUser.runningGameId,
        type: 'kick',
        userId: userId,
        message: reason,
        created: new Date()
      })
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: `ReAdmin`,
              description: `Banned ${playerUsername} for: ${reason}`,
              color: 0x0891ec,
            },
          ]
        }
      };
    }
    if (type == 'notify') {
      if (!userWorkspace.department.permissions.games.admin) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: 64,
            embeds: [
              {
                title: `ReAdmin`,
                description: `You do not have permission to notify players.`,
                color: 0x0891ec,
              },
            ]
          }
        } as APIInteractionResponse
      }
      //@ts-expect-error this is right
      const message = commandData.options[0].options[0].options[1].value;
      await readminCollections.queued_game_action.insertOne({
        internalGameId: runningUser.internalGameId,
        runningGameId: runningUser.runningGameId,
        type: 'notify',
        userId: userId,
        message: message,
        created: new Date()
      })
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: `ReAdmin`,
              description: `Notified ${playerUsername} with message: ${message}`,
              color: 0x0891ec,
            },
          ]
        }
      };
    }
  }

}

export async function httpHandleWorkspaceCommand(data: APIApplicationCommandInteraction) {
  const workspaceInfo = await httpDiscordWorkspaceValidation(data.guild_id as string, data.member?.user?.id || '', true);
  if (workspaceInfo == 'no-user') return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      flags: 64,
      embeds: [
        {
          title: 'You do not have a linked Discord account on ReAdmin.',
          description: 'We could not find your ReAdmin account. There are a few reasons this is possible: you have an old Discord account that is linked to Bloxlink, you have not linked your Discord account to ReAdmin, or you have not verified with Bloxlink.',
          color: 0x0891ec,
        },
      ]
    }
  } as APIInteractionResponse;
  if (!workspaceInfo) return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      flags: 64,
      embeds: [
        {
          title: 'Could not get workspace data',
          description: 'We can\'t run this command as we couldn\'t find your workspace.',
          color: 0x0891ec,
        },
      ]
    }
  } as APIInteractionResponse;
  const commandData = data.data;
  if (commandData.name == 'roblox') {
    return await httpHandleRobloxCommand(data, workspaceInfo);
  }
  if (commandData.name == 'game') {
    return await httpHandleGameCommand(data, workspaceInfo);
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      flags: 64,
      embeds: [
        {
          title: 'Error',
          description: 'Unknown command',
          color: 0x0891ec,
        },
      ]
    }
  } as APIInteractionResponse
}