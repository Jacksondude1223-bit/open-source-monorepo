import { ObjectId } from 'mongodb';

export type playerPlatform = 'Phone' | 'Tablet' | 'Console' | 'Desktop' | 'unknown';

export type RunningGamePlayers = {
  _id?: ObjectId;
  runningGameId?: ObjectId;
  userSessionId?: ObjectId;
  groupId: string;
  internalGameId: string;
  userId: string;
  // Canonical identity key (see userIdentity.service.ts); equals userId for
  // legacy players, the serialized User form for domain-scoped players.
  // Missing on records written before the scoped-ID migration.
  userKey?: string;
  platform: playerPlatform;
  isStaff: boolean;
  // Group rank/role read directly off the Player instance in-game
  // (GetRankInGroup/GetRoleInGroup). This is the staff-detection fallback that
  // works even for scoped users the backend can't match against group_member.
  capturedRank?: number;
  capturedRole?: string;
  joined: Date;
};
