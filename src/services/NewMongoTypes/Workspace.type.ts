import { ObjectId } from 'mongodb';

import { TeamsSettings } from './ApprovalWorkflow.type';

export type WorkspaceOwnerType = {
  reAdminId: ObjectId;
  robloxId: string;
};

export type WorkspacePremiumType = {
  is: boolean;
  subscriptionId?: string;
  planType?: 'basic' | 'enterprise' | 'premium';
  meterId?: string;
  managedBy?: {
    robloxId: string;
    customerId: string;
  };
};

export type WorkspaceTags = 'Partner' | 'Beta'[];

// Categories of automated Discord DMs ReAdmin sends to members. Each category
// can be independently enabled/disabled per workspace from the Notifications
// settings page so owners can reduce "DM spam" complaints. Absent/undefined for
// a category means enabled (the historical default behaviour).
export type DiscordDmCategory =
  | 'sessionTracking' // "your time is now being tracked" when a staff member joins a game
  | 'sessionSummary' // per-session minutes summary sent when a member leaves
  | 'distributionSummary' // distribution + goal progress summaries
  | 'inactivity' // inactivity started/ended + inactivity request status updates
  | 'moderation' // warn/suspend/terminate/promote/demote notifications
  | 'taskReminders' // task reminder DMs
  | 'sessionReminders' // "your session is about to start" reminders
  | 'applications'; // application status update DMs

// Per-workspace map of DM category -> enabled. A missing key means enabled.
export type DiscordDmSettings = Partial<Record<DiscordDmCategory, DiscordDmCategoryConfig>>;

// Per-category configuration. `enabled` gates whether the DM is sent at all
// (missing/true = enabled, preserving historical behaviour). `title` / `message`
// are optional templates that override the built-in copy; they support
// {variable} placeholders that are filled in at dispatch time. An empty or
// missing template falls back to the built-in default for that DM.
export type DiscordDmCategoryConfig = {
  enabled?: boolean;
  title?: string;
  message?: string;
};

// Per-workspace AFK / idle-tracking configuration. Surfaced to the in-game
// tracker via the createServer response so it can be managed from the website
// rather than the in-game loader config.
export type AfkReportingSettings = {
  altTab: {
    active: boolean; // false disables alt-tab / window-focus idle detection
    timeUntilIdle?: number; // seconds after leaving the window before idle; defaults to afkTime
  };
  movement: {
    active: boolean; // false disables movement / input idle detection
    timeUntilIdle?: number; // seconds without movement before idle; defaults to afkTime
  };
};

export type BrandColors = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'sky' | 'cyan' | 'blue' | 'indigo' | 'purple' | 'rose' | 'pink';
// Configuration for bridging web support calls into the linked Discord guild.
// When `categoryId` is set, opening a call creates a private channel under that
// category that the configured `accessRoleIds` can read/send in. Agents reply
// from Discord with /reply and can claim/close via buttons on the call embed.
export type CallDiscordSettings = {
  categoryId: string; // Discord category (channel type 4) new call channels are created under
  accessRoleIds: string[]; // Discord role ids granted view/send in the call channel (never public)
  closeAction: 'delete' | 'move'; // what to do with the channel when the call closes
  archiveCategoryId?: string; // required when closeAction === 'move'; category the channel is moved to
};

// Configuration for the Timeclock (staff attendance) feature. Stored on the
// workspace so the website is the single source of truth, mirroring how
// afkReportingSettings / callDiscordSettings are handled.
export type TimeclockSettings = {
  enabled: boolean; // master on/off — hides the feature + rejects clocking when false
  // Department _ids permitted to clock in. Empty / undefined = every department
  // (the feature is workspace-wide once enabled). Managers with view/manage/edit
  // permissions still see all records regardless of this list.
  enabledDepartments?: string[];
  allowManualEntries?: boolean; // let managers add after-the-fact entries
  // Shifts open longer than this many hours are flagged for manager review.
  // 0 / undefined disables the auto-flag. Defaults applied in the service layer.
  maxShiftHours?: number;
  // Auto clock-out entries left open past maxShiftHours instead of only flagging.
  autoClockOutOverMax?: boolean;
};

// Per-workspace Application Center configuration. Controls whether the in-game
// activity tracker loads the embedded Application Center window, and how it's
// presented. Surfaced to the in-game tracker via the createServer response so
// the website is the single source of truth (mirrors moderation / afk settings).
export type ApplicationCenterSettings = {
  enabled: boolean; // master on/off — the tracker only loads the AC when true
  displayMode?: 'windowed' | 'fullscreen'; // how the embedded panel is shown; defaults to windowed
  backdrop?: boolean; // dim + block the game behind the window; defaults off (windowed)
};

// Toggleable workspace modules — the first step toward a plugin architecture
// for ReAdmin. A module that is absent/false is invisible: its sidebar nav,
// tRPC routers and Fastify v2 routes all reject/hide when the flag is off.
// `orders` defaults OFF (it is opt-in). Future features (applications, sessions,
// …) can migrate behind this same mechanism later — scope here is the mechanism
// plus the orders module only.
export type EnabledModules = {
  orders?: boolean;
};

// Per-workspace activity-tracking privacy controls, surfaced to the in-game
// tracker via the createServer response. Built for Roblox's domain-scoped user
// ID rollout: both default OFF so behaviour is unchanged until a workspace (or
// we, at rollout) turns them on.
export type PrivacySettings = {
  // Only create activity records for staff; non-staff players are never tracked.
  trackStaffOnly?: boolean;
  // Require explicit in-game consent before tracking a player. Until a player
  // opts in they are not tracked; opting out adds them to the per-workspace
  // tracking ignore (see workspace_tracking_consent). Fully in-game — never
  // links to the ReAdmin website (Roblox ToS).
  requireConsent?: boolean;
};

export type Workspace = {
  _id?: ObjectId;
  groupId: string;
  groupName?: string;
  // Per-workspace module toggles. Absent = every module off (orders is opt-in).
  enabledModules?: EnabledModules;
  owner: WorkspaceOwnerType;
  minSyncRole: number;
  loaderId: string;
  currentDistribution: number;
  distributionPeriod: 'manual' | 'weekly' | 'biweekly' | 'monthly';
  distributionDMs: boolean;
  // Day of week (0 = Sunday ... 6 = Saturday) that automated distributions run on. Defaults to Sunday.
  distributionDay?: number;
  // IANA timezone (e.g. 'America/New_York') in which automated distributions run at midnight. Defaults to America/New_York.
  distributionTimezone?: string;
  premium: WorkspacePremiumType;
  tags: WorkspaceTags;
  created: Date;
  syncing?: boolean;
  lastSynced?: Date;
  trackedStaff?: number;
  finishedSetup?: boolean;
  brandColor?: BrandColors;
  overrideRoleMaximumSize?: number;
  enableModerationDashboard?: boolean;
  afkReportingSettings?: AfkReportingSettings;
  isVerified?: boolean;
  callDiscordSettings?: CallDiscordSettings;
  bannerImage?: string;
  logoImage?: string;
  // Per-workspace timeclock (staff attendance) configuration. Absent/disabled
  // means the feature is hidden and clock-in/out is rejected server-side.
  timeclockSettings?: TimeclockSettings;
  // Per-workspace Teams configuration (enable/disable + approval routing for
  // time-off and expense requests). Absent means defaults (enabled, single-step).
  teamsSettings?: TeamsSettings;
  // Per-workspace Application Center configuration. Absent/disabled means the
  // in-game tracker does not load the embedded Application Center window.
  applicationCenterSettings?: ApplicationCenterSettings;
  banStatus?: {
    is: true;
    reason: string;
    bannedBy: string;
  };
  promotionalRedemptions?: {
    sevenDayTrial: boolean;
  }
  inactivityRole?: string;
  // Per-workspace toggles for each category of automated Discord DM. A missing
  // category (or missing object entirely) means that DM type is enabled.
  discordDmSettings?: DiscordDmSettings;
  // Configuration for the Session Attendance grid. Absent means defaults:
  // empty visibleDepartmentIds = show all departments; empty hostingRoleIds =
  // no role counts as "hosted" (H) until one is selected.
  sessionAttendanceSettings?: SessionAttendanceSettings;
  // Activity-tracking privacy controls. Absent = both off (track everyone, no
  // consent prompt) — current behaviour.
  privacySettings?: PrivacySettings;
};

export type SessionAttendanceSettings = {
  // Department _id strings rendered as row groups on the grid. Empty = all.
  visibleDepartmentIds: string[];
  // Session role/subrole ids that count as "hosting" for the H status.
  hostingRoleIds: string[];
};
