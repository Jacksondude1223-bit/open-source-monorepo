import { ObjectId } from 'mongodb';

export type logType = 'Output' | 'Info' | 'Warning' | 'Error';
// `user` carries the legacy stringified UserId; `userKey` carries the
// canonical identity key (see userIdentity.service.ts). Updated game modules
// send both — they are identical for legacy players and diverge once Roblox's
// domain-scoped IDs roll out. Older deployed modules send only `user`.
export type SessionEvents =
  | {
    id?: string;
    user?: string;
    userKey?: string;
    ['type']: 'active';
    sessionIds?: string;
    date: Date | number;
    datetime?: number;
  }
  | {
    id?: string;
    user?: string;
    userKey?: string;
    ['type']: 'idle';
    sessionIds?: string;
    date: Date | number;
    datetime?: number;
  }
  | {
    id?: string;
    user?: string;
    userKey?: string;
    ['type']: 'message';
    message: string;
    to?: string;
    encoded?: true;
    sessionIds?: string;
    date: Date | number;
    datetime?: number;
  }
  | {
    id?: string;
    user?: string;
    userKey?: string;
    ['type']: 'typing';
    sessionIds?: string;
    date: Date | number;
    datetime?: number;
  }
  | {
    ['type']: 'log';
    short: logType;
    message: string;
    date: Date | number;
    datetime?: number;
  }
  | {
    id?: string;
    user?: string;
    userKey?: string;
    ['type']: 'join';
    date: Date | number;
    datetime?: number;
  }
  | {
    id?: string;
    user?: string;
    userKey?: string;
    ['type']: 'leave';
    sessionIds?: string;
    date: Date | number;
    datetime?: number;
  }
  | {
    type: 'system';
    subtype: 'players';
    players: number[];
    date: Date | number;
    datetime?: number;
  };

export type PlayerPlatform =
  | 'Phone'
  | 'Tablet'
  | 'Console'
  | 'Desktop'
  | 'unknown';

export type UserGameSession = {
  _id?: ObjectId;
  runningGameId?: ObjectId;
  runningPlayerId?: ObjectId;
  groupId: number;
  userId: number;
  // Canonical identity key (see userIdentity.service.ts). Bare digits for
  // legacy global IDs, opaque serialized User form for domain-scoped players.
  // Absent on records written before the scoped-ID migration; treat a missing
  // value as String(userId).
  userKey?: string;
  gameId: number;
  placeId: number;
  internalGameId: string;
  platform: PlayerPlatform;
  staff?: boolean;
  inGame: boolean;
  useMilliseconds: boolean;
  removalMethod?: 'syncRemoval' | 'internalSyncRemoval' | 'normalPlayerLeave';
  distribution: number; // The number which is the distribution the workspace is now in
  minutes?: {
    total: number;
    active: number;
    inactive: number;
    typing: number;
    messages: number;
  };
  started: Date;
  active: boolean;
  attendedSessions?: string[];
  ended?: Date | number;
  safeChat?: boolean;
  created: Date;
};
