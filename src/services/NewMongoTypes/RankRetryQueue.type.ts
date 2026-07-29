import { ObjectId } from 'mongodb';
import { PerformingAs } from '~/services/opencloud.roblox.service';
import { rankingAPIMetadata } from './RobloxGroupActionQueue.type';

export type RankRetryQueue = {
  _id?: ObjectId;
  /** Reference to the original roblox_group_action_queue document */
  actionQueueId: ObjectId;
  performingAs: PerformingAs;
  performingId: string;
  groupId: string;
  userId: string;
  roleId: number;
  source: 'ranking-api' | 'application' | 'discord' | 'user';
  rankingApiMetadata?: rankingAPIMetadata;
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: Date;
  nextRetryAt: Date;
  status: 'pending' | 'complete' | 'exhausted';
  created: Date;
};
