import { ObjectId } from 'mongodb';
import { RESTGetAPIWebhookResult } from 'discord-api-types/v10';

// Per-workspace configuration for the "group member counting" feature. The sync
// service polls Roblox every 10 minutes for the group's member count and, when
// the count has grown since the previous poll, posts an (optionally templated)
// message to the configured Discord webhook.
//
// Two independent announcement types can be toggled:
//   - growth:    posted on every poll where the member count increased.
//   - milestone: posted only when the count crosses a multiple of `milestoneStep`
//                (e.g. passes 411,000). Uses its own template.
//
// Supported template placeholders (rendered via {placeholder} syntax):
//   {count}             — current member count, locale formatted (e.g. 410,259)
//   {countRaw}          — current member count, no formatting (e.g. 410259)
//   {gained}            — members gained since the last poll, locale formatted
//   {previous}          — previous member count, locale formatted
//   {milestoneStep}     — the configured milestone interval, locale formatted
//   {nextMilestone}     — next milestone boundary, locale formatted (e.g. 411,000)
//   {awayFromMilestone} — members remaining until the next milestone, formatted
//   {groupName}         — the group's name
export type GroupMemberMilestone = {
  _id?: ObjectId;
  groupId: string;
  // Master switch — when false the poller skips this workspace entirely.
  enabled: boolean;
  webhookUrl: string;
  // Cached metadata about the webhook (name / avatar / channel) for the UI.
  webhookInfo?: RESTGetAPIWebhookResult;

  // Regular growth announcements (any time the count increased).
  growthEnabled: boolean;
  growthTemplate?: string;

  // Milestone announcements (crossing a multiple of `milestoneStep`).
  milestoneEnabled: boolean;
  // The interval used to compute milestone boundaries and the distance to the
  // next one (e.g. 1000 → next multiple of 1000). Defaults to 1000.
  milestoneStep: number;
  milestoneTemplate?: string;

  // Last member count observed by the poller (baseline; no message is posted on
  // the very first poll so the workspace doesn't get a spurious notification).
  lastMemberCount?: number;
  // The member count at the time of the most recent posted message — used to
  // compute the per-message "gained" delta.
  lastPostedCount?: number;
  lastPolledAt?: Date;
  created: Date;
};
