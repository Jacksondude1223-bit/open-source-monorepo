import { FastifyRequest, FastifyReply } from 'fastify';
import StringToObjectID from '~/utils/StringToObjectID';
import { readminCollections } from '~/services/mongo.service';
import { SessionServerType } from '~/services/NewMongoTypes';
import { writeClaimReleaseAudit } from '~/services/businessLogic/writeClaimReleaseAudit';

// Returns the set of userIds that still hold a claim on a given server, handling
// both the legacy map form and the V2 array form of `claims`.
function claimedUserIds(claims: SessionServerType['claims']): string[] {
    if (!claims) return [];
    if (Array.isArray(claims)) return claims.map((c) => c.userId);
    return Object.keys(claims);
}

// DELETE /sessions/v2/:sessionId/servers/:serverId/claims/:userId
// Releases a user's claim on a session server and recomputes the session-level
// claim list so a user is only listed as "claimed" while they hold a claim
// somewhere in the session.
export const releaseClaim = async (req: FastifyRequest<{
    Params: { sessionId: string; serverId: string; userId: string };
}>, res: FastifyReply) => {
    const { workspace } = req;
    const { sessionId, serverId, userId } = req.params;

    let objectId;
    try {
        objectId = StringToObjectID(sessionId);
    } catch {
        return res.status(400).send({ success: false, reason: 'Invalid session ID' });
    }

    try {
        const session = await readminCollections.session.findOne({
            groupId: workspace.groupId,
            _id: objectId,
        });
        if (!session) {
            return res.status(404).send({ success: false, reason: 'Session not found' });
        }

        const server = session.servers?.[serverId];
        if (!server) {
            return res.status(404).send({ success: false, reason: 'Server not found' });
        }

        // Remove the claim from this server (in-memory) handling both shapes.
        let nextClaims: SessionServerType['claims'];
        if (Array.isArray(server.claims)) {
            nextClaims = server.claims.filter((c) => c.userId !== userId);
        } else {
            const { [userId]: _removed, ...rest } = server.claims || {};
            nextClaims = rest;
        }

        // Recompute the session-level claim list across all servers.
        const stillClaimed = new Set<string>();
        for (const [id, srv] of Object.entries(session.servers || {})) {
            const claims = id === serverId ? nextClaims : srv.claims;
            for (const uid of claimedUserIds(claims)) stillClaimed.add(uid);
        }

        await readminCollections.session.updateOne(
            { _id: session._id },
            {
                $set: {
                    [`servers.${serverId}.claims`]: nextClaims,
                    claims: Array.from(stillClaimed),
                },
            },
        );

        // Audit the release so the attendance grid can surface a "Replaced" (R)
        // status. `session` is the pre-removal snapshot. These are API-key
        // requests with no acting user, so the actor is recorded as 'api'.
        await writeClaimReleaseAudit({
            groupId: workspace.groupId,
            session,
            serverId,
            userId,
            releasedBy: 'api',
            reason: 'manual',
        });

        return res.send({ success: true });
    } catch (e) {
        return res.status(500).send({ success: false, reason: 'Internal server error' });
    }
};
