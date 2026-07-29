import 'module-alias/register';
import 'dotenv/config';

import { AnyBulkWriteOperation, ObjectId } from 'mongodb';
import { GroupMember } from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';

/**
 * One-shot backfill: seed `roleIds`/`rankIds`/`departmentIds` from the existing
 * scalar `roleId`/`rankId`/`departmentId` on every `group_member` document.
 *
 *   node ./apiBuild/fastifyAPI/scripts/backfill-member-role-sets --dry-run
 *   node ./apiBuild/fastifyAPI/scripts/backfill-member-role-sets
 *
 * SyncMembers populates the arrays for any workspace that completes a sync, but
 * it returns early when a workspace has no Open Cloud link newer than 90 days —
 * those members would keep the scalar-only shape forever. Until this reports
 * zero remaining, the query builders in groupMember.helpers.ts must keep their
 * dual-branch `$or` form.
 *
 * Safe to re-run: only touches documents that are missing `roleIds`, and each
 * page is an independent bulkWrite. Resumable — it logs the last `_id` processed
 * so an interrupted run can be restarted with RESUME_AFTER_ID.
 */

const PAGE_SIZE = 5000;
// Pause between pages so a large backfill doesn't monopolise the hottest
// collection in the database while the app is serving traffic.
const PAGE_PAUSE_MS = 250;

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const resumeAfter = process.env.RESUME_AFTER_ID
        ? new ObjectId(process.env.RESUME_AFTER_ID)
        : null;

    // Paging by _id range rather than filtering on `roleIds: { $exists: false }`:
    // that predicate cannot use an index (and $exists:false is not supported in a
    // partialFilterExpression either), so filtering on it would collection-scan
    // on every page.
    let lastId: ObjectId | null = resumeAfter;
    let scanned = 0;
    let updated = 0;
    let pages = 0;

    const remainingBefore = await readminCollections.group_member.countDocuments({ roleIds: { $exists: false } });
    console.log(`[backfill] Starting${dryRun ? ' (DRY RUN)' : ''}. Documents missing roleIds: ${remainingBefore}`);
    if (resumeAfter) console.log(`[backfill] Resuming after _id ${resumeAfter.toString()}`);

    for (;;) {
        const page: GroupMember[] = await readminCollections.group_member
            .find(
                lastId ? { _id: { $gt: lastId } } : {},
                {
                    projection: { _id: 1, roleId: 1, rankId: 1, departmentId: 1, roleIds: 1 },
                    sort: { _id: 1 },
                    limit: PAGE_SIZE,
                },
            )
            .toArray();

        if (page.length === 0) break;

        scanned += page.length;
        lastId = page[page.length - 1]!._id!;
        pages++;

        const ops: AnyBulkWriteOperation<GroupMember>[] = [];
        for (const member of page) {
            if (member.roleIds !== undefined) continue; // already migrated
            if (typeof member.roleId !== 'number' || typeof member.rankId !== 'number') {
                console.warn(`[backfill] Skipping ${member._id?.toString()} — missing scalar roleId/rankId`);
                continue;
            }
            ops.push({
                updateOne: {
                    filter: { _id: member._id },
                    update: {
                        $set: {
                            roleIds: [member.roleId],
                            rankIds: [member.rankId],
                            departmentIds: member.departmentId ? [member.departmentId] : [],
                        },
                    },
                },
            });
        }

        if (ops.length > 0) {
            if (!dryRun) {
                await readminCollections.group_member.bulkWrite(ops, { ordered: false });
            }
            updated += ops.length;
        }

        console.log(`[backfill] page ${pages}: scanned ${scanned}, ${dryRun ? 'would update' : 'updated'} ${updated}, last _id ${lastId.toString()}`);
        if (PAGE_PAUSE_MS > 0) await new Promise(resolve => setTimeout(resolve, PAGE_PAUSE_MS));
    }

    const remainingAfter = await readminCollections.group_member.countDocuments({ roleIds: { $exists: false } });
    console.log(`[backfill] Done. Scanned ${scanned}, ${dryRun ? 'would update' : 'updated'} ${updated}.`);
    console.log(`[backfill] Documents still missing roleIds: ${remainingAfter} (was ${remainingBefore})`);
    if (!dryRun && remainingAfter === 0) {
        console.log('[backfill] Zero remaining — the dual-branch $or in groupMember.helpers.ts can now be collapsed.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[backfill] Failed', err);
        process.exit(1);
    });
