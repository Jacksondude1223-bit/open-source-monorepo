import { ObjectId } from 'mongodb';

export type ResumeWorkEntry = {
  _id: string; // client-generated UUID
  groupId?: string;
  groupName: string;
  groupIconUrl?: string;
  position: string;
  startDate?: Date | null;
  endDate?: Date | null; // null/undefined = "Present"
  description?: string;
  isVerified: boolean;
};

export type ResumeContactPreferences = {
  showRoblox: boolean;
  showDiscord: boolean;
  allowDirectMessages: boolean;
};

export type ResumeVerifiedBadge =
  | { type: 'staff_verified'; groupId: string; groupName: string }
  | { type: 'applications_passed'; count: number };

export type ReAdminResume = {
  _id?: ObjectId;
  reAdminUserId: string;
  robloxId: string;
  discordId?: string;

  headline?: string;
  bio?: string;
  skills: string[];
  slug?: string;

  workHistory: ResumeWorkEntry[];

  contactPreferences: ResumeContactPreferences;
  verifiedBadges?: ResumeVerifiedBadge[];

  isPublic: boolean;

  // Moderation
  forcedPrivateByAdmin?: boolean;
  adminFlagged?: boolean;

  createdAt: Date;
  updatedAt: Date;
};
