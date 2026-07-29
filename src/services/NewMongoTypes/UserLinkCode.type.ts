import { ObjectId } from 'mongodb';

/**
 * A short-lived, single-use code that links an in-game (possibly domain-scoped)
 * identity to a panel/OAuth identity. The panel mints the code for the logged-in
 * user; the player redeems it in-game with `/verify`, and the redeeming game
 * server's view of their userKey is merged onto the panel identity via
 * linkUserIdentities(). This is the transport-independent floor for identity
 * linking — see userIdentity.service.ts. Roblox's User Account Linking API
 * (Aug 2026) becomes a second *source* feeding the same merge sink.
 */
export type UserLinkCode = {
  _id?: ObjectId;
  /** The code the player types in-game. Uppercase, ambiguity-free charset. */
  code: string;
  /** Canonical key of the panel user who minted it (their OAuth/global key). */
  identityKey: string;
  /** Display name of the minting user, for the in-game confirmation message. */
  username?: string;
  createdAt: Date;
  /** TTL index target — Mongo expires the document shortly after this. */
  expiresAt: Date;
  /** Set once redeemed; a code can only be redeemed once. */
  consumedAt?: Date;
  /** The in-game userKey that redeemed the code. */
  consumedByKey?: string;
  /** internalGameId of the server where it was redeemed (audit trail). */
  consumedInGameId?: string;
};
