import { ObjectId } from "mongodb";

export type TicketType = 'general' | 'user' | 'bug' | 'billing';
export type TicketStage = 'creating' | 'current' | 'rating' | 'finished';

export type Ticket = {
  _id?: ObjectId;
  internalId: string;
  type: 'general' | 'user' | 'bug' | 'billing';
  stage: 'creating' | 'current' | 'rating' | 'finished';
  discordId: string;
  agentsInvolved: string[];
  reason: string;
  channelId?: string;
  resolvedReason?: string;
  departmentId?: ObjectId;
  agentsRating?: number;
  closedBy?: string;
  created: Date;
}
