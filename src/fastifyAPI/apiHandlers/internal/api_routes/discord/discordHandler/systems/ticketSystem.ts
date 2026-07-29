import { APIApplicationCommandInteraction, APIChatInputApplicationCommandInteractionData, APIInteractionResponse, APIMessageComponentInteraction, APIModalSubmitInteraction, ButtonStyle, ComponentType, InteractionResponseType, ModalSubmitActionRowComponent, TextInputStyle } from "discord-api-types/v10";
import { TicketType } from '~/services/NewMongoTypes/Ticket.type';
import { v4 } from 'uuid';
import { readminCollections } from '~/services/mongo.service';
import { EmebedColors } from "~/services/discord.service";
import { createDiscordChannel, deleteDiscordChannel, sendGuildTextMessage } from '~/services/discord.service';
import { getGroupInfo, getUserInfo } from '~/services/roblox.service';
import { Department, User } from '~/services/NewMongoTypes';
import { getUserWorkspaces } from "~/services/workspaces.service";
import { WORKSPACE_OWNER_PERMISSIONS } from '~/services/constants/WorkspaceOwnerPermissions';
import SyncMembers from "~/fastifyAPI/sync/sync-workspaces/members";
import SyncRoles from "~/fastifyAPI/sync/sync-workspaces/roles";
import { ObjectId } from "mongodb";
import { env } from "~/services/env";

export async function createTicketUsingButtonInteraction(message: APIMessageComponentInteraction) {
  const customId = message.data.custom_id as TicketType;
  const ticketId = v4();

  await readminCollections.ticket.insertOne({
    internalId: ticketId,
    type: customId,
    stage: 'creating',
    discordId: message?.member?.user.id || '',
    agentsInvolved: [],
    reason: '',
    created: new Date()
  })

  return {
    type: InteractionResponseType.Modal,
    data: {
      custom_id: `TICKET-CREATION-${ticketId}`,
      title: 'Ticket Info',
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: 'reason',
              label: `What's the reason for your ticket?`,
              style: TextInputStyle.Paragraph,
            }
          ]
        }
      ]
    }
  } as APIInteractionResponse
}


export async function finishCreatingTicket(message: APIModalSubmitInteraction) {
  const ticketId = message.data.custom_id.split('TICKET-CREATION-')[1];
  const reason = (message.data.components[0] as ModalSubmitActionRowComponent)?.components[0]?.value || 'No reason provided';
  const ticket = await readminCollections.ticket.findOne({ internalId: ticketId });

  if (!ticket) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'Ticket not found',
            color: EmebedColors.blue
          }
        ]
      }
    } as APIInteractionResponse
  }
  const ticketCount = await readminCollections.ticket.countDocuments();
  const channel = await createDiscordChannel(message?.guild_id || '', {
    parent_id: env.DISCORD_CLIENT_ID == '1124803971937214694' /* dev bot [exec server] */ ? '1195207667040391198' /* dev */ : '1124930370522071040' /* prod */, // the categoery id for where tickets should be to handle commands
    name: `${ticket.type}-${ticketCount}`,
    permission_overwrites: [
      {
        type: 1,
        id: ticket.discordId.toString(),
        allow: -2146968512, // Magic number calculated by https://finitereality.github.io/permissions-calculator/?v=-2146968512
      },
      {
        type: 0,
        id: '1119480419147067452', // CS TEAM ROLE id
        allow: -2146968512
      },
      {
        type: 0,
        id: '845829826626584606', // everyone role id
        deny: -2146968512
      },
    ],
  });
  console.log(channel);
  const user = await readminCollections.user.findOne({
    discordId: message?.member?.user.id || ''
  })
  if (channel.id) {
    await sendGuildTextMessage(channel.id, {
      embeds: [
        {
          title: 'ReAdmin Support System',
          description: `<@${message?.member?.user.id}>, your ticket has been created.`,
          fields: [
            {
              name: 'Reference Number',
              value: ticketCount,
            },
            {
              name: 'ReAdmin Account',
              value: user ? `${user.name} - ${user.robloxId} : https://roblox.com/users/${user.robloxId}/profile` : 'No linked account'
            },
            {
              name: 'Inquiry',
              value: reason
            },
            {
              name: 'While you wait..',
              value: 'Please ensure that you send all supporting information so we can better assist you.'
            }
          ],
          footer: { text: 'Please be patient while waiting for support, we will get to you as soon as possible.' },
          color: EmebedColors.blue
        }
      ]
    })
    await readminCollections.ticket.updateOne({
      internalId: ticketId,
    }, {
      $set: {
        stage: 'current',
        reason,
        channelId: channel.id,
      }
    })

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Your ticket has been created',
            description: `View it here <#${channel.id}>`,
            color: EmebedColors.green
          }
        ]
      }
    } as APIInteractionResponse
  } else {
    await readminCollections.ticket.deleteOne({
      internalId: ticketId
    })
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'Failed to create ticket channel',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }
}




export async function handleTicketCommand(message: APIApplicationCommandInteraction) {
  const channelId = message.channel.id;
  const ticket = await readminCollections.ticket.findOne({ channelId });
  if (!ticket) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'Ticket not found',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }

  if (!message.member?.roles.includes('1119480419147067452') && !message.member?.roles.includes('1081086674202787922')) { // CS TEAM ROLE id and exec server partner role id
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'You are not a support agent',
            description: 'You do not have permission to perform this command.',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }


  const command = message.data as APIChatInputApplicationCommandInteractionData;
  const commandName = command.name as 'claim' | 'close' | 'close_rate' | 'join' | 'leave' | 'workspaces';

  if (commandName == 'claim') {
    await readminCollections.ticket.updateOne({ _id: ticket._id }, { $addToSet: { agentsInvolved: message.member.user.id } });
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          {
            title: 'Ticket Claimed',
            description: `Ticket has been claimed by <@${message.member.user.id}>`,
            color: EmebedColors.green
          }
        ]
      }
    } as APIInteractionResponse;
  }
  if (commandName == 'join') {
    await readminCollections.ticket.updateOne({ _id: ticket._id }, { $addToSet: { agentsInvolved: message.member.user.id } });
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          {
            title: 'Agent Added',
            description: `Ticket has been claimed by <@${message.member.user.id}>`,
            color: EmebedColors.green
          }
        ]
      }
    } as APIInteractionResponse;
  }
  if (commandName == 'leave') {
    await readminCollections.ticket.updateOne({ _id: ticket._id }, { $pull: { agentsInvolved: message.member.user.id } });
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          {
            title: 'Agent Removed',
            description: `<@${message.member.user.id}> left this ticket`,
            color: EmebedColors.green
          }
        ]
      }
    } as APIInteractionResponse;

  }

  type WorkspaceCommandType = {
    name: 'sync',
    options: [
      {
        name: 'members' | 'roles',
        options: [{
          name: 'groupid',
          type: 4,
          value: number;
        }]
      }
    ]
  } | {
    name: 'list'
    type: 1,
  } | {
    name: 'exit' | 'join' | 'leave',
    options: [{
      name: 'groupid',
      type: 4,
      value: number;
    }]
  };

  if (commandName == 'workspaces') {
    const options = command.options as [WorkspaceCommandType];
    const action = options[0].name;
    const agentUser = await readminCollections.user.findOne({ discordId: message.member.user.id });
    if (!agentUser) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: 'Error',
              description: 'User not found',
              color: EmebedColors.red
            }
          ]
        }
      } as APIInteractionResponse
    }
    if (action == 'join' || action == 'leave' || action == 'exit') {
      const groupId = options[0].options[0].value.toString();
      const permName = `${groupId}-${ticket.internalId}`;
      let existingDepartment = await readminCollections.department.findOne({
        groupId,
        name: permName,
      });
      if (action == 'join') {
        let newDep = false;
        if (!existingDepartment) {
          newDep = true;
          const newDept = await readminCollections.department.insertOne({
            groupId: groupId,
            name: permName,
            permissions: WORKSPACE_OWNER_PERMISSIONS,
            isAddedBySupport: true,
            created: new Date(),
            cankRankRoles: []
          })
          existingDepartment = await readminCollections.department.findOne({ _id: newDept.insertedId });
          await readminCollections.ticket.updateOne({ _id: ticket._id }, { $set: { departmentId: existingDepartment?._id as ObjectId } })
        }

        await readminCollections.department_users.insertOne({
          groupId: groupId,
          departmentId: existingDepartment?._id as ObjectId,
          userId: agentUser.robloxId?.toString() || '',
          created: new Date(),
        })
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [
              {
                title: `ReAdmin Support Team`,
                description: `You can now access ${groupId} ${newDep
                  ? 'and a new department was created'
                  : 'using the existing support department'
                  }`,
                color: 0x0891ec,
              },
            ],
          }
        } as APIInteractionResponse;
      }
      if (action == 'leave') {
        const foundMember = await readminCollections.department_users.findOne({
          groupId,
          departmentId: existingDepartment?._id,
          userId: agentUser.robloxId?.toString() || '',

        });
        if (foundMember) {
          await readminCollections.department_users.deleteOne({ _id: foundMember._id });
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              embeds: [
                {
                  title: `ReAdmin Support Team`,
                  description: `You have been removed from ${groupId}`,
                  color: 0x0891ec,
                },
              ],
            }
          } as APIInteractionResponse;
        } else {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              embeds: [
                {
                  title: `ReAdmin Support Team`,
                  description: `You were not removed from ${groupId} because you were not in it already.`,
                  color: 0x0891ec,
                },
              ],
            }
          } as APIInteractionResponse;
        }
      }
      if (action == 'exit') {
        const users = await readminCollections.department_users.find({
          departmentId: existingDepartment?._id,
        });
        await Promise.all([
          users.map((a) => readminCollections.department_users.deleteOne({ _id: a._id })),
          readminCollections.department.deleteOne({
            _id: existingDepartment?._id,
          })
        ]);
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [
              {
                title: `ReAdmin Support Team`,
                description: `Department has been removed from ${groupId}`,
                color: 0x0891ec,
              },
            ],
          }
        } as APIInteractionResponse;
      }
    }


    if (action == 'list') {
      const dbUser = await readminCollections.user.findOne({ discordId: ticket.discordId });
      if (!dbUser) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [
              {
                title: 'Error',
                description: 'User not found',
                color: EmebedColors.red
              }
            ]
          }
        } as APIInteractionResponse;
      }
      const workspaces = await getUserWorkspaces(dbUser as User);
      if (workspaces.length == 0) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [
              {
                title: `ReAdmin Support Team`,
                description: `No workspaces found for <@${ticket.discordId}>`,
                color: 0x0891ec,
              },
            ],
          }
        } as APIInteractionResponse;
      } else {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: await Promise.all(
              workspaces.map(async (workspace) => {
                const groupInfo = await getGroupInfo(workspace.groupId);
                const ownerInfo = await getUserInfo(workspace.owner.robloxId);
                return {
                  title: `ReAdmin Support Team`,
                  description: `**${groupInfo?.displayName}** ${workspace.groupId}
                    **Owner**: ${ownerInfo?.name}/${workspace.owner.robloxId}
                    **Permission Status**: ${workspace.department.permissions.admin ? 'Admin' : '**NOT ADMIN**'
                    }\n**Subscription**: ${workspace?.premium?.is ? workspace.premium.planType : 'Not paid'
                    }\n**Created**: <t:${Math.floor(workspace.created.getTime() / 1000)}>`,
                  color: 0x0891ec,
                };
              }),
            ),
          }
        } as APIInteractionResponse;
      }

    }
    if (action == 'sync') {
      const syncType = options[0].options[0].name;
      const groupId = options[0].options[0].options[0].value;
      const foundWorkspace = await readminCollections.workspace.findOne({ groupId: groupId.toString() });
      if (!foundWorkspace) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: 64,
            embeds: [
              {
                title: 'Error',
                description: 'Workspace not found',
                color: EmebedColors.red
              }
            ]
          }
        } as APIInteractionResponse;
      }
      if (syncType == 'members') {
        SyncMembers(foundWorkspace);
      }
      if (syncType == 'roles') {
        SyncRoles(foundWorkspace);
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: 'Syncing',
              description: `Syncing ${syncType} started for ${foundWorkspace?.groupName}`,
              color: EmebedColors.green
            }
          ]
        }
      } as APIInteractionResponse;

    }

  }

  // Ticket Closing
  if (command.name == 'close') {
    const options = command.options as [{ name: 'reason', type: 3, value: string }];
    const reason = options[0].value;
    await readminCollections.ticket.updateOne({
      channelId
    }, {
      $set: {
        stage: 'finished',
        resolvedReason: reason,
        closedBy: message?.member?.user?.id || '',
      }
    });
    console.log(await deleteDiscordChannel(ticket.channelId as string))
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Deleting ticket...'
      }
    } as APIInteractionResponse;
  }

  if (command.name == 'close_rate') {
    const options = command.options as [{ name: 'reason', type: 3, value: string }];
    const reason = options[0].value;
    await readminCollections.ticket.updateOne({
      channelId
    }, {
      $set: {
        stage: 'rating',
        resolvedReason: reason,
        closedBy: message?.member?.user?.id || '',
      }
    });
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          {
            title: `ReAdmin Support Team`,
            description: `Thank you for chosing ReAdmin <@${ticket.discordId}>!\n\nYour ticket was resolved with reason: ${reason}\n\n Please rate the support you have received.`,
            color: EmebedColors.green,
          }
        ],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                label: 'Not Helpful',
                custom_id: `oneStar=-=${ticket.internalId}`,
                style: ButtonStyle.Danger
              },
              {
                type: ComponentType.Button,
                label: 'Helpful',
                custom_id: `twoStar=-=${ticket.internalId}`,
                style: ButtonStyle.Primary
              },
              {
                type: ComponentType.Button,
                label: 'Very Helpful',
                custom_id: `threeStar=-=${ticket.internalId}`,
                style: ButtonStyle.Success
              },
            ]
          }
        ]
      }
    } as APIInteractionResponse
  }

  return false;
}

export async function handleTicketRatingClose(data: APIMessageComponentInteraction) {
  const splits = data.data.custom_id.split('Star=-=');
  const ticketId = splits[1];
  const rating = splits[0] as 'one' | 'two' | 'three';
  const ticket = await readminCollections.ticket.findOne({
    internalId: ticketId
  });
  if (!ticket) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'Ticket not found',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse;
  }
  await readminCollections.ticket.updateOne({
    internalId: ticketId
  }, {
    $set: {
      stage: 'finished',
      agentsRating: { one: 1, two: 2, three: 3 }[rating],
    }
  });
  console.log(await deleteDiscordChannel(ticket.channelId as string))
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: 'Deleting ticket...'
    }
  } as APIInteractionResponse;


}
