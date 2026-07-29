import {
  APIApplicationCommandInteraction,
  APIChatInputApplicationCommandInteractionData,
  APIInteractionResponse,
  APIMessageComponentInteraction,
  InteractionResponseType,
} from 'discord-api-types/v10';
import { v4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { EmebedColors } from '~/services/discord.service';
import { handleCallDiscordClose, resolveDiscordAgentIdentity } from '~/services/callDiscord.service';

function ephemeral(title: string, description: string, color = EmebedColors.red): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      flags: 64,
      embeds: [{ title, description, color }],
    },
  };
}

// /reply <message> — posts an agent message into the in-game call. The message
// appears in-game as the agent's linked Roblox account, or ReAdminApp if none.
export async function handleCallReplyCommand(message: APIApplicationCommandInteraction): Promise<APIInteractionResponse> {
  const channelId = message.channel?.id;
  const ticket = channelId
    ? await readminCollections.in_game_support_ticket.findOne({ discordChannelId: channelId })
    : null;

  if (!ticket) {
    return ephemeral('Not a call channel', 'The `/reply` command can only be used inside a support call channel.');
  }
  if (ticket.status === 'closed') {
    return ephemeral('Call closed', 'This call has been closed and can no longer receive messages.');
  }

  const data = message.data as APIChatInputApplicationCommandInteractionData;
  const option = data.options?.find((o) => o.name === 'message');
  const text = option && 'value' in option ? String(option.value) : '';
  if (!text.trim()) {
    return ephemeral('Missing message', 'Please provide a message to send.');
  }

  const identity = await resolveDiscordAgentIdentity(message.member?.user.id);

  await readminCollections.in_game_support_ticket.updateOne(
    { _id: ticket._id },
    {
      $push: {
        messages: {
          username: identity.username,
          userId: identity.userId,
          message: text,
          id: v4(),
          origin: 'agent',
          sentFrom: 'discord',
          created: new Date(),
        },
      },
    },
  );

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `**${identity.username}** (agent): ${text}`.slice(0, 1900),
      allowed_mentions: { parse: [] },
    },
  };
}

// Handles the Claim / Close buttons on the call embed.
export async function handleCallButton(message: APIMessageComponentInteraction): Promise<APIInteractionResponse> {
  const customId = message.data.custom_id;
  const isClaim = customId.startsWith('CALL-CLAIM-');
  const ticketId = customId.replace('CALL-CLAIM-', '').replace('CALL-CLOSE-', '');

  let ticket;
  try {
    ticket = await readminCollections.in_game_support_ticket.findOne({ _id: new ObjectId(ticketId) });
  } catch {
    ticket = null;
  }
  if (!ticket) {
    return ephemeral('Call not found', 'This call no longer exists.');
  }

  const identity = await resolveDiscordAgentIdentity(message.member?.user.id);

  if (isClaim) {
    if (ticket.status === 'closed') {
      return ephemeral('Call closed', 'This call has already been closed.');
    }
    if (ticket.status === 'claimed') {
      return ephemeral('Already claimed', 'This call has already been claimed.');
    }
    await readminCollections.in_game_support_ticket.updateOne(
      { _id: ticket._id, status: 'open' },
      {
        $set: { status: 'claimed', claimedBy: identity.userId },
        $push: {
          messages: {
            username: identity.username,
            userId: identity.userId,
            message: `${identity.username} claimed this call`,
            id: v4(),
            origin: 'systemMessage',
            sentFrom: 'discord',
            created: new Date(),
          },
        },
      },
    );
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: `**${identity.username}** claimed this call.`, allowed_mentions: { parse: [] } },
    };
  }

  // Close
  if (ticket.status === 'closed') {
    return ephemeral('Already closed', 'This call has already been closed.');
  }
  await readminCollections.in_game_support_ticket.updateOne(
    { _id: ticket._id },
    {
      $set: {
        status: 'closed',
        closed: {
          user: identity.username,
          reason: 'closedByAgent',
          date: new Date(),
          serverAcknowledged: false,
        },
      },
      $push: {
        messages: {
          username: identity.username,
          userId: identity.userId,
          message: `${identity.username} closed this call`,
          id: v4(),
          origin: 'systemMessage',
          sentFrom: 'discord',
          created: new Date(),
        },
      },
    },
  );

  // Fire-and-forget so the ephemeral response survives even if the channel is
  // deleted as part of the close action.
  handleCallDiscordClose(ticket).catch(() => { });

  return ephemeral('Call closed', 'This call has been closed.', EmebedColors.green);
}
