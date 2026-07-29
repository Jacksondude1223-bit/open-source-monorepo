import { AnyBulkWriteOperation } from "mongodb";
import calculateSummaries from "~/services/businessLogic/calculateSummaries";
import { readminCollections } from "~/services/mongo.service";
import { UserGameSession, Workspace } from "~/services/NewMongoTypes";
import { DateToSeconds } from "~/utils/DateUtils";
import { getWorkspaceCurrentDistribution } from "../workspaces.service";
import { computeDistributionPeriodEnd } from "./getDistributionWindow";

export default async function calculateSessionCounts(
    workspace: Workspace,
    userId?: string,
    doCalculateSummaries?: boolean
) {
    const distribution = await readminCollections.distribution.findOne({
        groupId: workspace.groupId.toString(),
        isCurrent: true,
    })
    const distributionSetting = workspace.distributionPeriod;
    const anchor = distribution?.from ? new Date(distribution.from) : new Date();
    const toDistribution = computeDistributionPeriodEnd(anchor, distributionSetting);

    // Fetch all sessions for the workspace (and user, if provided) [only for this distribution]
    const sessions = await readminCollections.session
        .find({
            groupId: workspace.groupId,
            ...(userId ? { claims: { $in: [userId] } } : {}),
            date: {
                $gte: distribution?.from,
                $lte: toDistribution,
            }
        })
        .toArray();

    const bulkOps: AnyBulkWriteOperation<UserGameSession>[] = [];
    const updatedUserIds = new Set<string>();

    await Promise.all(
        sessions.map(async (session) => {
            const starts = session.date;
            const ends = session.endsAt;
            const startSec = DateToSeconds(starts);
            const endSec = DateToSeconds(ends);
            // Fetch matching user game sessions for the current session
            const userSessions = await readminCollections.user_game_session
                .find({
                    groupId: parseInt(session.groupId),
                    userId: { $in: session.claims.map((id: string) => parseInt(id)) },
                    // Check if the user was in the game at some point during the session
                    $or: [
                        { started: { $lte: starts }, ended: { $gte: starts } },  // Session started before and ends after start
                        { started: { $gte: starts, $lte: ends }, ended: { $gte: ends } },  // Session starts during and ends after
                        { started: { $lte: starts }, ended: { $gte: ends } },  // Session encompasses target period
                        { started: { $gte: starts }, ended: { $lte: ends } },  // Session contained within target period
                        //new method
                        { started: { $lte: starts }, ended: { $gte: startSec } },  // Session started before and ends after start
                        { started: { $gte: starts, $lte: ends }, ended: { $gte: endSec } },  // Session starts during and ends after
                        { started: { $lte: starts }, ended: { $gte: endSec } },  // Session encompasses target period
                        { started: { $gte: starts }, ended: { $lte: endSec } },  // Session contained within target period
                    ]
                })
                .toArray();

            // Group by userId to ensure each user is only counted once per session
            const userSessionsByUserId = new Map<number, UserGameSession[]>();
            for (const playerSession of userSessions) {
                const userId = playerSession.userId;
                if (!userSessionsByUserId.has(userId)) {
                    userSessionsByUserId.set(userId, []);
                }
                userSessionsByUserId.get(userId)!.push(playerSession);
            }

            // Prepare bulk update operations using $addToSet - only update each user once per session
            for (const [userId, sessions] of userSessionsByUserId) {
                // Only update one session per user (they all represent the same attendance)
                if (sessions.length !== 0) {
                    const firstSession = sessions[0];
                    if (firstSession) {
                        bulkOps.push({
                            updateOne: {
                                filter: { _id: firstSession._id },
                                update: { $addToSet: { attendedSessions: session._id.toString() } }
                            }
                        });
                        updatedUserIds.add(userId.toString());
                    }
                }
            }
        })
    );

    // Execute all updates in a single bulk operation
    if (bulkOps.length > 0) {
        await readminCollections.user_game_session.bulkWrite(bulkOps);
    }

    // Optionally calculate summaries concurrently
    if (doCalculateSummaries !== true) {
        await Promise.all(
            Array.from(updatedUserIds).map((id) =>
                calculateSummaries(workspace, id, false)
            )
        );
    }
}
