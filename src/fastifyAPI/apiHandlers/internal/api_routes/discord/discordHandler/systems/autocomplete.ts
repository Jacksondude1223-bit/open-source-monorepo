import { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteractionDataOption, APIInteractionResponse, InteractionResponseType, InteractionType } from "discord-api-types/v10";
import httpDiscordWorkspaceValidation from './workspace';
import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { batchGetRobloxUsers } from '~/services/roblox.service';

function findFocusedOption(options: any): APIApplicationCommandInteractionDataOption | null {
  for (const option of options) {
    // If this option is focused, return it directly
    if (option.focused) {
      return option;
    }

    // If this option has nested options, recurse into them
    if (option.options) {
      const focusedOption = findFocusedOption(option.options);
      if (focusedOption) {
        return focusedOption;
      }
    }
  }
  return null; // Return null if no focused option is found
}

function findOptionByName(options: any, name: string): APIApplicationCommandInteractionDataOption | null {
  for (const option of options) {
    // Check if the current option is the one we're looking for
    if (option.name === name) {
      return option;
    }

    // If this option has nested options, recurse into them
    if (option.options) {
      const result = findOptionByName(option.options, name);
      if (result) {
        return result;
      }
    }
  }
  return null; // Return null
}


export async function handleAutocompleteRequest(message: APIApplicationCommandAutocompleteInteraction) {
  if (message.type == InteractionType.ApplicationCommandAutocomplete) {
    const data = message.data;
    if (!message.guild_id) {
      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: []
        }
      } as APIInteractionResponse;
    }


    const workspaceInfo = await httpDiscordWorkspaceValidation(message.guild_id, message.member?.user?.id || '', false);
    if (workspaceInfo == false || workspaceInfo == 'no-user') {
      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: []
        }
      } as APIInteractionResponse;
    }
    const foundIntergration = workspaceInfo[0];

    const options = data.options;
    const focused = findFocusedOption(options) as { name: string; value: string; };

    console.log(focused)

    if (focused?.name == 'game') {
      const value = focused.value;
      const games = await readminCollections.game.find({ groupId: foundIntergration.groupId }).toArray();
      const options = games.filter(game => game.name.toLowerCase().includes(value.toLocaleLowerCase()) || value == '').map(game => {
        return {
          name: game.name,
          value: game._id.toString()
        }
      })
      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: options
        }
      } as APIInteractionResponse;
    }
    if (focused?.name == 'server') {
      const [foundIntergration, user, userWorkspace, workspace, groupInfo] = workspaceInfo;
      const gameData = findOptionByName(options, 'game') as { name: string; value: string; };
      if (!gameData) {
        return;
      }
      const gameId = gameData.value;
      const game = await readminCollections.game.findOne({
        _id: StringToObjectID(gameId as unknown as string),
        groupId: foundIntergration.groupId,
      })
      if (!game) {
        return;
      }
      const servers = await readminCollections.running_games.find({
        gameId: game.gameId,
        placeId: game.placeId
      }).toArray();

      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: servers.map(server => ({
            name: `Players: ${server.players.length.toLocaleString()} Started ${new Date(server.created).toLocaleString()} (${server.jobId})`,
            value: server._id.toString()
          }))
        }
      } as APIInteractionResponse;
    }
    if (focused?.name == 'player-name') {
      const playerName = focused.value;

      const [foundIntergration, user, userWorkspace, workspace, groupInfo] = workspaceInfo;

      const inGame = await readminCollections.running_game_players.find({
        groupId: foundIntergration.groupId
      }).toArray()

      // Resolve usernames from roblox_user (canonical source)
      const playerUserIds = inGame.map(p => parseInt(p.userId)).filter(id => !isNaN(id));
      const robloxUsers = await batchGetRobloxUsers(playerUserIds);

      const filtered = inGame.filter(player => {
        if (playerName === '') return true;
        const rUser = robloxUsers.get(parseInt(player.userId));
        const uname = rUser?.name || player.userId;
        return uname.toLocaleLowerCase().includes(playerName.toLocaleLowerCase());
      });

      const options = filtered.map(player => {
        const rUser = robloxUsers.get(parseInt(player.userId));
        return {
          name: `${rUser?.name || player.userId} (${player.userId})`,
          value: player.userId.toString()
        }
      })

      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: options
        }
      } as APIInteractionResponse;
    }

    if (focused?.name == 'roblox-name') {
      const robloxName = focused.value;
      const users = await readminCollections.group_member.find({
        groupId: foundIntergration.groupId
      }).toArray();

      // Batch-resolve names and roles from canonical sources
      const memberUserIds = users.map(u => u.userId);
      const robloxUsersMap = await batchGetRobloxUsers(memberUserIds);
      const roleIds = [...new Set(users.map(u => u.roleId))];
      const roles = await readminCollections.group_role.find({
        groupId: foundIntergration.groupId,
        id: { $in: roleIds },
      }).toArray();
      const roleNameMap = new Map(roles.map(r => [r.id, r.name]));

      const filtered = users.filter(user => {
        if (robloxName === '') return true;
        const rUser = robloxUsersMap.get(user.userId);
        const uname = rUser?.name || user.userId.toString();
        return uname.toLocaleLowerCase().includes(robloxName.toLocaleLowerCase());
      });
      const options = filtered.map(user => {
        const rUser = robloxUsersMap.get(user.userId);
        const rankName = roleNameMap.get(user.roleId) || '';
        return {
          name: `${rUser?.name || user.userId} (${user.userId} - ${rankName})`,
          value: user.userId.toString()
        }
      })

      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: options
        }
      } as APIInteractionResponse;

    }
    if (focused?.name == 'roleset') {
      const roleName = focused.value;
      const roles = await readminCollections.group_role.find({
        groupId: foundIntergration.groupId,
        $nor: [
          { rank: 255 },
          { rank: 0 }
        ]
      }).toArray();
      const filtered = roles.sort((a, b) => a.rank - b.rank).filter(groupRole => roleName !== '' ? groupRole.name?.toLocaleLowerCase()?.includes(roleName?.toLocaleLowerCase()) : true)
      const options = filtered.map(role => {
        return {
          name: `${role.name} (${role.rank})`,
          value: role.id.toString()
        }
      })

      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: options
        }
      } as APIInteractionResponse;
    }


    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: {
        choices: []
      }
    } as APIInteractionResponse
  }
}