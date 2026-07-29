import { ObjectId } from 'mongodb';

export type ContentReportContentType = 'job_posting' | 'resume';

export type ContentReportReason =
  | 'spam'
  | 'inappropriate'
  | 'misleading'
  | 'other';

export type ContentReportStatus = 'open' | 'reviewed' | 'dismissed';

export type ContentReport = {
  _id?: ObjectId;
  contentType: ContentReportContentType;
  contentId: string;
  reportedBy: string; // reAdminUserId
  reason: ContentReportReason;
  details?: string;
  status: ContentReportStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
};
