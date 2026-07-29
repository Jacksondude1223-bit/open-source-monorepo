import { APIApplicationCommandInteraction, APIInteractionResponse, ApplicationCommandType, InteractionResponseType } from "discord-api-types/v10";
import httpDiscordWorkspaceValidation from "./workspace";
import { readminCollections } from "~/services/mongo.service";
import { canWorkspaceOrUserRank, rankUser } from "~/services/group-actions.service";
import { EmebedColors } from "~/services/discord.service";
import { getDepartmentForUserId, getRolesDepartmentCanRankTo } from "~/services/workspaces.service";

export async function rankCommand(data: APIApplicationCommandInteraction) {
  const workspaceInfo = await httpDiscordWorkspaceValidation(data.guild_id as string, data.member?.user?.id || '', true);
  if (!workspaceInfo || workspaceInfo == 'no-user') return;
  const [integration, User, UserWorkspaceResponse, Workspace, groupInfo] = workspaceInfo;
  const commandData = data.data;
  if (commandData.type !== ApplicationCommandType.ChatInput) return;
  const options = commandData.options as { name: string; type: 3; value: string; }[];
  const user = options?.find((option) => option.name == 'roblox-name')?.value;
  const rank = options?.find((option) => option.name == 'roleset')?.value;

  if (!user || !rank) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'Please provide a Roblox name and a roleset',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }


  const userInfo = await readminCollections.group_member.findOne({
    groupId: Workspace.groupId,
    userId: parseInt(user)
  })

  if (!userInfo) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
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

  const rankerInfo = await readminCollections.group_member.findOne({
    groupId: Workspace.groupId,
    userId: parseInt(User.robloxId)
  })

  const permissions = UserWorkspaceResponse.department.permissions;

  if (permissions.admin == false && permissions.activity.ranking == false) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'You do not have permission to rank users',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }

  if (permissions.admin == false && (rankerInfo?.rankId || 0) < userInfo.rankId) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'You do not have permission to rank users above your rank',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }

  const roleInfo = await readminCollections.group_role.findOne({
    groupId: Workspace.groupId,
    id: parseInt(rank)
  })

  if (!roleInfo) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'Role not found',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }


  const hasBot = canWorkspaceOrUserRank('group', Workspace.groupId);
  if (!hasBot) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'The workspace adminsitrators have not setup the Roblox integration. Please contact them to setup Roblox OAuth',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }


  const department = await getDepartmentForUserId(rankerInfo?.userId?.toString() || '', Workspace.groupId);
  if (!department) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'User is not in a department',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }
  const rankableRanks = await getRolesDepartmentCanRankTo(Workspace, department);
  if (rankableRanks.map(r => r.id.toString()).includes(roleInfo.id.toString()) == false) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: `You are not allowed to rank people to this role.`,
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }

  const rankStatus = await rankUser('group', Workspace.groupId, Workspace.groupId, userInfo.userId, roleInfo.rank.toString(), 'discord', {
    discordUserId: (data.user?.id || data.member?.user.id)?.toString() || '',
    discordChannelId: data.channel.id.toString(),
    discordGuildId: data.guild_id?.toString() || '',
    robloxUserId: User.robloxId,
    readminUserId: User._id?.toString() || ''
  })

  if (rankStatus == true) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Success',
            description: 'User ranked',
            color: EmebedColors.green
          }
        ]
      }
    } as APIInteractionResponse
  }

  if (rankStatus == 'loggedOut') {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'Bot is logged out',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }


  if (rankStatus == 'error') {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'An error occured',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }




}