import { ObjectId } from 'mongodb';

/**
 * One document per known person. Activity records (sessions, events, chats)
 * keep the raw per-domain `userKey` they were captured with; this collection
 * is the only place that knows which keys belong to the same human. Linking
 * two identities (e.g. via Roblox's User Account Linking API) merges documents
 * here instead of rewriting historical records.
 *
 * userKey format:
 *  - Legacy global Roblox IDs are bare digits ("156").
 *  - Domain-scoped players (Roblox scoped-ID rollout, Oct 2026) use the opaque
 *    serialized form of the engine `User` datatype (`User:ToString()`), stored
 *    verbatim. Roblox guarantees scoped IDs never collide with global IDs, so
 *    the two formats can share one keyspace.
 */
export type UserIdentity = {
  _id?: ObjectId;
  /** Every userKey known to belong to this person. A key appears in at most one document. */
  keys: string[];
  /** The key this person was first seen under; stable display/grouping handle. */
  primaryKey: string;
  /** Global Roblox user ID, when any linked key is (or resolves to) a global identity. */
  globalUserId?: number;
  username?: string;
  displayName?: string;
  /**
   * Last-known headshot. For scoped users the backend can't call
   * thumbnails.roblox.com (that only knows global IDs), so the game captures it
   * in-engine (Players:GetUserThumbnailAsync) and sends it at join — this is the
   * fallback source. May be an rbxthumb:// or CDN URL depending on engine.
   */
  thumbnailUrl?: string;
  /**
   * Decomposed Roblox `User` datatype, captured in-game when available. Stored
   * so we keep every linkable handle for a person — the serialized form is the
   * future canonical key; the parts let us reason about which domain a key came
   * from (EXPERIENCE = universe, OAUTH = app). Absent for legacy/global players.
   */
  domainType?: 'EXPERIENCE' | 'OAUTH' | string;
  domainId?: number;
  scopedId?: number;
  serializedUser?: string;
  firstSeen: Date;
  lastSeen: Date;
  created: Date;
  updated: Date;
};
