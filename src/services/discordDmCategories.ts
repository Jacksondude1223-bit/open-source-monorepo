import type { DiscordDmCategory } from '~/services/NewMongoTypes/Workspace.type';

// Single source of truth describing each automated Discord DM category: the
// human-readable copy shown in the Notifications settings UI, the built-in
// default title/message (rendered as placeholder text so admins know what they
// are overriding), and the {variable} placeholders that are available to custom
// templates for that category. Keep `id`s in sync with the DiscordDmCategory
// union and with the `variables` passed at each dmUserDiscord call site.
export interface DiscordDmCategoryMeta {
  id: DiscordDmCategory;
  title: string;
  description: string;
  defaultTitle: string;
  defaultMessage: string;
  variables: { name: string; description: string }[];
}

export const DISCORD_DM_CATEGORIES: DiscordDmCategory[] = [
  'sessionTracking',
  'sessionSummary',
  'distributionSummary',
  'inactivity',
  'moderation',
  'taskReminders',
  'sessionReminders',
  'applications',
];

export const DISCORD_DM_CATEGORY_META: DiscordDmCategoryMeta[] = [
  {
    id: 'sessionTracking',
    title: 'Session tracking started',
    description:
      'DM staff when they join a game and their playtime starts being tracked.',
    defaultTitle: 'Your time is now being tracked at {groupName}.',
    defaultMessage:
      'We will continue to track your session until you leave, and then we will send you an updated summary.',
    variables: [{ name: 'groupName', description: 'Your group / workspace name' }],
  },
  {
    id: 'sessionSummary',
    title: 'Session summary',
    description:
      'DM a breakdown of minutes and messages when a member finishes a session.',
    defaultTitle: 'Your playing time is no longer being tracked at {groupName}!',
    defaultMessage:
      'Total Minutes: {totalMinutes}\nActive Minutes: {activeMinutes}\nIdle Minutes: {idleMinutes}\nTyping Minutes: {typingMinutes}\nTotal Messages: {messages}',
    variables: [
      { name: 'groupName', description: 'Your group / workspace name' },
      { name: 'totalMinutes', description: 'Total minutes played this session' },
      { name: 'activeMinutes', description: 'Active minutes this session' },
      { name: 'idleMinutes', description: 'Idle minutes this session' },
      { name: 'typingMinutes', description: 'Typing minutes this session' },
      { name: 'messages', description: 'Chat messages sent this session' },
    ],
  },
  {
    id: 'distributionSummary',
    title: 'Distribution & goal summaries',
    description:
      'DM members their activity totals and goal progress when a distribution closes.',
    defaultTitle: 'Distribution summary for {groupName}',
    defaultMessage:
      'Distribution #{distribution} — goal {goalName}\nTotal Minutes: {totalMinutes}\nActive Minutes: {activeMinutes}\nMessages: {messages}\nSessions: {sessions}',
    variables: [
      { name: 'groupName', description: 'Your group / workspace name' },
      { name: 'distribution', description: 'Distribution number' },
      { name: 'goalName', description: 'Activity goal name (when applicable)' },
      { name: 'totalMinutes', description: 'Total minutes vs goal (e.g. 120/100)' },
      { name: 'activeMinutes', description: 'Active minutes vs goal' },
      { name: 'messages', description: 'Messages vs goal' },
      { name: 'sessions', description: 'Sessions attended vs goal' },
    ],
  },
  {
    id: 'inactivity',
    title: 'Inactivity updates',
    description:
      'DM members when their inactivity starts or ends, and when an inactivity request is created, approved, or declined.',
    defaultTitle: 'Inactivity update at {groupName}',
    defaultMessage: 'Your inactivity status has changed.',
    variables: [
      { name: 'groupName', description: 'Your group / workspace name' },
      { name: 'returnDate', description: 'Inactivity return date (when applicable)' },
      { name: 'reason', description: 'Inactivity reason (when applicable)' },
      { name: 'status', description: 'Request status, e.g. approved / declined' },
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation actions',
    description:
      'DM members when they are warned, suspended, terminated, promoted, or demoted.',
    defaultTitle: 'You were {action} at {groupName}',
    defaultMessage: '{reason}',
    variables: [
      { name: 'groupName', description: 'Your group / workspace name' },
      { name: 'moderatorName', description: 'Name of the staff member who acted' },
      { name: 'action', description: 'Action taken, e.g. warned / suspended' },
      { name: 'reason', description: 'Reason provided for the action' },
      { name: 'expiry', description: 'Expiry date (suspensions only)' },
    ],
  },
  {
    id: 'taskReminders',
    title: 'Task reminders',
    description: 'DM assigned members when a task reminder is due.',
    defaultTitle: 'Task reminder: {taskTitle}',
    defaultMessage: '{taskDescription}\n\nDue {dueDate}',
    variables: [
      { name: 'taskTitle', description: 'Task title' },
      { name: 'taskDescription', description: 'Task description' },
      { name: 'dueDate', description: 'Task due date (when set)' },
    ],
  },
  {
    id: 'sessionReminders',
    title: 'Session reminders',
    description: 'DM members who claimed a session when it is about to start.',
    defaultTitle: 'Your session at {gameName} is about to start!',
    defaultMessage:
      'The session starts at {sessionDate}!\nGame Link: {gameLink}\nSession Link: {sessionLink}',
    variables: [
      { name: 'gameName', description: 'Game / experience name' },
      { name: 'sessionDate', description: 'Session start time' },
      { name: 'gameLink', description: 'Link to the game' },
      { name: 'sessionLink', description: 'Link to the session in the panel' },
    ],
  },
  {
    id: 'applications',
    title: 'Application updates',
    description:
      'DM applicants when their application status changes (if enabled by the application).',
    defaultTitle: 'Update regarding your application {applicationName} at {groupName}',
    defaultMessage: 'Your application status has been updated.',
    variables: [
      { name: 'groupName', description: 'Your group / workspace name' },
      { name: 'applicationName', description: 'Application name' },
    ],
  },
];
