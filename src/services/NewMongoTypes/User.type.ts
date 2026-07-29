import { ObjectId } from 'mongodb';

export type userRole =
  | 'User'
  | 'Trainee'
  | 'Support'
  | 'Moderation'
  | 'Lead'
  | 'Founder';

export type User = {
  _id?: ObjectId;
  discordId?: string;
  discordAccounts?: {
    id: string;
    username: string;
    globalName?: string | null;
    avatar?: string | null;
    primary: boolean;
    linkedAt: Date;
  }[];
  stripeId?: string;
  testStripeId?: string;
  email?: string;
  robloxId: string;
  thumbnail?: string;
  name?: string;
  preferred_username?: string;
  nickname?: string;
  inSupportDiscord?: boolean;
  allowDiscordMessages?: boolean;
  darkMode?: boolean;
  birthday?: {
    month: number; // 1-12
    day: number; // 1-31
  };
  accessToken?: string;
  refreshToken?: string;
  accessTokenUpdatedAt?: Date;
  role: userRole;
  isModerated:
  | false
  | {
    is: boolean,
    type: 'ban' | 'warning';
    reason: string;
    invoiceUrl?: string;
    bannedBy: string;
  };
  lastLogin?: Date;
  created: Date;
};
