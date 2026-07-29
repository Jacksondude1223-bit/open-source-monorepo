import { rankUser } from '~/services/group-actions.service';
import { readminCollections } from '~/services/mongo.service';
import { openCloudUpdateUserRole } from '~/services/opencloud.roblox.service';

export const syncRanking = async () => {
    console.log('Syncing ranking / punishments')

    // ── Retry rate-limited ranking requests ──
    const pendingRetries = await readminCollections.rank_retry_queue.find({
        status: 'pending',
        nextRetryAt: { $lte: new Date() },
    }).toArray();

    for (const retry of pendingRetries) {
        const result = await openCloudUpdateUserRole(
            retry.performingAs,
            retry.performingId,
            retry.groupId,
            retry.userId,
            retry.roleId,
        );

        if (result === true) {
            // Ranking succeeded — mark both queue entries as complete
            await readminCollections.rank_retry_queue.updateOne({ _id: retry._id }, {
                $set: { status: 'complete', lastRetryAt: new Date() }
            });
            await readminCollections.roblox_group_action_queue.updateOne({ _id: retry.actionQueueId }, {
                $set: { status: 'complete' }
            });
            console.log(`[RankRetry] Completed: user ${retry.userId} in group ${retry.groupId} (attempt ${retry.retryCount + 1})`);
            continue;
        }

        const newRetryCount = retry.retryCount + 1;

        if (result === 'rate_limited' && newRetryCount < retry.maxRetries) {
            // Still rate-limited — exponential backoff: 30s, 60s, 120s, ...
            const backoffMs = Math.min(30_000 * Math.pow(2, newRetryCount), 10 * 60 * 1000); // cap at 10 min
            await readminCollections.rank_retry_queue.updateOne({ _id: retry._id }, {
                $set: {
                    retryCount: newRetryCount,
                    lastRetryAt: new Date(),
                    nextRetryAt: new Date(Date.now() + backoffMs),
                }
            });
            console.log(`[RankRetry] Still rate-limited, retry #${newRetryCount} for user ${retry.userId} in group ${retry.groupId}, next in ${backoffMs / 1000}s`);
        } else {
            // Either a non-429 failure or exhausted retries
            await readminCollections.rank_retry_queue.updateOne({ _id: retry._id }, {
                $set: {
                    status: 'exhausted',
                    retryCount: newRetryCount,
                    lastRetryAt: new Date(),
                }
            });
            await readminCollections.roblox_group_action_queue.updateOne({ _id: retry.actionQueueId }, {
                $set: {
                    status: 'failed',
                    failure: {
                        reason: result === 'rate_limited' ? 'rate_limited_exhausted' : 'open-cloud error after retries',
                        retryable: false,
                        retryCount: newRetryCount,
                        failureDate: new Date(),
                    }
                }
            });
            console.log(`[RankRetry] Exhausted retries for user ${retry.userId} in group ${retry.groupId} after ${newRetryCount} attempts`);
        }
    }

    // ── Process expired write-ups ──
    const endedWriteups = await readminCollections.write_ups.find({
        expires: { $lt: new Date() },
        ended: false
    }).toArray();

    // Iterate through write ups, update "ended" to true.
    for (const writeup of endedWriteups) {
        await readminCollections.write_ups.updateOne({ _id: writeup._id }, { $set: { ended: true } });
        if (writeup.rankTo && writeup.rankFrom && writeup.type == 'suspension' && (writeup.pendingApproval == false || writeup.pendingApproval == undefined)) {
            await rankUser('group', writeup.groupId, writeup.groupId, writeup.userId, writeup.rankFrom, 'user', { suspension: 'ended', automated: 'true' });
        }
    }

    console.log('Synced ranks / punishments')
};