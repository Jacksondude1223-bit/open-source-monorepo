import { RESTGetAPIWebhookResult } from 'discord-api-types/v10';
import { ObjectId } from "mongodb";

export type DiscordLogType = 'new-application' |//it is handled in their respective web funcion
  'read-application' |//it is handled in their respective web funcion
  'new-department-user' | // HANDLED IN PANEL API
  'removed-department-user' | // HANDLED IN PANEL API
  'new-group-member' | // HANDLED VIA INTERNAL_startRedisEventHandler
  'member-promotion' | // HANDLED VIA INTERNAL_startRedisEventHandler
  'member-punishment' | // HANDLED IN EACH SPECIFIC HANDELR.
  'member-demotion' | // HANDLED VIA INTERNAL_startRedisEventHandler
  'removed-group-member' | // HANDLED VIA INTERNAL_startRedisEventHandler
  'player-join' | // HANDLED VIA INTERNAL_startRedisEventHandler
  'remote-admin-action' | // handled in user-game-action api
  'player-leave' // HANDLED VIA INTERNAL_startRedisEventHandler
  | 'session-create'//handled
  | 'session-role-claimed'//handled
  | 'session-role-unclaimed'//handled
  | 'session-server-created'//handled
  | 'session-server-deleted'//handled
  | 'session-start'//handled
  | 'session-end'//handled
  | 'inactivity-request-created'
  | 'inactivity-request-approved-or-declined'
  | 'inactivity-start'
  | 'inactivity-end'
  | 'inactivity-deleted'
  | 'promotion-request-created'
  | 'promotion-request-closed'
  | 'timeclock-clock-in'
  | 'timeclock-clock-out'
  | 'timeclock-manager-edit'
  | 'all'; // UHH U BETTER HANDLE IT.

export type DiscordLogging = {
  _id?: ObjectId;
  groupId: string;
  webhookUrl: string;
  event: DiscordLogType | DiscordLogType[];
  webhookInfo: RESTGetAPIWebhookResult;
  created: Date;
}
