import { ObjectId, WithId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { InGameSupportTicket, Workspace } from '~/services/NewMongoTypes';
import {
  createDiscordChannel,
  deleteDiscordChannel,
  modifyDiscordChannel,
  editChannelPermissions,
  sendGuildTextMessage,
  EmebedColors,
} from '~/services/discord.service';
import { getUserInfo, getUserThumbnail } from '~/services/roblox.service';

// Default in-game identity used when an agent replies from Discord without a
// linked Roblox account.
export const READMINAPP_ROBLOX_ID = 2611329969;
export const READMINAPP_NAME = 'ReAdminApp';

// Web panel base used for "view on ReAdmin" links inside the embed.
const PANEL_BASE_URL = 'https://panel.readmin.app';

// Discord permission bit flags (string math is avoided by combining as numbers).
const VIEW_CHANNEL = 1 << 10; // 1024
const SEND_MESSAGES = 1 << 11; // 2048
const READ_MESSAGE_HISTORY = 1 << 16; // 65536
const CHANNEL_ALLOW = (VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY).toString();

export type CallDiscordContext = {
  guildId: string;
  settings: NonNullable<Workspace['callDiscordSettings']>;
};

// Resolves the linked guild + call settings for a workspace. Returns null when
// the workspace has no linked bot or no call category configured, so callers can
// no-op gracefully.
export async function getCallDiscordContext(groupId: string): Promise<CallDiscordContext | null> {
  const [bot, workspace] = await Promise.all([
    readminCollections.discord_bots.findOne({ groupId }),
    readminCollections.workspace.findOne({ groupId }),
  ]);
  if (!bot?.guildId) return null;
  const settings = workspace?.callDiscordSettings;
  if (!settings?.categoryId) return null;
  return { guildId: bot.guildId, settings };
}

// Maps an interacting Discord user to the Roblox identity that messages should
// appear as in-game. Falls back to the ReAdminApp system user.
export async function resolveDiscordAgentIdentity(discordUserId: string | undefined): Promise<{ userId: number; username: string }> {
  if (discordUserId) {
    const user = await readminCollections.user.findOne({ discordId: discordUserId });
    if (user?.robloxId) {
      return { userId: parseInt(user.robloxId), username: user.name || READMINAPP_NAME };
    }
  }
  return { userId: READMINAPP_ROBLOX_ID, username: READMINAPP_NAME };
}

// Creates a private Discord channel for a freshly opened call and posts the
// info embed (caller, reason, game/join link, call link) with Claim/Close
// buttons. Stores the channel id on the ticket. Safe to fire-and-forget.
export async function createCallDiscordChannel(ticketId: ObjectId): Promise<string | null> {
  const ticket = await readminCollections.in_game_support_ticket.findOne({ _id: ticketId });
  if (!ticket) return null;
  if (ticket.discordChannelId) return ticket.discordChannelId;

  const ctx = await getCallDiscordContext(ticket.groupId);
  if (!ctx) return null;

  const [callerInfo, callerThumbnail, gameInfo] = await Promise.all([
    getUserInfo(ticket.callerId).catch(() => null),
    getUserThumbnail(ticket.callerId).catch(() => undefined),
    readminCollections.game.findOne({
      groupId: ticket.groupId,
      gameId: ticket.gameId,
      placeId: ticket.placeId,
    }).catch(() => null),
  ]);

  const callerName = (callerInfo as any)?.name || ticket.callerId.toString();
  const joinLink = `https://www.roblox.com/games/start?placeId=${ticket.placeId}&launchData=ReAdmin-Support`;
  const callLink = `${PANEL_BASE_URL}/workspaces/${ticket.groupId}/calls`;

  // @everyone is denied view; each configured role is granted view/send/history.
  const permission_overwrites: any[] = [
    { id: ctx.guildId, type: 0, deny: VIEW_CHANNEL.toString() },
    ...ctx.settings.accessRoleIds.map((roleId) => ({ id: roleId, type: 0, allow: CHANNEL_ALLOW })),
  ];

  const channel = await createDiscordChannel(ctx.guildId, {
    name: `call-${callerName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
    type: 0,
    parent_id: ctx.settings.categoryId,
    topic: `ReAdmin support call • Caller ${callerName} (${ticket.callerId})`,
    permission_overwrites,
  });

  if (!channel?.id) return null;

  // Re-apply the access-role overwrites against the created channel. When a
  // channel is created under a category, Discord validates the create-time
  // overwrites against the parent category's permission context; if the category
  // denies SEND_MESSAGES, that bit is silently stripped (leaving only view/read
  // history). Editing permissions after creation evaluates against the channel
  // itself, so SEND_MESSAGES reliably sticks.
  await Promise.all(
    ctx.settings.accessRoleIds.map((roleId) =>
      editChannelPermissions(channel.id, roleId, { type: 0, allow: CHANNEL_ALLOW }).catch((e) =>
        console.error('editChannelPermissions (call access role) failed', roleId, e),
      ),
    ),
  );

  const fields: any[] = [
    { name: 'Caller', value: `[${callerName}](https://roblox.com/users/${ticket.callerId}/profile) (${ticket.callerId})`, inline: true },
    { name: 'Type', value: ticket.type === 'report' ? 'Report' : 'Support', inline: true },
    { name: 'Game', value: gameInfo?.name || 'Unknown Game', inline: true },
    { name: 'Reason', value: ticket.reason || 'No reason provided' },
  ];
  if (ticket.reportedUser) {
    fields.push({ name: 'Reported User', value: ticket.reportedUser });
  }
  fields.push({ name: 'Links', value: `[Join Game](${joinLink}) • [View on ReAdmin](${callLink})` });

  await sendGuildTextMessage(channel.id, {
    embeds: [
      {
        title: 'New Support Call',
        description: `A new ${ticket.type} call has been opened. Reply with \`/reply\` to message the user in-game.`,
        color: ticket.type === 'report' ? EmebedColors.red : EmebedColors.blue,
        fields,
        ...(callerThumbnail ? { thumbnail: { url: callerThumbnail } } : {}),
        footer: { text: 'Powered by ReAdmin. This content is not endorsed by ReAdmin, LLC.' },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Claim', custom_id: `CALL-CLAIM-${ticket._id.toString()}` },
          { type: 2, style: 4, label: 'Close', custom_id: `CALL-CLOSE-${ticket._id.toString()}` },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  });

  await readminCollections.in_game_support_ticket.updateOne(
    { _id: ticket._id },
    { $set: { discordChannelId: channel.id } },
  );

  return channel.id;
}

type MirrorKind = 'user' | 'agent' | 'system';

// Mirrors a ticket message into the Discord call channel. Never called for
// messages that originated from Discord (those are already in the channel).
export async function mirrorCallMessageToDiscord(
  channelId: string | undefined,
  payload: { username: string; message: string; kind: MirrorKind },
): Promise<void> {
  if (!channelId) return;
  const prefix = payload.kind === 'user'
    ? `**${payload.username}** (in-game):`
    : payload.kind === 'agent'
      ? `**${payload.username}** (agent):`
      : '';
  const content = payload.kind === 'system'
    ? `*${payload.message}*`
    : `${prefix} ${payload.message}`;
  try {
    await sendGuildTextMessage(channelId, {
      content: content.slice(0, 1900),
      allowed_mentions: { parse: [] },
    });
  } catch (e) {
    console.error('mirrorCallMessageToDiscord failed', e);
  }
}

// Handles the Discord channel when a call is closed: delete it or move it to the
// configured archive category. Safe to call even when Discord is not configured.
export async function handleCallDiscordClose(ticket: Pick<WithId<InGameSupportTicket>, 'groupId' | 'discordChannelId'>): Promise<void> {
  if (!ticket.discordChannelId) return;
  const ctx = await getCallDiscordContext(ticket.groupId);
  if (!ctx) return;
  try {
    if (ctx.settings.closeAction === 'move' && ctx.settings.archiveCategoryId) {
      await mirrorCallMessageToDiscord(ticket.discordChannelId, {
        username: '',
        message: 'This call has been closed and archived.',
        kind: 'system',
      });
      await modifyDiscordChannel(ticket.discordChannelId, {
        parent_id: ctx.settings.archiveCategoryId,
        // Lock the channel from further sending once archived.
        permission_overwrites: [
          { id: ctx.guildId, type: 0, deny: (VIEW_CHANNEL | SEND_MESSAGES).toString() },
          ...ctx.settings.accessRoleIds.map((roleId) => ({
            id: roleId,
            type: 0,
            allow: (VIEW_CHANNEL | READ_MESSAGE_HISTORY).toString(),
            deny: SEND_MESSAGES.toString(),
          })),
        ],
      });
    } else {
      await deleteDiscordChannel(ticket.discordChannelId);
    }
  } catch (e) {
    console.error('handleCallDiscordClose failed', e);
  }
}
