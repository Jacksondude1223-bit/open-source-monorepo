import { APIInteraction, ApplicationCommandType, ChannelType, ComponentType, InteractionType } from "discord-api-types/v10";
import { createTicketUsingButtonInteraction, finishCreatingTicket, handleTicketCommand, handleTicketRatingClose } from './systems/ticketSystem';
import { handleAutocompleteRequest } from './systems/autocomplete';
import { httpHandleWorkspaceCommand } from './systems/workspace';
import { optIntoMessaging } from './systems/utility';
import { rankCommand } from './systems/rank';
import { handleCallButton, handleCallReplyCommand } from './systems/callSystem';
import { env } from "~/services/env";

export default async function handleInteraction(message: APIInteraction) {
  try {

    if (message.type == InteractionType.ApplicationCommandAutocomplete) {
      return await handleAutocompleteRequest(message);
    }

    if (message.type == InteractionType.ApplicationCommand) {
      const command = message.data;
      if (command.type == ApplicationCommandType.ChatInput) {
        if (command.name == 'opt-into-messaging') {
          return await optIntoMessaging(message)
        }
        if (command.name == 'reply') {
          return await handleCallReplyCommand(message);
        }
        if (message.channel.type == ChannelType.GuildText && (message.channel.parent_id == '1124930370522071040' || message.channel.parent_id == '1344159692427100241' || message.channel.parent_id == '1195207667040391198')) { // the categoery id for where tickets should be to handle commands
          const handle = await handleTicketCommand(message);
          if (handle) {
            return handle;
          }
        }
        if (message.channel.type == ChannelType.GuildText && command.name == 'rank') {
          return await rankCommand(message);
        }
        return await httpHandleWorkspaceCommand(message);
      }
    }
    if (message.type == InteractionType.MessageComponent) {
      if (message.data.custom_id?.startsWith('CALL-CLAIM-') || message.data.custom_id?.startsWith('CALL-CLOSE-')) {
        return await handleCallButton(message);
      }
      if (message.message.id == (env.DISCORD_CLIENT_ID == '1124803971937214694' /* dev bot [exec server] */ ? '1195209320497950771' /* dev */ : '1124923432975466598')) { // This magic number is the message id for the create ticket
        return await createTicketUsingButtonInteraction(message)
      }
      if (message.data.component_type == ComponentType.Button && message.data.custom_id.includes('Star=-=')) {
        return await handleTicketRatingClose(message)
      }
    }
    if (message.type == InteractionType.ModalSubmit) {
      if (message.data.custom_id.startsWith('TICKET-CREATION-')) {
        return await finishCreatingTicket(message)
      }
    }
    throw new Error('Unknown interaction type');
  } catch (e) {
    console.error('Error handling interaction', e);
    throw new Error('Internal Server Error');
  }
}