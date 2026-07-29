import { WithId } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { Session, SessionClaim, SessionClaimV2 } from '~/services/NewMongoTypes';

// Looks up a user's claim on a given server, handling both the legacy map form
// ({ [userId]: claim }) and the V2 array form (SessionClaimV2[]).
function findClaimForUser(
  claims: Session['servers'][string]['claims'] | undefined,
  userId: string,
): SessionClaim | SessionClaimV2 | undefined {
  if (!claims) return undefined;
  if (Array.isArray(claims)) return claims.find((c) => c.userId === userId);
  return claims[userId];
}

// Records a release/unclaim into the session_claim_release audit collection.
// Captures the claim's role + id (read from the session BEFORE the claim was
// removed) so the attendance grid can later surface a "Replaced" (R) status.
// Best-effort: failures are swallowed so they never block the unclaim itself.
export async function writeClaimReleaseAudit(params: {
  groupId: string;
  session: WithId<Session>;
  serverId: string;
  userId: string;
  releasedBy: string;
  claimId?: string;
  reason?: 'manual' | 'reassigned' | 'admin';
}): Promise<void> {
  const { groupId, session, serverId, userId, releasedBy, reason } = params;
  try {
    const claim = findClaimForUser(session.servers?.[serverId]?.claims, userId);
    await readminCollections.session_claim_release.insertOne({
      groupId,
      sessionId: session._id.toString(),
      serverId,
      userId,
      claimId: params.claimId ?? claim?.claimId,
      claimedRole: claim?.claimedRole,
      releasedBy,
      reason: reason ?? 'manual',
      created: new Date(),
    });
  } catch {
    // Auditing is non-critical; never fail the release because of it.
  }
}
