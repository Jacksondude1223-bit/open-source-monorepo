import { APIApplicationCommandInteraction, APIInteractionResponse, InteractionResponseType } from "discord-api-types/v10";
import { readminCollections } from '~/services/mongo.service';
import { EmebedColors } from "~/services/discord.service";


export async function optIntoMessaging(message: APIApplicationCommandInteraction) {
  const data = message.data as any;
  const optIn = data?.options[0]?.value || false;

  const foundUser = await readminCollections.user.findOne({
    discordId: message?.user?.id.toString()
  })
  if (!foundUser) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: 64,
        embeds: [
          {
            title: 'Error',
            description: 'We could not find your ReAdmin account.',
            color: EmebedColors.red
          }
        ]
      }
    } as APIInteractionResponse
  }

  await readminCollections.user.updateOne({ _id: foundUser._id }, { $set: { allowDiscordMessages: optIn } })
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      flags: 64,
      embeds: [
        {
          title: 'Successfully updated your messaging preferences',
          description: optIn ? 'You have opted into messaging' : 'You have opted out of messaging',
          color: EmebedColors.blue
        }
      ]
    }
  } as APIInteractionResponse



}