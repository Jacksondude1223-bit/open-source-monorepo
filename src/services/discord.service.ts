import {
  APIGuild,
  APIGuildChannel,
  APIUser,
  RESTPostOAuth2AccessTokenResult,
  RESTGetAPIWebhookResult,
  APIApplicationCommand,
  RESTGetAPIGuildMembersResult,
  APIGuildMember,
} from 'discord-api-types/v10';
import { env } from '~/services/env';
import proxyFetch from '../utils/proxyFetch';
import { readminCollections } from '~/services/mongo.service';
import type { DiscordDmCategory, DiscordDmCategoryConfig, DiscordDmSettings } from '~/services/NewMongoTypes/Workspace.type';
export const messagingEnabled = true;
export const BloxlinkSearch = true;

export async function OAuth2Handshake(
  code: string,
  redirect_uri: string,
): Promise<false | RESTPostOAuth2AccessTokenResult> {
  const data = {
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri,
    code,
  };
  const tokenRequest = await proxyFetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data),
  }, true);
  const response =
    (await tokenRequest.json()) as RESTPostOAuth2AccessTokenResult;
  if ('error' in response) {
    console.log(tokenRequest.status, response)
    return false;
  }
  return response;
}

export async function getUserFromDiscordOAuthHandshake(
  token: string,
): Promise<false | APIUser> {
  const request = await proxyFetch('https://discord.com/api/v9/users/@me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }, true);
  const response = (await request.json()) as APIUser;
  if ('error' in response) {
    return false;
  }
  return response;
}

export async function getDiscordUser(userId: string): Promise<APIUser | null> {
  try {
    const request = await proxyFetch(`https://discord.com/api/v10/users/${userId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
      },
    }, true);

    if (!request.ok) {
      console.error(`Failed to fetch Discord user ${userId}: ${request.status}`);
      return null;
    }

    const response = (await request.json()) as APIUser;
    return response;
  } catch (error) {
    console.error('Error fetching Discord user:', error);
    return null;
  }
}

export async function getGuild(guild_id: string): Promise<APIGuild> {
  try {
    const request = await proxyFetch(
      `https://discord.com/api/v10/guilds/${guild_id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bot ${env.DISCORD_TOKEN}`,
        },
      },
      true
    );
    if (!request.ok) {
      console.error(`Failed to fetch Discord guild ${guild_id}: ${request.status}`);
      return {} as APIGuild;
    }
    const response = (await request.json()) as APIGuild;
    // Discord error payloads are objects like { message, code }; only return a real guild.
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return {} as APIGuild;
    }
    return response;
  } catch (error) {
    console.error('Error fetching Discord guild:', error);
    return {} as APIGuild;
  }
}
export async function getGuildChannels(
  guild_id: string,
): Promise<APIGuildChannel<any>[]> {
  try {
    const request = await proxyFetch(
      `https://discord.com/api/v10/guilds/${guild_id}/channels`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bot ${env.DISCORD_TOKEN}`,
        },
      },
      true
    );
    if (!request.ok) {
      console.error(`Failed to fetch Discord channels for guild ${guild_id}: ${request.status}`);
      return [];
    }
    const response = (await request.json()) as APIGuildChannel<any>[];
    // On error Discord returns an object, not an array — never leak that to callers.
    if (!Array.isArray(response)) {
      return [];
    }
    return response;
  } catch (error) {
    console.error('Error fetching Discord channels:', error);
    return [];
  }
}

export async function leaveGuild(guild_id: string): Promise<true> {
  if (guild_id == '845829826626584606') {
    return true; // bro dont leave readmin
  }
  await proxyFetch(`https://discord.com/api/v10/users/@me/guilds/${guild_id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
  }, true);
  return true;
}

export function isValidDiscordWebhookURL(url: string): boolean {
  const discordWebhookPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
  return discordWebhookPattern.test(url);
}


export async function getWebhookInfo(url: string): Promise<RESTGetAPIWebhookResult> {
  const request = await proxyFetch(url, {
    method: 'GET',
  });
  const response = (await request.json()) as RESTGetAPIWebhookResult;
  return response;
}
export async function getDiscordGuildMembers(guildId: string, after?: string): Promise<RESTGetAPIGuildMembersResult> {
  const request = await proxyFetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`, {
    method: 'GET',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
  });
  if (request.status !== 200) {
    return [];
  }
  const response = (await request.json()) as RESTGetAPIGuildMembersResult;
  return response;
}
export async function getDiscordGuildMembersRecursive(guildId: string, after?: string, accumulatedMembers: APIGuildMember[] = []): Promise<APIGuildMember[]> {
  const currentBatch = await getDiscordGuildMembers(guildId, after);
  const allMembers = [...accumulatedMembers, ...currentBatch];

  if (currentBatch.length < 1000) {
    return allMembers;
  }

  const nextAfter = currentBatch[currentBatch.length - 1];
  if (!nextAfter) {
    return allMembers;
  }
  return await getDiscordGuildMembersRecursive(guildId, nextAfter.user.id, allMembers);
}

export async function addRoleDiscordUser(guildId: string, userId: string, roleId: string) {
  return await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
  });
}
export async function removeRoleDiscordUser(guildId: string, userId: string, roleId: string) {
  return await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
  });
}
export async function banDiscordUser(guildId: string, userId: string) {
  return await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
  });
}
export async function kickDiscordUser(guildId: string, userId: string) {
  return await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
  });
}
export async function getDiscordUserDMChannel(userId: string): Promise<string> {
  const req = await proxyFetch("https://discord.com/api/v9/users/@me/channels", {
    method: "POST",
    headers: {
      // eslint-disable-next-line no-undef
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient_id: userId,
    }),
  }, true);
  try {
    const resp = await req.json() as { id: string };
    return resp.id;
  } catch (e) {
    return '';
  }
}


export async function sendWebhookMessage(url: string, color: EmbedColor, title: string, description: string, thumbnail?: string, strUrl?: string, image?: string, options?: { content?: string; mentionUserIds?: string[]; fields?: { name: string; value: string; inline?: boolean }[]; author?: { name: string; icon_url?: string; url?: string }; timestamp?: Date | string; footerText?: string }): Promise<true> {
  await proxyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      "content": options?.content ?? null,
      ...(options?.mentionUserIds?.length ? { allowed_mentions: { users: options.mentionUserIds } } : {}),
      "embeds": [
        {
          "title": title,
          "description": description,
          "color": EmebedColors[color],
          "footer": {
            "text": options?.footerText ?? "Powered by ReAdmin. This content is not endorsed by ReAdmin, LLC."
          },
          ...(options?.fields?.length ? { fields: options.fields } : {}),
          ...(options?.author ? { author: options.author } : {}),
          ...(options?.timestamp ? { timestamp: (options.timestamp instanceof Date ? options.timestamp : new Date(options.timestamp)).toISOString() } : {}),
          ...(strUrl ? { url: strUrl } : {}),
          ...(thumbnail ? { thumbnail: { url: thumbnail } } : {}),
          ...(image ? { image: { url: image } } : {}),
        }
      ],
      "attachments": []
    }),
  }, true);

  return true;
}

export type internalMessagingType = 'partnerRequest' | 'distributions' | 'gameKilling' | 'gameErrors' | 'internalGameIdNotFound' | 'billing' | 'imageUploads' | 'openCloudErrors' | 'cancellations' | 'setupRequests' | 'panelErrors';

export async function sendReAdminInternalWebhookMessage(channel: internalMessagingType, color: EmbedColor, title: string, description: string, thumbnail?: string, strUrl?: string, image?: string, options?: { content?: string; mentionUserIds?: string[] }): Promise<true> {
  // Operator-owned internal logging webhooks. Redacted before open-sourcing —
  // fill in your own Discord webhook URLs, or leave them and accept that every
  // call here fails harmlessly (sendWebhookMessage swallows the error).
  const webhookUrls = {
    partnerRequest: '',
    distributions: '',
    gameKilling: '',
    gameErrors: '',
    internalGameIdNotFound: '',
    billing: '',
    imageUploads: '',
    openCloudErrors: '',
    cancellations: '',
    setupRequests: '',
    panelErrors: ''
  }
  const webhookUrl = webhookUrls[channel];
  return await sendWebhookMessage(webhookUrl, color, title, description, thumbnail, strUrl, image, options);
}


export async function createDiscordEvent(data: {
  guildId: string,
  name: string,
  description: string,
  location: string,
  scheduled_start_time: Date,
  scheduled_end_time: Date,
  entity_type: 1 | 2 | 3; /* 1 = STAGE_INSTANCE, 2 = VOICE, 3 = EXTERNAL */
  /*
  Image Data
Image data is a Data URI scheme that supports JPG, GIF, and PNG formats. An example Data URI format is:

data:image/jpeg;base64,BASE64_ENCODED_JPEG_IMAGE_DATA
Ensure you use the proper content type (image/jpeg, image/png, image/gif) that matches the image data being provided.
  */
  image: string;
}) {

  const request = await proxyFetch(`https://discord.com/api/v10/guilds/${data.guildId}/scheduled-events`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      entity_metadata: { location: data.location },
      scheduled_start_time: data.scheduled_start_time.toISOString(),
      scheduled_end_time: data.scheduled_end_time.toISOString(),
      entity_type: data.entity_type,
      privacy_level: 2,//	the scheduled event is only accessible to guild members
      image: data.image,
    }),
  }, true);
  // const msg = await request.json();
  return request.status == 201;
}

const discordDateFormats = {
  short_time: 't',
  long_time: 'T',
  short_date: 'd',
  long_date: 'D',
  ['short_date/time']: 'f',
  ['long_date/time']: 'F',
  relative_time: 'R',
};


export function returnDiscordMessageFormatForDate(date: Date, format: 'short_time' | 'long_time' | 'short_date' | 'long_date' | 'short_date/time' | 'long_date/time' | 'relative_time'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${discordDateFormats[format]}>`;
}

export async function createDiscordChannel(guildId: string, data: any) { // https://discord.com/developers/docs/resources/guild#create-guild-channel
  const request = await proxyFetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }, true);
  return await request.json() as APIGuildChannel<any>;
}
export async function deleteDiscordChannel(guildId: string) { // https://discord.com/developers/docs/resources/guild#delete-guild-channel
  const request = await proxyFetch(`https://discord.com/api/v10/channels/${guildId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    }
  }, true);
  return await request.json();
}

// https://discord.com/developers/docs/resources/channel#edit-channel-permissions
// Sets a single permission overwrite on a channel. Unlike create-time overwrites
// (which are validated against the parent category and may have bits silently
// stripped), this evaluates against the channel itself, so it reliably applies
// permissions like SEND_MESSAGES for channels nested under a restrictive category.
export async function editChannelPermissions(
  channelId: string,
  overwriteId: string,
  data: { allow?: string; deny?: string; type: 0 | 1 },
) {
  const request = await proxyFetch(`https://discord.com/api/v10/channels/${channelId}/permissions/${overwriteId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }, true);
  return request;
}


export async function modifyDiscordChannel(channelId: string, data: any) { // https://discord.com/developers/docs/resources/channel#modify-channel
  const request = await proxyFetch(`https://discord.com/api/v10/channels/${channelId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }, true);
  return await request.json();
}

export async function sendFollowupFromCommand(applicationId: string, interactionToken: string, data: any) { // https://discord.com/developers/docs/resources/guild#create-guild-channel
  const request = await proxyFetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }, true);
  return await request.json();
}

export async function sendGuildTextMessage(channelId: string, data: any): Promise<true> {
  const resp = await proxyFetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
    body: JSON.stringify(data),
  }, true);

  return await resp.json() as true;
}

export async function createDiscordCommand(commandData: APIApplicationCommand, guildId?: string) {
  return await proxyFetch(`https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/${guildId ? `guilds/${guildId}/` : ''}commands`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandData),
  }, true);
}
export async function updateDiscordCommand(commandData: APIApplicationCommand, commandId?: string, guildId?: string) {
  return await proxyFetch(`https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/${guildId ? `guilds/${guildId}/` : ''}commands/${commandId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandData),
  }, true);
}
export async function deleteDiscordCommand(commandId?: string, guildId?: string) {
  return await proxyFetch(`https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/${guildId ? `guilds/${guildId}/` : ''}commands/${commandId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    }
  }, true);
}


export type EmbedColor = 'blue' | 'red' | 'orange' | 'green';
export const EmebedColors = {
  blue: 3447003,
  red: 15548997,
  orange: 15105570,
  green: 5763719,
};


async function messageDiscordUser(
  userId: string,
  title: string,
  message: string,
  footerOveride: string,
  color = 3447003
) {
  const channelId = await getDiscordUserDMChannel(userId);
  if (!messagingEnabled) return;
  try {
    await proxyFetch(
      `https://discord.com/api/v9/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          // eslint-disable-next-line no-undef
          Authorization: `Bot ${env.DISCORD_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "",
          tts: false,
          embeds: [
            {
              type: "rich",
              title: title,
              description: message,
              color,
              footer: {
                text:
                  footerOveride == ""
                    ? "Powered by ReAdmin. This content is not endorsed by ReAdmin, LLC. To disable messaging do /opt-into-messaing false."
                    : footerOveride,
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.log(`Error when DMing user ${userId} message ${title}`);
  }

  return { body: { ok: true } };
}

// Options for steering an automated DM. When `category` is provided the message
// is gated by the workspace's discordDmSettings, and any custom title/message
// template configured for that category is applied. Pass `workspace` when the
// caller already has the document loaded to avoid an extra DB lookup; otherwise
// pass `groupId` and the workspace is fetched on demand. `variables` are
// substituted into custom templates via {placeholder} syntax.
export interface DmDispatchOptions {
  category?: DiscordDmCategory;
  groupId?: string;
  workspace?: { discordDmSettings?: DiscordDmSettings } | null;
  variables?: Record<string, string | number | undefined>;
}

// Normalises a stored category value into a config object. Historically this
// field was a plain boolean (enabled/disabled); accept that shape too so older
// documents keep working.
function normalizeDmCategoryConfig(value: unknown): DiscordDmCategoryConfig {
  if (typeof value === 'boolean') return { enabled: value };
  if (value && typeof value === 'object') return value as DiscordDmCategoryConfig;
  return {};
}

// Resolves the configuration for a given DM category for a workspace.
async function resolveDmCategoryConfig(
  category: DiscordDmCategory,
  options: DmDispatchOptions,
): Promise<DiscordDmCategoryConfig> {
  let dmSettings: DiscordDmSettings | undefined;
  if (options.workspace !== undefined && options.workspace !== null) {
    dmSettings = options.workspace.discordDmSettings;
  } else if (options.groupId) {
    const ws = await readminCollections.workspace.findOne(
      { groupId: options.groupId },
      { projection: { discordDmSettings: 1 } },
    );
    dmSettings = ws?.discordDmSettings || undefined;
  }
  return normalizeDmCategoryConfig(dmSettings?.[category]);
}

// Substitutes {variable} placeholders in a custom template. Unknown or
// unprovided placeholders resolve to an empty string so messages stay clean.
function renderDmTemplate(
  template: string,
  variables: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export async function dmUserDiscord(robloxId: string | number, title: string, description: string, type?: EmbedColor, footerOveride?: string, options?: DmDispatchOptions) {
  if (process.env.JEST_WORKER_ID !== undefined) {
    console.info('Running in Jest test environment, skipping DMing user.');
    return;
  }
  if (!robloxId || !title || !description) {
    return { success: false, reason: 'bad request' }
  }

  // Workspace-level DM category gating + templating. When a category is supplied
  // we honour the workspace's discordDmSettings: a category explicitly disabled
  // suppresses the DM, and any configured title/message template overrides the
  // built-in copy (falling back to the default when the template is empty).
  let outgoingTitle = title;
  let outgoingDescription = description;
  if (options?.category) {
    const config = await resolveDmCategoryConfig(options.category, options);
    if (config.enabled === false) {
      return { success: true, note: 'dm category disabled for workspace' };
    }
    const variables = options.variables || {};
    if (config.title && config.title.trim()) {
      const rendered = renderDmTemplate(config.title, variables).trim();
      if (rendered) outgoingTitle = rendered;
    }
    if (config.message && config.message.trim()) {
      const rendered = renderDmTemplate(config.message, variables).trim();
      if (rendered) outgoingDescription = rendered;
    }
  }

  const foundDBUser = await readminCollections.user.findOne({
    robloxId: robloxId.toString()
  });

  if (foundDBUser?.allowDiscordMessages == false) return;

  const DiscordID = foundDBUser?.discordId ? [foundDBUser?.discordId] : [];

  if (!DiscordID) {
    return { success: true, note: 'could not find user to dm.' }
  }
  const colors = EmebedColors[type || "blue"];

  for (const id of DiscordID) {
    await messageDiscordUser(
      id,
      outgoingTitle,
      outgoingDescription,
      footerOveride || "",
      colors
    );
  }

  return;
}