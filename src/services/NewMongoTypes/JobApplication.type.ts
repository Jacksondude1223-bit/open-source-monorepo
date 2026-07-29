import { ObjectId } from 'mongodb';

export type JobApplicationSubmissionType =
  | 'readmin_application'
  | 'readmin_resume'
  | 'contact_info';

export type JobApplicationStatus =
  | 'pending'
  | 'reviewing'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export type JobApplicationContactInfo = {
  robloxUsername?: string;
  robloxId?: string;
  discordUsername?: string;
  discordId?: string;
  message?: string;
};

export type JobApplication = {
  _id?: ObjectId;
  jobPostingId: string;
  groupId: string;

  reAdminUserId?: string;
  robloxId?: string;
  discordId?: string;

  submissionType: JobApplicationSubmissionType;
  resumeId?: string;
  responseId?: string;
  contactInfo?: JobApplicationContactInfo;

  status: JobApplicationStatus;
  internalNote?: string;

  createdAt: Date;
  updatedAt: Date;
};
