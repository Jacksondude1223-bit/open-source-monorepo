import { ObjectId } from 'mongodb';

export type JobPostingTag =
  | 'Full-time'
  | 'Part-time'
  | 'Volunteer'
  | 'Paid'
  | 'Unpaid'
  | 'Moderation'
  | 'Management'
  | 'Events'
  | 'Development'
  | 'HR'
  | 'Marketing'
  | 'Support'
  | 'Training';

export const JOB_POSTING_TAGS: JobPostingTag[] = [
  'Full-time',
  'Part-time',
  'Volunteer',
  'Paid',
  'Unpaid',
  'Moderation',
  'Management',
  'Events',
  'Development',
  'HR',
  'Marketing',
  'Support',
  'Training',
];

export type ApplicationMethod =
  | { type: 'readmin_application'; applyOnlineId: string }
  | { type: 'readmin_resume' }
  | { type: 'contact_info'; prompt?: string }
  | { type: 'roblox_game'; gameId: string; gameUrl: string; instructions?: string }
  | { type: 'discord_guild'; inviteUrl: string; instructions?: string }
  | { type: 'google_form'; url: string; instructions?: string }
  | { type: 'external_link'; url: string; label?: string };

export type ApplicationMethodType = ApplicationMethod['type'];

export type JobPostingCompensation = {
  amount?: string;
  type: 'robux' | 'usd' | 'unpaid' | 'other';
  period?: 'one-time' | 'weekly' | 'biweekly' | 'monthly';
};

export type JobPostingStatus = 'active' | 'paused' | 'closed';
export type JobPostingVisibility = 'public' | 'unlisted';

export type JobPosting = {
  _id?: ObjectId;
  groupId: string;
  title: string;
  shortSummary: string;
  description: string;
  requirements: string[];
  tags: JobPostingTag[];
  applicationMethods: ApplicationMethod[];
  status: JobPostingStatus;
  visibility: JobPostingVisibility;
  opensAt?: Date | null;
  closesAt?: Date | null;
  compensation?: JobPostingCompensation;
  applicantCount: number;

  // Moderation
  forcedClosedByAdmin?: boolean;
  forcedUnpublishedByAdmin?: boolean;
  adminFlagged?: boolean;

  createdBy: string; // reAdminUserId
  createdAt: Date;
  updatedAt: Date;
};
