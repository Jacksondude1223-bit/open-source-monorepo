import { ObjectId } from 'mongodb';

export type SetupAssistType = 'setup' | 'migration';

export type SetupAssistStatus = 'pending' | 'in_progress' | 'completed';

export type SetupAssistContactMethod = 'discord' | 'email';

export type SetupAssistRequest = {
  _id?: ObjectId;
  groupId: string;
  groupName?: string;
  robloxId: string; // robloxId of the user who paid for setup assistance
  type: SetupAssistType; // fresh setup vs. migrating from another tool
  previousTool?: string; // optional: what they are migrating from
  notes?: string; // optional context the user provided
  contactMethod?: SetupAssistContactMethod; // how the user wants us to reach them
  contact?: string; // the Discord username or email the user provided
  linkedDiscordId?: string; // their linked Discord account id, if any
  status: SetupAssistStatus;
  subscriptionId?: string; // Stripe subscription this fee was billed on
  created: Date;
};
