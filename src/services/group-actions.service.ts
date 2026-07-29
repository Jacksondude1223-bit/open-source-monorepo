
// Should be able to work with OAuth2, and native Cookie bots.
// Should be able to work with logging/redoing if it fails.

import { v4 } from "uuid";
import { openCloudExileUser, openCloudGetJoinRequests, openCloudHandleJoinRequest, openCloudUpdateGroupStatus, openCloudUpdateUserRole, PerformingAs } from "./opencloud.roblox.service";
import { readminCollections } from '~/services/mongo.service';
import { rankingAPIMetadata } from "./NewMongoTypes/RobloxGroupActionQueue.type";

const method = 'open-cloud';

export async function canWorkspaceOrUserRank(performingAs: PerformingAs, id: string): Promise<boolean> { // wtf is this legacy code?
    if (performingAs == 'group') {
        const linkage = await readminCollections.group_oauth_authorization.findOne({
            groupId: id
        })
        return linkage ? true : false;
    }
    if (performingAs == 'user') {
        const user = await readminCollections.user.findOne({
            robloxId: id
        })
        return user ? typeof (user.accessToken) == 'string' : false;
    }
    return false;
}

export async function rankUser(
    performingAs: PerformingAs,
    performingIdentifer: string,
    groupId: string | number,
    userId: string | number,
    rankId: string | number,
    source: 'ranking-api' | 'application' | 'discord' | 'user',
    rankingApiMetadata?: rankingAPIMetadata
): Promise<'loggedOut' | 'rankNotFound' | 'error' | true> {

    const foundRank = await readminCollections.group_role.findOne({
        groupId: groupId.toString(),
        $or: [
            { id: parseInt(rankId.toString()) },
            { rank: parseInt(rankId.toString()) }
        ]
    });

    if (!foundRank) {
        return "rankNotFound";
    }


    const newRankAction = await readminCollections.roblox_group_action_queue.insertOne({
        actionId: v4(),
        groupId: groupId.toString(),
        actionType: 'rank',
        userId: userId.toString(),
        rankId: foundRank.rank,
        roleId: foundRank.id,
        status: 'pending',
        method: method,
        initatorSource: source,
        rankingApiMetadata: rankingApiMetadata,
        created: new Date()
    });

    const action = await openCloudUpdateUserRole(performingAs, performingIdentifer, groupId.toString(), userId.toString(), foundRank.id)
    console.log(action)
    if (action == true) {
        await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
            $set: {
                status: 'complete',
            }
        });
        return true;
    }

    if (action === 'rate_limited') {
        // Queue for retry — mark as pending so it gets picked up by the cron
        await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
            $set: {
                status: 'failed',
                failure: {
                    reason: 'rate_limited',
                    retryable: true,
                    retryCount: 0,
                }
            }
        });

        await readminCollections.rank_retry_queue.insertOne({
            actionQueueId: newRankAction.insertedId,
            performingAs,
            performingId: performingIdentifer,
            groupId: groupId.toString(),
            userId: userId.toString(),
            roleId: foundRank.id,
            source,
            rankingApiMetadata,
            retryCount: 0,
            maxRetries: 10,
            nextRetryAt: new Date(Date.now() + 30_000), // first retry in 30s
            status: 'pending',
            created: new Date(),
        });

        return true; // tell the caller it's been accepted (will be retried)
    }

    await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
        $set: {
            status: 'failed',
            failure: {
                reason: 'Unknown open-cloud error',
                retryable: false
            }
        }
    });


    return 'error'
}


export async function getJoinRequests(
    performingAs: PerformingAs,
    performingIdentifer: string,
    groupId: string | number,
    cursor?: string
): Promise<'loggedOut' | 'error' | any> {
    if (method == 'open-cloud') {
        return await openCloudGetJoinRequests(performingAs, performingIdentifer, groupId.toString(), cursor);
    }

    return 'error';
}
export async function handleJoinRequest(
    performingAs: PerformingAs,
    performingIdentifer: string,
    groupId: string | number,
    userId: string | number,
    accept: boolean,
    source: 'ranking-api' | 'application' | 'discord' | 'user',
    rankingApiMetadata?: rankingAPIMetadata
): Promise<'loggedOut' | 'error' | any> {

    const newRankAction = await readminCollections.roblox_group_action_queue.insertOne({
        actionId: v4(),
        groupId: groupId.toString(),
        actionType: accept ? 'acceptJoinRequest' : 'denyJoinRequest',
        userId: userId.toString(),
        status: 'pending',
        method: method,
        initatorSource: source,
        rankingApiMetadata: rankingApiMetadata,
        created: new Date(),
    });


    const action = await openCloudHandleJoinRequest(performingAs, performingIdentifer, groupId.toString(), userId.toString(), accept)
    if (action == true) {
        await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
            $set: {
                status: 'complete',
            }
        });
        return true;
    }
    await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
        $set: {
            status: 'failed',
            failure: {
                reason: 'Unknown open-cloud error',
                retryable: false
            }
        }
    });

    return 'error'
}
export async function shout(
    performingAs: PerformingAs,
    performingIdentifer: string,
    groupId: string | number,
    message: string,
    source: 'ranking-api' | 'application' | 'discord' | 'user',
    rankingApiMetadata?: rankingAPIMetadata
): Promise<'loggedOut' | 'error' | any> {

    const newRankAction = await readminCollections.roblox_group_action_queue.insertOne({
        actionId: v4(),
        groupId: groupId.toString(),
        actionType: 'shout',
        shout: message,
        status: 'pending',
        method: method,
        initatorSource: source,
        rankingApiMetadata: rankingApiMetadata,
        created: new Date(),
    });


    const action = await openCloudUpdateGroupStatus(performingAs, performingIdentifer, groupId.toString(), message);
    if (action == true) {
        await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
            $set: {
                status: 'complete',
            }
        });
        return true;
    }
    await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
        $set: {
            status: 'failed',
            failure: {
                reason: 'Unknown open-cloud error',
                retryable: false
            }
        }
    });

    return 'error'
}
export async function exile(
    performingAs: PerformingAs,
    performingIdentifer: string,
    groupId: string | number,
    userId: string | number,
    source: 'ranking-api' | 'application' | 'discord' | 'user',
    rankingApiMetadata?: rankingAPIMetadata
): Promise<'loggedOut' | 'error' | any> {

    const newRankAction = await readminCollections.roblox_group_action_queue.insertOne({
        actionId: v4(),
        groupId: groupId.toString(),
        actionType: 'exile',
        userId: userId.toString(),
        status: 'pending',
        method: method,
        initatorSource: source,
        rankingApiMetadata: rankingApiMetadata,
        created: new Date(),
    });


    const action = await openCloudExileUser(performingAs, performingIdentifer, groupId.toString(), userId.toString());
    if (action == true) {
        await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
            $set: {
                status: 'complete',
            }
        });
        return true;
    }
    await readminCollections.roblox_group_action_queue.updateOne({ _id: newRankAction.insertedId }, {
        $set: {
            status: 'failed',
            failure: {
                reason: 'Unknown open-cloud error',
                retryable: false
            }
        }
    });

    return 'error'
}