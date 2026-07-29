import { readminCollections } from '~/services/mongo.service';
import { getGroupInfoFresh } from '~/services/roblox.service';
import { sendWebhookMessage } from '~/services/discord.service';
import {
  buildMilestoneMessage,
  crossedMilestone,
  DEFAULT_MILESTONE_STEP,
} from '~/services/memberMilestone.service';

// Polls Roblox for the live member count of every workspace that has enabled the
// "group member counting" feature and posts a Discord message when the count has
// grown since the previous poll. Designed to run on a ~10 minute cron.
//
// Posting rules:
//   - The very first observed count only establishes a baseline (no message).
//   - When the count crosses a multiple of `milestoneStep` and milestone posts
//     are enabled, the milestone message is sent.
//   - Otherwise, if growth posts are enabled, the growth message is sent on any
//     poll where the count increased.
export const syncMemberMilestones = async () => {
  console.log('Polling group member milestones');

  const configs = await readminCollections.group_member_milestone
    .find({ enabled: true })
    .toArray();

  if (configs.length === 0) {
    console.log('No member milestone configs to poll');
    return true;
  }

  for (const config of configs) {
    try {
      const groupInfo = await getGroupInfoFresh(config.groupId);
      if (!groupInfo || typeof groupInfo.memberCount !== 'number') {
        continue;
      }

      const currentCount = groupInfo.memberCount;
      const previousCount = config.lastMemberCount;
      const step = config.milestoneStep || DEFAULT_MILESTONE_STEP;
      const now = new Date();

      // First poll for this config — just record the baseline so we never post a
      // spurious message on initial setup.
      if (previousCount === undefined) {
        await readminCollections.group_member_milestone.updateOne(
          { _id: config._id },
          { $set: { lastMemberCount: currentCount, lastPolledAt: now } },
        );
        continue;
      }

      const grew = currentCount > previousCount;
      const isMilestone = grew && config.milestoneEnabled && crossedMilestone(previousCount, currentCount, step);
      // Milestone posts take priority; fall back to a growth post if enabled.
      const postType: 'milestone' | 'growth' | null = isMilestone
        ? 'milestone'
        : (grew && config.growthEnabled ? 'growth' : null);

      if (postType && config.webhookUrl) {
        // Use the count the last message was sent at (falling back to the prior
        // poll) so the "gained" delta reflects growth since the last post.
        const baselineForDelta = config.lastPostedCount ?? previousCount;
        const { title, description } = buildMilestoneMessage(
          config,
          postType,
          currentCount,
          baselineForDelta,
          groupInfo.displayName,
        );
        try {
          await sendWebhookMessage(
            config.webhookUrl,
            postType === 'milestone' ? 'green' : 'blue',
            title,
            description,
            undefined,
            undefined,
            undefined,
            { timestamp: now, footerText: `${groupInfo.displayName} • Powered by ReAdmin` },
          );
          await readminCollections.group_member_milestone.updateOne(
            { _id: config._id },
            { $set: { lastMemberCount: currentCount, lastPostedCount: currentCount, lastPolledAt: now } },
          );
        } catch (postErr) {
          console.error(`Failed posting member milestone for group ${config.groupId}`, postErr);
          // Still advance lastMemberCount so we don't re-post the same growth.
          await readminCollections.group_member_milestone.updateOne(
            { _id: config._id },
            { $set: { lastMemberCount: currentCount, lastPolledAt: now } },
          );
        }
      } else {
        await readminCollections.group_member_milestone.updateOne(
          { _id: config._id },
          { $set: { lastMemberCount: currentCount, lastPolledAt: now } },
        );
      }
    } catch (err) {
      console.error(`Error polling member milestone for group ${config.groupId}`, err);
    }
  }

  console.log('Finished polling group member milestones');
  return true;
};
