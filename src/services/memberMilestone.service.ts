import { GroupMemberMilestone } from '~/services/NewMongoTypes/GroupMemberMilestone.type';

// Default messages used when a workspace has not supplied a custom template.
export const DEFAULT_GROWTH_TEMPLATE =
  "We've reached **{count}** members! ({gained} new since the last update)";
export const DEFAULT_MILESTONE_TEMPLATE =
  "🎉 We hit **{count}** members! Only {awayFromMilestone} more to {nextMilestone}.";

export const DEFAULT_MILESTONE_STEP = 1000;

export type MilestoneMessageType = 'growth' | 'milestone';

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

// Smallest multiple of `step` strictly greater than `count`. With count=410,259
// and step=1000 this returns 411,000.
export function computeNextMilestone(count: number, step: number): number {
  const safeStep = step > 0 ? step : DEFAULT_MILESTONE_STEP;
  return (Math.floor(count / safeStep) + 1) * safeStep;
}

// Whether `current` crossed at least one `step` boundary relative to `previous`.
export function crossedMilestone(previous: number, current: number, step: number): boolean {
  const safeStep = step > 0 ? step : DEFAULT_MILESTONE_STEP;
  return Math.floor(current / safeStep) > Math.floor(previous / safeStep);
}

export function renderMilestoneTemplate(
  template: string,
  variables: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

// Builds the title + description for a member-count post. `previousCount` is the
// member count the last message was sent at (used for the "gained" delta).
export function buildMilestoneMessage(
  config: Pick<GroupMemberMilestone, 'growthTemplate' | 'milestoneTemplate' | 'milestoneStep'>,
  type: MilestoneMessageType,
  currentCount: number,
  previousCount: number | undefined,
  groupName: string | undefined,
): { title: string; description: string } {
  const step = config.milestoneStep || DEFAULT_MILESTONE_STEP;
  const nextMilestone = computeNextMilestone(currentCount, step);
  const awayFromMilestone = Math.max(0, nextMilestone - currentCount);
  const gained = previousCount !== undefined ? Math.max(0, currentCount - previousCount) : 0;

  const variables: Record<string, string | number> = {
    count: formatNumber(currentCount),
    countRaw: Math.round(currentCount),
    gained: formatNumber(gained),
    previous: previousCount !== undefined ? formatNumber(previousCount) : formatNumber(currentCount),
    milestoneStep: formatNumber(step),
    nextMilestone: formatNumber(nextMilestone),
    awayFromMilestone: formatNumber(awayFromMilestone),
    groupName: groupName || 'the group',
  };

  if (type === 'milestone') {
    const template = config.milestoneTemplate?.trim() ? config.milestoneTemplate : DEFAULT_MILESTONE_TEMPLATE;
    return { title: '🎉 New Member Milestone', description: renderMilestoneTemplate(template, variables) };
  }

  const template = config.growthTemplate?.trim() ? config.growthTemplate : DEFAULT_GROWTH_TEMPLATE;
  return { title: 'Member Count Update', description: renderMilestoneTemplate(template, variables) };
}

