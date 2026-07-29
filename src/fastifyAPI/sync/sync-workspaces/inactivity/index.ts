import * as Roblox from '~/services/roblox.service';
import { readminCollections } from "~/services/mongo.service";
import { Workspace } from '~/services/NewMongoTypes';
import { addRoleDiscordUser, BloxlinkSearch, dmUserDiscord, removeRoleDiscordUser } from '~/services/discord.service';

export default async function SyncInactivity(workspace: Workspace) {
  try {
    const groupId = workspace.groupId;
    const now = new Date();

    // Query inactivity records and group info concurrently
    const [inactivityOver, inactivityStarting, groupInfo] = await Promise.all([
      readminCollections.inactivity.find({
        ends: { $lte: now },
        groupId,
        active: true,
      }).toArray(),
      readminCollections.inactivity.find({
        starts: { $lte: now },
        ends: { $gte: now },
        active: false,
        groupId,
      }).toArray(),
      Roblox.getGroupInfo(groupId),
    ]);

    // Combine userIds from both inactivity arrays into a Set to avoid duplicates,
    // then convert to an array for the MongoDB query.
    const userIds = [
      ...new Set([
        ...inactivityOver.map((a) => parseInt(a.userId)),
        ...inactivityStarting.map((a) => parseInt(a.userId)),
      ]),
    ];

    const members = await readminCollections.group_member.find({
      groupId,
      userId: { $in: userIds },
    }).toArray();

    // Update inactivity records concurrently
    await Promise.all([
      readminCollections.inactivity.updateMany(
        { _id: { $in: inactivityOver.map((a) => a._id) } },
        { $set: { active: false } }
      ),
      readminCollections.inactivity.updateMany(
        { _id: { $in: inactivityStarting.map((a) => a._id) } },
        { $set: { active: true } }
      ),
    ]);

    // Create a lookup map for members by userId for fast access
    const memberMap = new Map<string, typeof members[0]>();
    for (const member of members) {
      memberMap.set(member.userId.toString(), member);
    }

    // DM users whose inactivity is over
    for (const inactivity of inactivityOver) {
      if (memberMap.has(inactivity.userId.toString())) {
        dmUserDiscord(
          inactivity.userId.toString(),
          `You are no longer inactive at ${groupInfo?.displayName}`,
          "Welcome back!",
          undefined,
          undefined,
          { workspace, category: 'inactivity', variables: { groupName: groupInfo?.displayName } }
        );
        // remove inactivty role
        if (workspace.inactivityRole && workspace.inactivityRole !== 'disabled') {
          const integration = await readminCollections.discord_bots.findOne({ groupId: workspace.groupId });
          if (!integration) {
            continue;
          }
          const foundDBUser = await readminCollections.user.findOne({ robloxId: inactivity.userId.toString() });
          const DiscordID = foundDBUser?.discordId ? [foundDBUser?.discordId] : [];
          if (!DiscordID || DiscordID.length === 0) {
            continue;
          }
          for (const discordId of DiscordID) {
            await removeRoleDiscordUser(integration.guildId, discordId, workspace.inactivityRole);
          }
        }
      }
    }

    // DM users whose inactivity is starting
    for (const inactivity of inactivityStarting) {
      if (memberMap.has(inactivity.userId.toString())) {
        dmUserDiscord(
          inactivity.userId.toString(),
          `You are now inactive at ${groupInfo?.displayName}`,
          `Your return date is ${new Date(inactivity.ends).toLocaleDateString()}`,
          undefined,
          undefined,
          { workspace, category: 'inactivity', variables: { groupName: groupInfo?.displayName, returnDate: new Date(inactivity.ends).toLocaleDateString() } }
        );
        // add inactivty role
        if (workspace.inactivityRole && workspace.inactivityRole !== 'disabled') {
          const integration = await readminCollections.discord_bots.findOne({ groupId: workspace.groupId });
          if (!integration) {
            continue;
          }
          const foundDBUser = await readminCollections.user.findOne({ robloxId: inactivity.userId.toString() });
          const DiscordID = foundDBUser?.discordId ? [foundDBUser?.discordId] : [];
          if (!DiscordID || DiscordID.length === 0) {
            continue;
          }
          for (const discordId of DiscordID) {
            await addRoleDiscordUser(integration.guildId, discordId, workspace.inactivityRole);
          }
        }
      }
    }
  } catch (e) {
    console.log(e, 'inactivty sync')
  }
}
