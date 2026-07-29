import {
  FlowActionType,
  FlowTriggerType,
} from '~/services/NewMongoTypes/Flow.type';

// ─────────────────────────────────────────────────────────────────────────────
// Flow registry — single source of truth describing the available triggers and
// actions. Drives builder UI rendering, the autocomplete of available `{{tokens}}`
// and `field` paths, and server-side validation.
// ─────────────────────────────────────────────────────────────────────────────

export type FlowFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'boolean'
  | 'user'
  | 'role'
  | 'channel';

/** A configurable input for a trigger or an action. */
export type FlowConfigField = {
  key: string;
  label: string;
  type: FlowFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
  default?: string | number | boolean;
  /** Only show this field when another config field has one of these values. */
  showIf?: { key: string; equals: string | string[] };
};

/**
 * How a condition's value should be entered for a given context field. Lets the
 * builder render a smart input — a true/false dropdown for booleans, a role
 * picker for roblox roles, a channel picker for discord channels, etc. — instead
 * of a raw text box.
 */
export type FlowValueType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'role'
  | 'channel'
  | 'department'
  | 'goal'
  | 'enum';

/** A token path a trigger exposes to conditions and `{{templates}}`. */
export type FlowContextField = {
  path: string;
  label: string;
  /** Drives the smart condition value input. Defaults to 'text'. */
  valueType?: FlowValueType;
  /** Choices when valueType is 'enum'. */
  options?: { label: string; value: string }[];
};

export type FlowTriggerDefinition = {
  type: FlowTriggerType;
  label: string;
  description: string;
  category: string;
  /** Whether this trigger can drive an accumulator (count-N-over-window). */
  supportsAccumulator: boolean;
  /** Token paths this trigger makes available in conditions / templates. */
  contextFields: FlowContextField[];
  config?: FlowConfigField[];
};

export type FlowActionDefinition = {
  type: FlowActionType;
  label: string;
  description: string;
  category: string;
  /** Destructive actions are gated behind the owner's permission ceiling. */
  destructive?: boolean;
  config: FlowConfigField[];
};

// Common subject/actor context fields every trigger exposes.
const BASE_CONTEXT: FlowContextField[] = [
  { path: 'subject.userId', label: 'Subject Roblox ID' },
  { path: 'subject.displayName', label: 'Subject display name' },
  { path: 'subject.rank', label: 'Subject rank number', valueType: 'number' },
  { path: 'subject.tenureDays', label: 'Subject days in group', valueType: 'number' },
  { path: 'subject.departments', label: 'Subject is in department', valueType: 'department' },
  { path: 'actor.userId', label: 'Actor Roblox ID' },
  { path: 'actor.displayName', label: 'Actor display name' },
  { path: 'actor.rank', label: 'Actor rank number', valueType: 'number' },
  { path: 'actor.departments', label: 'Actor is in department', valueType: 'department' },
];

export const FLOW_TRIGGERS: FlowTriggerDefinition[] = [
  {
    type: 'writeup.created',
    label: 'Write-up created',
    description:
      'Fires when any disciplinary action (warning, suspension, termination, demotion or promotion) is logged.',
    category: 'Discipline & Rank',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      {
        path: 'event.writeUp.type',
        label: 'Type (writeup/suspension/...)',
        valueType: 'enum',
        options: [
          { label: 'Warning', value: 'writeup' },
          { label: 'Suspension', value: 'suspension' },
          { label: 'Termination', value: 'termination' },
          { label: 'Demotion', value: 'demotion' },
          { label: 'Promotion', value: 'promotion' },
        ],
      },
      { path: 'event.writeUp.reason', label: 'Reason' },
      { path: 'event.writeUp.notify', label: 'Notified the user', valueType: 'boolean' },
    ],
  },
  {
    type: 'promotionRequest.created',
    label: 'Promotion request created',
    description: 'Fires when a member submits or is submitted for a promotion.',
    category: 'Discipline & Rank',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.promotionRequest.toRank', label: 'Requested rank' },
      { path: 'event.promotionRequest.toRankName', label: 'Requested role name' },
      { path: 'event.promotionRequest.reason', label: 'Reason' },
    ],
  },
  {
    type: 'promotionRequest.accepted',
    label: 'Promotion request accepted',
    description: 'Fires when a promotion request is approved.',
    category: 'Discipline & Rank',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.promotionRequest.toRank', label: 'Approved rank' },
      { path: 'event.promotionRequest.toRankName', label: 'Approved role name' },
      { path: 'event.promotionRequest.rankedTo', label: 'Ranked-to role name' },
    ],
  },
  {
    type: 'promotionRequest.declined',
    label: 'Promotion request declined',
    description: 'Fires when a promotion request is declined.',
    category: 'Discipline & Rank',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.promotionRequest.reason', label: 'Decline reason' },
    ],
  },
  {
    type: 'promotionRequest.voted',
    label: 'Promotion request — vote cast',
    description:
      'Fires each time someone votes on a promotion request. Filter on the running support/oppose tally to act once a request reaches enough sign-offs (e.g. promote after 5 support votes).',
    category: 'Discipline & Rank',
    supportsAccumulator: false,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.promotionRequest.toRank', label: 'Requested role id' },
      { path: 'event.promotionRequest.toRankName', label: 'Requested role name' },
      { path: 'event.vote.choice', label: 'This vote (support/oppose)', valueType: 'enum', options: [
        { label: 'Support', value: 'support' },
        { label: 'Oppose', value: 'oppose' },
      ] },
      { path: 'event.votes.support', label: 'Support votes so far', valueType: 'number' },
      { path: 'event.votes.oppose', label: 'Oppose votes so far', valueType: 'number' },
      { path: 'event.votes.total', label: 'Total votes so far', valueType: 'number' },
    ],
  },
  {
    type: 'member.joined',
    label: 'Member joined',
    description: 'Fires when a user joins the group (detected on the next member sync).',
    category: 'Membership',
    supportsAccumulator: false,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.role.to', label: 'Joined into role id' },
      { path: 'event.rank.to', label: 'Joined into rank number', valueType: 'number' },
    ],
  },
  {
    type: 'member.left',
    label: 'Member left',
    description: 'Fires when a user leaves the group (detected on the next member sync).',
    category: 'Membership',
    supportsAccumulator: false,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.role.from', label: 'Left from role id' },
      { path: 'event.rank.from', label: 'Left from rank number', valueType: 'number' },
    ],
  },
  {
    type: 'member.promoted',
    label: 'Member promoted',
    description:
      'Fires when a member is promoted to a higher rank (detected on the next member sync). Great for an automatic "you have been promoted" message.',
    category: 'Membership',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.role.from', label: 'Previous role id' },
      { path: 'event.role.to', label: 'New role id' },
      { path: 'event.rank.from', label: 'Previous rank number', valueType: 'number' },
      { path: 'event.rank.to', label: 'New rank number', valueType: 'number' },
    ],
  },
  {
    type: 'member.demoted',
    label: 'Member demoted',
    description:
      'Fires when a member is demoted to a lower rank (detected on the next member sync). Use it to message the member or log the change.',
    category: 'Membership',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.role.from', label: 'Previous role id' },
      { path: 'event.role.to', label: 'New role id' },
      { path: 'event.rank.from', label: 'Previous rank number', valueType: 'number' },
      { path: 'event.rank.to', label: 'New rank number', valueType: 'number' },
    ],
  },
  {
    type: 'member.roleAdded',
    label: 'Member gained a role',
    description:
      'Fires when a member gains a Roblox role while keeping their others (detected on the next member sync). A member can hold several roles — use "Member promoted" instead if you only care about their highest rank going up.',
    category: 'Membership',
    supportsAccumulator: false,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.role.id', label: 'Role id gained' },
      { path: 'event.role.to', label: 'Highest role id after the change' },
      { path: 'event.rank.to', label: 'Highest rank number after the change', valueType: 'number' },
    ],
  },
  {
    type: 'member.roleRemoved',
    label: 'Member lost a role',
    description:
      'Fires when a member loses one of their Roblox roles but stays in the group (detected on the next member sync). Use "Member left" for someone leaving entirely.',
    category: 'Membership',
    supportsAccumulator: false,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.role.id', label: 'Role id lost' },
      { path: 'event.role.to', label: 'Highest role id after the change' },
      { path: 'event.rank.to', label: 'Highest rank number after the change', valueType: 'number' },
    ],
  },
  {
    type: 'distribution.evaluated',
    label: 'Distribution — new distribution occurred (per member)',
    description:
      'Fires for every member when a new distribution starts and the previous period is scored. Filter on raw minutes played / active minutes / messages / sessions, whether they met each goal, and whether they were on approved time off or an inactivity notice.',
    category: 'Activity & Distribution',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.distribution', label: 'Distribution number', valueType: 'number' },
      { path: 'event.goalId', label: 'Which goal', valueType: 'goal' },
      { path: 'event.goalName', label: 'Goal name' },
      { path: 'event.metAll', label: 'Met the whole goal', valueType: 'boolean' },
      { path: 'event.failedAny', label: 'Failed any requirement', valueType: 'boolean' },
      { path: 'event.minutes.at', label: 'Minutes played', valueType: 'number' },
      { path: 'event.minutes.goal', label: 'Minutes required', valueType: 'number' },
      { path: 'event.minutes.metGoal', label: 'Met minutes goal', valueType: 'boolean' },
      { path: 'event.activeMinutes.at', label: 'Active minutes', valueType: 'number' },
      { path: 'event.activeMinutes.goal', label: 'Active minutes required', valueType: 'number' },
      { path: 'event.activeMinutes.metGoal', label: 'Met active minutes goal', valueType: 'boolean' },
      { path: 'event.messages.at', label: 'Messages sent', valueType: 'number' },
      { path: 'event.messages.goal', label: 'Messages required', valueType: 'number' },
      { path: 'event.messages.metGoal', label: 'Met messages goal', valueType: 'boolean' },
      { path: 'event.sessions.at', label: 'Sessions attended', valueType: 'number' },
      { path: 'event.sessions.goal', label: 'Sessions required', valueType: 'number' },
      { path: 'event.sessions.metGoal', label: 'Met sessions goal', valueType: 'boolean' },
      { path: 'event.onTimeOff', label: 'On approved time off', valueType: 'boolean' },
      { path: 'event.onInactivity', label: 'On inactivity notice', valueType: 'boolean' },
      {
        path: 'event.failedWhileOnTimeOff',
        label: 'Missed requirements while on time off',
        valueType: 'boolean',
      },
      {
        path: 'event.failedWithoutTimeOff',
        label: 'Missed requirements without time off',
        valueType: 'boolean',
      },
    ],
  },
  {
    type: 'goal.met',
    label: 'Goal met (member met all requirements)',
    description:
      "Fires for a member when a distribution closes and they met every requirement of one of their activity goals. Filter on 'Which goal' to scope this to a specific goal (e.g. only the Moderator goal).",
    category: 'Activity & Distribution',
    supportsAccumulator: true,
    contextFields: [
      ...BASE_CONTEXT,
      { path: 'event.distribution', label: 'Distribution number', valueType: 'number' },
      { path: 'event.goalId', label: 'Which goal', valueType: 'goal' },
      { path: 'event.goalName', label: 'Goal name' },
      { path: 'event.minutes.at', label: 'Minutes played', valueType: 'number' },
      { path: 'event.minutes.goal', label: 'Minutes required', valueType: 'number' },
      { path: 'event.activeMinutes.at', label: 'Active minutes', valueType: 'number' },
      { path: 'event.activeMinutes.goal', label: 'Active minutes required', valueType: 'number' },
      { path: 'event.messages.at', label: 'Messages sent', valueType: 'number' },
      { path: 'event.messages.goal', label: 'Messages required', valueType: 'number' },
      { path: 'event.sessions.at', label: 'Sessions attended', valueType: 'number' },
      { path: 'event.sessions.goal', label: 'Sessions required', valueType: 'number' },
      { path: 'event.onTimeOff', label: 'On approved time off', valueType: 'boolean' },
      { path: 'event.onInactivity', label: 'On inactivity notice', valueType: 'boolean' },
    ],
  },
  {
    type: 'distribution.started',
    label: 'Distribution — new period started (announcement)',
    description:
      'Fires once when a new distribution period opens for the workspace. Has no subject; good for announcements or scheduled resets.',
    category: 'Activity & Distribution',
    supportsAccumulator: false,
    contextFields: [
      { path: 'event.distribution', label: 'New distribution number', valueType: 'number' },
      { path: 'event.previousDistribution', label: 'Previous distribution number', valueType: 'number' },
    ],
  },
  {
    type: 'schedule',
    label: 'On a schedule',
    description:
      'Fires on a recurring schedule. Requires the scheduler runner (see follow-ups).',
    category: 'Time',
    supportsAccumulator: false,
    contextFields: [],
    config: [
      {
        key: 'cron',
        label: 'Cron expression',
        type: 'text',
        required: true,
        placeholder: '0 9 * * 1',
        help: 'Standard 5-field cron. Example: 0 9 * * 1 = every Monday at 09:00.',
      },
    ],
  },
];

export const FLOW_ACTIONS: FlowActionDefinition[] = [
  {
    type: 'discord.webhook',
    label: 'Send Discord message',
    description: 'Post a templated embed to a Discord webhook URL.',
    category: 'Notifications',
    config: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Flow triggered' },
      { key: 'message', label: 'Message', type: 'text', required: true, placeholder: '{{subject.displayName}} reached the threshold.' },
      {
        key: 'color', label: 'Color', type: 'select', default: 'blue',
        options: [
          { label: 'Blue', value: 'blue' },
          { label: 'Red', value: 'red' },
          { label: 'Green', value: 'green' },
          { label: 'Yellow', value: 'yellow' },
        ],
      },
    ],
  },
  {
    type: 'discord.dm',
    label: 'Send Discord DM to user',
    description:
      'Direct-message the subject user on Discord (only if they have linked their account).',
    category: 'Notifications',
    config: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Heads up from {{flow.name}}' },
      { key: 'message', label: 'Message', type: 'text', required: true, placeholder: '{{subject.displayName}}, you missed your activity goal this distribution.' },
      {
        key: 'color', label: 'Color', type: 'select', default: 'blue',
        options: [
          { label: 'Blue', value: 'blue' },
          { label: 'Red', value: 'red' },
          { label: 'Green', value: 'green' },
          { label: 'Yellow', value: 'yellow' },
        ],
      },
    ],
  },
  {
    type: 'discord.channel',
    label: 'Send Discord channel message',
    description: 'Post a templated embed to a channel in your linked Discord server.',
    category: 'Notifications',
    config: [
      { key: 'channelId', label: 'Channel', type: 'channel', required: true, help: 'Pick a channel in your linked server.' },
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Flow triggered' },
      { key: 'message', label: 'Message', type: 'text', required: true, placeholder: '{{subject.displayName}} reached the threshold.' },
      {
        key: 'color', label: 'Color', type: 'select', default: 'blue',
        options: [
          { label: 'Blue', value: 'blue' },
          { label: 'Red', value: 'red' },
          { label: 'Green', value: 'green' },
          { label: 'Yellow', value: 'yellow' },
        ],
      },
    ],
  },
  {
    type: 'user.addNote',
    label: 'Add user note',
    description: 'Attach a note to the subject user.',
    category: 'ReAdmin',
    config: [
      { key: 'note', label: 'Note', type: 'text', required: true, placeholder: 'Auto-flagged by flow: {{flow.name}}' },
    ],
  },
  {
    type: 'user.addTag',
    label: 'Add tag',
    description: 'Add a workspace tag to the subject user.',
    category: 'ReAdmin',
    config: [
      { key: 'tagId', label: 'Tag', type: 'select', required: true, options: [], help: 'Pick a workspace tag.' },
    ],
  },
  {
    type: 'user.removeTag',
    label: 'Remove tag',
    description: 'Remove a workspace tag from the subject user.',
    category: 'ReAdmin',
    config: [
      { key: 'tagId', label: 'Tag', type: 'select', required: true, options: [], help: 'Pick a workspace tag.' },
    ],
  },
  {
    type: 'task.create',
    label: 'Create task',
    description: 'Create a task on the workspace board.',
    category: 'ReAdmin',
    config: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Follow up on {{subject.displayName}}' },
      { key: 'description', label: 'Description', type: 'text', placeholder: 'Triggered by {{flow.name}}' },
      {
        key: 'priority', label: 'Priority', type: 'select', default: 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
          { label: 'Urgent', value: 'urgent' },
        ],
      },
    ],
  },
  {
    type: 'feed.post',
    label: 'Post to feed',
    description: 'Publish a message to the workspace feed.',
    category: 'ReAdmin',
    config: [
      { key: 'message', label: 'Message', type: 'text', required: true, placeholder: '{{subject.displayName}} was auto-flagged.' },
    ],
  },
  {
    type: 'discipline.create',
    label: 'Create write-up (discipline)',
    description: 'Issue a warning, suspension, termination or demotion to the subject.',
    category: 'Discipline & Rank',
    destructive: true,
    config: [
      {
        key: 'type', label: 'Type', type: 'select', required: true, default: 'writeup',
        options: [
          { label: 'Warning', value: 'writeup' },
          { label: 'Suspension', value: 'suspension' },
          { label: 'Termination', value: 'termination' },
          { label: 'Demotion', value: 'demotion' },
        ],
      },
      { key: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'Reached {{accumulator.count}} infractions.' },
      { key: 'notify', label: 'Notify the user', type: 'boolean', default: false },
    ],
  },
  {
    type: 'rank.set',
    label: 'Change rank',
    description:
      'Set the subject to a specific role, or move them a number of ranks up (promote) or down (demote) relative to their current rank.',
    category: 'Discipline & Rank',
    destructive: true,
    config: [
      {
        key: 'mode', label: 'How to change the rank', type: 'select', required: true, default: 'absolute',
        options: [
          { label: 'Set to a specific rank', value: 'absolute' },
          { label: 'Promote — move up by…', value: 'up' },
          { label: 'Demote — move down by…', value: 'down' },
        ],
      },
      {
        key: 'rankId', label: 'Target role', type: 'role', required: true,
        help: 'The group role to set the user to.',
        showIf: { key: 'mode', equals: 'absolute' },
      },
      {
        key: 'steps', label: 'Number of ranks to move', type: 'number', default: 1,
        help: 'e.g. 1 = the next role up or down from where they are now.',
        showIf: { key: 'mode', equals: ['up', 'down'] },
      },
      { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Auto rank change by flow.' },
    ],
  },
  {
    type: 'promotionRequest.resolve',
    label: 'Approve / decline promotion request',
    description:
      "Approve or decline the subject's open promotion request. Approving can also rank them to the requested role. Pairs with the 'Promotion vote cast' trigger (e.g. approve once it has enough support votes).",
    category: 'Discipline & Rank',
    destructive: true,
    config: [
      {
        key: 'decision', label: 'Decision', type: 'select', required: true, default: 'approve',
        options: [
          { label: 'Approve', value: 'approve' },
          { label: 'Decline', value: 'decline' },
        ],
      },
      {
        key: 'rankOnApprove', label: 'Promote to the requested rank on approval', type: 'boolean', default: true,
        help: 'When approving, also rank the user to the role the request was for.',
        showIf: { key: 'decision', equals: 'approve' },
      },
      { key: 'reason', label: 'Reason / comment', type: 'text', placeholder: 'Approved automatically after reaching the required votes.' },
    ],
  },
  {
    type: 'game.queueAction',
    label: 'Queue in-game action',
    description: 'Kick or notify the subject in whichever of your games they are currently in.',
    category: 'Games',
    destructive: true,
    config: [
      {
        key: 'type', label: 'Action', type: 'select', required: true, default: 'notify',
        options: [
          { label: 'Notify', value: 'notify' },
          { label: 'Kick', value: 'kick' },
        ],
      },
      { key: 'message', label: 'Message', type: 'text', required: true, placeholder: 'You have been flagged. Please contact staff.' },
    ],
  },
];

export function getTriggerDefinition(type: FlowTriggerType) {
  return FLOW_TRIGGERS.find((t) => t.type === type);
}

export function getActionDefinition(type: FlowActionType) {
  return FLOW_ACTIONS.find((a) => a.type === type);
}

/** Set of action types that require the owner's permission ceiling check. */
export const DESTRUCTIVE_ACTIONS = new Set<FlowActionType>(
  FLOW_ACTIONS.filter((a) => a.destructive).map((a) => a.type),
);
