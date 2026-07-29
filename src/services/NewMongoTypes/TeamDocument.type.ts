import { ObjectId } from 'mongodb';

export type TeamDocument = {
  _id?: ObjectId;
  groupId: string;
  teamId: ObjectId;
  fileName: string;
  fileUrl: string; // CDN URL
  fileSize: number; // bytes
  uploadedBy: string; // robloxId
  uploadedAt: Date;
  category?: string; // 'guide', 'roster', 'policy', 'other'
  description?: string;
  pinned?: boolean; // Show at the top
  createdAt?: Date;
  updatedAt?: Date;
};
