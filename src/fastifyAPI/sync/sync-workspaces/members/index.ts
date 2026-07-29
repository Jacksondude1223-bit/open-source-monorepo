import { AnyBulkWriteOperation, ObjectId, WithId } from "mongodb";
import { Workspace, GroupMember } from "~/services/NewMongoTypes";
import { GroupAuditLog, GroupAuditLogAction } from "~/services/NewMongoTypes/GroupAuditLog.type";
import { readminCollections } from "~/services/mongo.service";
import * as Roblox from '~/services/roblox.service';
import stripeService, { findMeterOrCreate, findPriceByNameOrCreate } from '~/services/stripe.service';
import groupUserEventHandler from "../../../apiHandlers/internal/events-handler/messageTypes/groupUserEvent";
import { getAllGDPRIgnoredUsers } from "~/utils/isUserGDPRIgnored";
import { openCloudGetGroupMembersInRole } from "~/services/opencloud.roblox.service";
import { emitFlowEvent } from "~/services/flows/flowEngine.service";
import { FlowTriggerType } from "~/services/NewMongoTypes/Flow.type";

// Tunables: keep memory + Discord webhook fan-out bounded for very large groups (100k+).
// Members are diffed and written in chunks of this size so the peak working set
// is O(chunk) regardless of how many members the group has.
const DB_BULK_CHUNK = 1000;
// Cap on how many roles we fetch in parallel within a single workspace sync.
// Each parallel role keeps a streaming page accumulator (~chunk-sized) in memory.
const ROLE_FETCH_CONCURRENCY = 3;
// If a single sync would produce more than this many audit log events, stop firing
// per-event Discord webhook notifications (audit log rows are still written).
// Prevents first-time syncs of huge groups from spawning tens of thousands of
// in-flight HTTP calls.
const MAX_WEBHOOK_EVENTS_PER_SYNC = 500;

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<unknown>) {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) continue;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export default async function SyncMembers(workspace: Workspace, firstTime = false) {
  console.time(`SyncMembers-${workspace.groupId}`);
  const allIgnoredUsers = await getAllGDPRIgnoredUsers();
  const groupId = workspace.groupId;

  console.timeLog(`SyncMembers-${workspace.groupId}`, 'Fetching roles and members');
  const roles = await readminCollections.group_role.find({ groupId }).toArray();
  const workspaceMaxMembersInRole = workspace?.overrideRoleMaximumSize || 15000;

  const isOpenCloudSetup = await readminCollections.group_oauth_authorization.findOne({
    groupId,
    lastUsed: { $gt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // only consider OAuth links created in the last 90 days as valid
  })
  if (!isOpenCloudSetup) {
    console.log(`[SyncMembers-${workspace.groupId}] No valid OpenCloud OAuth link found, skipping member sync`);
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Streaming sync-marker approach (scales to 100k+ member groups):
  //
  //   1. Generate a unique syncId for this run.
  //   2. For each role, page through API members. Each page is diffed against
  //      the DB by looking up only the userIds in that page (projected to the
  //      minimum fields). Audit logs are emitted for joins/promotes/demotes.
  //   3. Bulk-upsert the page with `lastSeenSyncId = syncId`. New members get
  //      the marker via $set (NOT $setOnInsert) so the sweep below sees them.
  //   4. After all roles complete successfully, cursor-scan for any member in
  //      the group whose lastSeenSyncId !== syncId — those have left.
  //
  // Peak memory is O(DB_BULK_CHUNK) per role-fetch worker, independent of the
  // total member count. Index `idx_groupId_lastSeenSyncId` keeps the final
  // sweep fast.
  // ─────────────────────────────────────────────────────────────────────────
  const syncId = new ObjectId();
  const allIgnoredUserSet = new Set(allIgnoredUsers.map(u => u.toString()));

  // Count existing members before the sync starts. Used to decide whether to
  // fire Discord webhooks at all (first-time syncs of large groups would
  // otherwise emit tens of thousands of notifications).
  const existingMemberCount = await readminCollections.group_member.countDocuments({ groupId });
  const isLikelyFirstTimeSync = existingMemberCount === 0;

  // Upfront check: does this workspace have ANY Discord logging configured for
  // member events? If not, suppress webhook calls entirely for this run.
  // Without this, every audit event triggered a thumbnail + user-info fetch
  // even when no webhook would be sent — hammering thumbnails.roblox.com and
  // causing cascading rate limits across the service.
  const hasMemberEventLogging = (await readminCollections.discord_logging.countDocuments({
    groupId,
    event: { $in: ['all', 'new-group-member', 'member-promotion', 'member-demotion', 'removed-group-member'] },
  })) > 0;

  let totalApiMembers = 0;
  let totalChangeEvents = 0;
  let totalWebhooksFired = 0;
  let webhookSuppressionLogged = false;
  let anyRoleFetchFailed = false;
  let anyWriteFailed = false;

  // Try-fire a Discord webhook for an audit log event, respecting the global cap.
  // On first-time syncs (no prior members) or when no member-event logging is
  // configured for this workspace, we suppress entirely.
  const maybeFireWebhook = (log: GroupAuditLog) => {
    if (isLikelyFirstTimeSync || !hasMemberEventLogging) return;
    // groupUserEventHandler has no message template for the role-set actions, and
    // its `|| ['all']` fallback would match every 'all' webhook, pay for a user-info
    // + thumbnail fetch, then send nothing — re-creating the thumbnail hammering
    // that handler's short-circuit exists to prevent. Discord support for these is
    // a separate piece of work (needs new DiscordLogType values + settings UI).
    if (log.action === 'role.added' || log.action === 'role.removed') return;
    if (totalWebhooksFired >= MAX_WEBHOOK_EVENTS_PER_SYNC) {
      if (!webhookSuppressionLogged) {
        console.log(`[SyncMembers-${groupId}] Webhook cap (${MAX_WEBHOOK_EVENTS_PER_SYNC}) reached; suppressing further per-event Discord notifications for this run.`);
        webhookSuppressionLogged = true;
      }
      return;
    }
    totalWebhooksFired++;
    // Fire-and-forget — handler does its own error logging.
    groupUserEventHandler(log);
  };

  // Map a membership audit event onto the Flows engine. Fire-and-forget and
  // internally queued/bounded, so it's safe to call per change event. Suppressed
  // on first-time syncs — otherwise the initial import of a large group would
  // emit a "member joined" event for every single member.
  // Exhaustive by type: adding a GroupAuditLogAction without mapping it here is
  // a compile error, which is deliberate — an unmapped action would otherwise
  // emit flow events with an undefined trigger.
  const FLOW_TRIGGER_FOR_ACTION: Record<GroupAuditLogAction, FlowTriggerType> = {
    join: 'member.joined',
    leave: 'member.left',
    promote: 'member.promoted',
    demote: 'member.demoted',
    'role.added': 'member.roleAdded',
    'role.removed': 'member.roleRemoved',
  };
  const maybeEmitFlow = (log: GroupAuditLog) => {
    if (isLikelyFirstTimeSync) return;
    emitFlowEvent({
      groupId: log.groupId,
      type: FLOW_TRIGGER_FOR_ACTION[log.action],
      subjectUserId: log.userId,
      event: {
        // `from`/`to` are the member's highest role before/after, so flows
        // written against the single-role model keep working unchanged.
        // `id` is the specific role added/removed, set only on those actions.
        role: { from: log.oldRole, to: log.newRole, ...(log.roleId !== undefined ? { id: log.roleId } : {}) },
        rank: { from: log.oldRank, to: log.newRank },
      },
    });
  };

  const syncableRoles = roles.filter(role =>
    role.rank !== 0 &&
    !(role.rank === 1 && role.name === 'Member') &&
    role.rank >= workspace.minSyncRole &&
    role.memberCount <= workspaceMaxMembersInRole
  );
  // Process one full chunk of API members for a single role: accumulate each
  // user's role set. All work is bounded by the chunk size, and there is no
  // read-modify-write — the diff that used to live here now happens once, in the
  // derive pass after every role has been streamed.
  const processChunk = async (
    chunk: { userIdNum: number; roleId: number; rank: number }[]
  ) => {
    if (chunk.length === 0) return;

    const memberBulkOps: AnyBulkWriteOperation<GroupMember>[] = [];
    const chunkNow = new Date();

    for (const apiMember of chunk) {
      const { userIdNum, roleId, rank } = apiMember;

      // Reset-on-first-touch accumulate. `lastSeenSyncId` doubles as the marker
      // for "has this run already touched this document":
      //
      //   - first write of THIS run  → snapshot the pre-run state into prev*,
      //                                and RESET roleIds/rankIds to just this role
      //   - later writes of this run → $setUnion this role into the set
      //
      // Rebuilding the set from scratch each run is what makes role REMOVAL
      // visible. The old pipeline only ever raised rankId/roleId, so a genuine
      // demotion was never written and never logged — the member kept their old
      // rank, department and permissions indefinitely.
      //
      // Concurrency: every op below is a single-document pipeline update, so
      // Mongo serialises the ROLE_FETCH_CONCURRENCY workers on each document.
      // Exactly one observes the reset condition, and $setUnion is commutative,
      // so the final set is independent of the order roles are processed in.
      const firstTouchOfThisRun = { $ne: ['$lastSeenSyncId', syncId] };
      const keepOrReset = (accumulated: any, fresh: any) => ({
        $cond: [firstTouchOfThisRun, fresh, accumulated],
      });

      memberBulkOps.push({
        updateOne: {
          filter: { groupId, userId: userIdNum },
          update: [
            {
              $set: {
                groupId,
                userId: userIdNum,
                created: { $ifNull: ['$created', chunkNow] },
                // Snapshot the pre-run state exactly once per run. `prevRoleIds`
                // falls back to the scalar for documents that predate the
                // backfill, and to [] for brand-new members (→ a join event).
                prevRoleIds: keepOrReset('$prevRoleIds', {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$roleIds', []] } }, 0] },
                    '$roleIds',
                    {
                      $cond: [
                        { $eq: [{ $type: '$roleId' }, 'missing'] },
                        [],
                        ['$roleId'],
                      ],
                    },
                  ],
                }),
                prevRoleId: keepOrReset('$prevRoleId', '$roleId'),
                prevRankId: keepOrReset('$prevRankId', '$rankId'),
                // Did this member already have a role SET before this run? If
                // not, this run is their migration from the old single-role
                // shape, and any rank change the derive pass computes is a
                // correction of stale data rather than a real promotion or
                // demotion. See the derive pass for why that distinction matters.
                prevHadRoleIds: keepOrReset('$prevHadRoleIds', {
                  $gt: [{ $size: { $ifNull: ['$roleIds', []] } }, 0],
                }),
                roleIds: keepOrReset(
                  { $setUnion: [{ $ifNull: ['$roleIds', []] }, [roleId]] },
                  [roleId],
                ),
                rankIds: keepOrReset(
                  { $setUnion: [{ $ifNull: ['$rankIds', []] }, [rank]] },
                  [rank],
                ),
                // Raise-only guard on the derived scalars, kept purely so a
                // concurrent reader mid-sync never sees a value lower than the
                // member's true highest role. The derive pass writes the real
                // (possibly lower) value once every role has been seen.
                rankId: {
                  $cond: [
                    {
                      $or: [
                        { $eq: [{ $type: '$rankId' }, 'missing'] },
                        { $gt: [rank, '$rankId'] },
                        { $and: [{ $eq: [rank, '$rankId'] }, { $gt: [roleId, '$roleId'] }] },
                      ],
                    },
                    rank,
                    '$rankId',
                  ],
                },
                roleId: {
                  $cond: [
                    {
                      $or: [
                        { $eq: [{ $type: '$roleId' }, 'missing'] },
                        { $gt: [rank, '$rankId'] },
                        { $and: [{ $eq: [rank, '$rankId'] }, { $gt: [roleId, '$roleId'] }] },
                      ],
                    },
                    roleId,
                    '$roleId',
                  ],
                },
                lastSeenSyncId: syncId,
              },
            },
          ],
          upsert: true,
        },
      });
    }

    try {
      if (memberBulkOps.length > 0) {
        await readminCollections.group_member.bulkWrite(memberBulkOps, { ordered: false });
      }
    } catch (err) {
      anyWriteFailed = true;
      console.error(`[SyncMembers-${groupId}] Chunk write failed`, err);
    }
  };

  // Page through one role and feed accumulated chunks into processChunk.
  const syncRole = async (role: typeof syncableRoles[number]) => {
    let pageToken: string | undefined = undefined;
    let roleMemberCount = 0;
    let buffer: { userIdNum: number; roleId: number; rank: number }[] = [];

    do {
      const response = await openCloudGetGroupMembersInRole('group', groupId, groupId, role.id, pageToken);
      if (response === false) {
        anyRoleFetchFailed = true;
        console.log(`[SyncMembers-${groupId}] Failed to fetch members for role ${role.name} (${role.id})`);
        return;
      }
      for (const member of response.groupMemberships) {
        const userIdStr = member.user.split('/')[1] || '';
        if (!userIdStr || allIgnoredUserSet.has(userIdStr)) continue;
        const userIdNum = Number(userIdStr);
        if (!Number.isFinite(userIdNum) || userIdNum <= 0) continue;
        buffer.push({ userIdNum, roleId: role.id, rank: role.rank });
        roleMemberCount++;
        if (buffer.length >= DB_BULK_CHUNK) {
          await processChunk(buffer);
          buffer = [];
        }
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    if (buffer.length > 0) {
      await processChunk(buffer);
    }

    totalApiMembers += roleMemberCount;
    console.log(`[SyncMembers-${groupId}] Role ${role.name} (${role.id}): ${roleMemberCount} members processed`);
  };

  console.timeLog(`SyncMembers-${workspace.groupId}`, `Streaming ${syncableRoles.length} roles (concurrency=${ROLE_FETCH_CONCURRENCY})`);
  await runWithConcurrency(syncableRoles, ROLE_FETCH_CONCURRENCY, syncRole);
  // Change events are counted by the derive pass below, not here — this stage
  // only accumulates role sets.
  console.timeLog(`SyncMembers-${workspace.groupId}`, `Streamed ${totalApiMembers} role memberships`);

  // ─── Derive pass ─────────────────────────────────────────────────────────
  // Every role has now been streamed, so each touched member's `roleIds` is
  // complete for this run. Collapse it to the derived scalars and emit the audit
  // events by diffing against the `prev*` snapshot taken at first touch.
  //
  // Guarded by the SAME condition as the leave sweep below, and for the same
  // reason: deriving from a partially-populated set would demote every member
  // whose second role never got written. On skip, the scalars keep the raise-only
  // values from processChunk — i.e. exactly the old behaviour — so a failed sync
  // degrades to "stale" rather than to data loss.
  const syncIncomplete = anyRoleFetchFailed || anyWriteFailed;
  if (syncIncomplete) {
    console.log(`[SyncMembers-${workspace.groupId}] Skipping derive pass: ${anyRoleFetchFailed ? 'one or more role fetches failed' : 'one or more chunk writes failed'}`);
  } else {
    console.timeLog(`SyncMembers-${workspace.groupId}`, 'Running derive pass');
    // Rank/order lookup for every syncable role, so the highest role can be
    // computed in-process instead of embedding a role table in each pipeline.
    const rankByRoleId = new Map<number, number>();
    for (const role of roles) rankByRoleId.set(role.id, role.rank);

    const pickHighest = (roleIds: number[]): { roleId: number; rankId: number } | null => {
      let best: { roleId: number; rankId: number } | null = null;
      for (const id of roleIds) {
        const rank = rankByRoleId.get(id);
        if (rank === undefined) continue; // role deleted mid-sync
        if (!best || rank > best.rankId || (rank === best.rankId && id > best.roleId)) {
          best = { roleId: id, rankId: rank };
        }
      }
      return best;
    };

    const deriveCursor = readminCollections.group_member.find(
      { groupId, lastSeenSyncId: syncId },
      { projection: { _id: 1, userId: 1, roleIds: 1, rankIds: 1, roleId: 1, rankId: 1, prevRoleIds: 1, prevRoleId: 1, prevRankId: 1 } },
    );

    let deriveBuffer: WithId<GroupMember>[] = [];
    let totalDerived = 0;
    let totalMigrated = 0;

    const flushDeriveBuffer = async () => {
      if (deriveBuffer.length === 0) return;
      const ops: AnyBulkWriteOperation<GroupMember>[] = [];
      const auditLogs: GroupAuditLog[] = [];
      const now = new Date();

      for (const member of deriveBuffer) {
        const roleIds = member.roleIds ?? [];
        const highest = pickHighest(roleIds);
        // Every touched member was seen in at least one syncable role, so this
        // is only null if all their roles vanished mid-run. Leave those to the
        // next sync rather than guessing.
        if (!highest) continue;

        const prevRoleIds = member.prevRoleIds ?? [];
        const isNewMember = prevRoleIds.length === 0 && member.prevRoleId === undefined;
        // First run against a member still on the old single-role shape. Their
        // stored rank may be stale (the old pipeline could only ever raise it,
        // so past demotions were never applied), which means the rank change we
        // compute here is a CORRECTION, not an event that just happened.
        // Emitting it would fire a burst of "member demoted" Discord messages
        // and flow runs for changes that happened weeks ago.
        const isMigrationPass = !isNewMember && member.prevHadRoleIds !== true;
        const oldRank = member.prevRankId ?? 0;
        const oldRole = member.prevRoleId ?? 0;

        const base = { groupId, userId: String(member.userId), date: now };

        if (isNewMember) {
          auditLogs.push({ ...base, action: 'join', newRole: highest.roleId, newRank: highest.rankId, oldRole: 0, oldRank: 0 });
        } else if (!isMigrationPass) {
          const prevSet = new Set(prevRoleIds);
          const currentSet = new Set(roleIds);
          for (const added of roleIds.filter(r => !prevSet.has(r))) {
            auditLogs.push({ ...base, action: 'role.added', roleId: added, newRole: highest.roleId, newRank: highest.rankId, oldRole, oldRank });
          }
          for (const removed of prevRoleIds.filter(r => !currentSet.has(r))) {
            auditLogs.push({ ...base, action: 'role.removed', roleId: removed, newRole: highest.roleId, newRank: highest.rankId, oldRole, oldRank });
          }
          // Promote/demote track the HIGHEST rank moving. A same-rank role swap
          // is lateral and is already described by the added/removed pair above.
          if (highest.rankId > oldRank) {
            auditLogs.push({ ...base, action: 'promote', newRole: highest.roleId, newRank: highest.rankId, oldRole, oldRank });
          } else if (highest.rankId < oldRank) {
            auditLogs.push({ ...base, action: 'demote', newRole: highest.roleId, newRank: highest.rankId, oldRole, oldRank });
          }
        } else {
          totalMigrated++;
        }

        const scalarsChanged = member.roleId !== highest.roleId || member.rankId !== highest.rankId;
        ops.push({
          updateOne: {
            filter: { _id: member._id },
            update: {
              ...(scalarsChanged ? { $set: { roleId: highest.roleId, rankId: highest.rankId } } : {}),
              $unset: { prevRoleIds: '', prevRoleId: '', prevRankId: '', prevHadRoleIds: '' },
            },
          },
        });
        if (scalarsChanged) totalDerived++;
      }

      for (const log of auditLogs) {
        maybeFireWebhook(log);
        maybeEmitFlow(log);
      }
      totalChangeEvents += auditLogs.length;

      try {
        if (ops.length > 0) await readminCollections.group_member.bulkWrite(ops, { ordered: false });
        if (auditLogs.length > 0) await readminCollections.group_audit_log.insertMany(auditLogs, { ordered: false });
      } catch (err) {
        console.error(`[SyncMembers-${groupId}] Derive pass chunk failed`, err);
      }
      deriveBuffer = [];
    };

    for await (const doc of deriveCursor) {
      deriveBuffer.push(doc as WithId<GroupMember>);
      if (deriveBuffer.length >= DB_BULK_CHUNK) {
        await flushDeriveBuffer();
      }
    }
    await flushDeriveBuffer();

    console.timeLog(`SyncMembers-${workspace.groupId}`, `Derive pass updated ${totalDerived} members' highest role (${totalMigrated} migrated from the single-role shape, events suppressed)`);
  }

  // ─── Leave sweep ─────────────────────────────────────────────────────────
  // Only safe to run if every role fetched successfully AND every chunk wrote
  // successfully; otherwise some current members may have missed their marker
  // update and would be incorrectly classified as having left.
  if (syncIncomplete) {
    console.log(`[SyncMembers-${workspace.groupId}] Skipping leave sweep: ${anyRoleFetchFailed ? 'one or more role fetches failed' : 'one or more chunk writes failed'}`);
  } else {
    console.timeLog(`SyncMembers-${workspace.groupId}`, 'Running leave sweep');
    const leftCursor = readminCollections.group_member.find(
      { groupId, lastSeenSyncId: { $ne: syncId } },
      { projection: { _id: 1, userId: 1, rankId: 1, roleId: 1 } }
    );

    let leaveBuffer: { _id: ObjectId; userId: number; rankId: number; roleId: number }[] = [];
    let totalLeft = 0;

    const flushLeaveBuffer = async () => {
      if (leaveBuffer.length === 0) return;
      const sweepNow = new Date();
      const auditLogs: GroupAuditLog[] = leaveBuffer.map(m => ({
        groupId,
        userId: String(m.userId),
        action: 'leave' as GroupAuditLogAction,
        newRole: 0,
        newRank: 0,
        oldRole: m.roleId,
        oldRank: m.rankId,
        date: sweepNow,
      }));
      for (const log of auditLogs) maybeFireWebhook(log);
      for (const log of auditLogs) maybeEmitFlow(log);
      totalChangeEvents += auditLogs.length;
      totalLeft += leaveBuffer.length;

      try {
        await readminCollections.group_audit_log.insertMany(auditLogs, { ordered: false });
        await readminCollections.group_member.deleteMany({ _id: { $in: leaveBuffer.map(m => m._id!) } });
      } catch (err) {
        console.error(`[SyncMembers-${groupId}] Leave sweep chunk failed`, err);
      }
      leaveBuffer = [];
    };

    for await (const doc of leftCursor) {
      leaveBuffer.push({
        _id: doc._id!,
        userId: Number(doc.userId),
        rankId: doc.rankId,
        roleId: doc.roleId,
      });
      if (leaveBuffer.length >= DB_BULK_CHUNK) {
        await flushLeaveBuffer();
      }
    }
    await flushLeaveBuffer();

    console.timeLog(`SyncMembers-${workspace.groupId}`, `Leave sweep removed ${totalLeft} members`);
  }

  // DISTINCT tracked members. `totalApiMembers` counts role memberships, so it
  // counts a member holding three roles three times — and this number is both
  // `trackedStaff` and the value reported to Stripe's metered billing below, so
  // that over-reported. (It has always been a per-role sum; multi-role support
  // is what makes the discrepancy visible and worth correcting.) Falls back to
  // the old value if the count fails, so billing never reports zero.
  let memberCount = totalApiMembers;
  try {
    memberCount = await readminCollections.group_member.countDocuments({ groupId });
  } catch (err) {
    console.error(`[SyncMembers-${groupId}] Distinct member count failed, falling back to role-membership total`, err);
  }
  console.log(`[SyncMembers-${groupId}] ${workspace?.groupName}: ${memberCount} distinct members (${totalApiMembers} role memberships), ${totalChangeEvents} changes`);
  console.timeLog(`SyncMembers-${workspace.groupId}`, 'Finished updating database');
  console.timeLog(`SyncMembers-${workspace.groupId}`, 'Updating workspace info');

  // Update workspace info
  const groupInfo = await Roblox.getGroupInfo(groupId);
  await readminCollections.workspace.updateOne(
    { groupId },
    {
      $set: {
        trackedStaff: memberCount,
        ...(groupInfo?.displayName ? { groupName: groupInfo.displayName } : {}),
        // A successful member sync means the workspace is fully set up. This is what
        // the creation flow polls on to know it can show the "finished" screen.
        finishedSetup: true,
      },
    }
  );
  console.timeLog(`SyncMembers-${workspace.groupId}`, 'Updating premium data');

  // Handle premium subscription logic
  if (workspace.premium?.is && workspace.premium.subscriptionId) {
    try {
      const subscription = await stripeService.subscriptions.retrieve(workspace.premium.subscriptionId);
      if (!workspace.premium.meterId) {
        const meter = await findMeterOrCreate(workspace);
        if (meter) {
          await readminCollections.workspace.updateOne({
            groupId
          }, {
            $set: {
              'premium.meterId': meter.id
            }
          })
          workspace.premium.meterId = meter.id;
          // create new product / meter for subscription
          const price = await findPriceByNameOrCreate(workspace, meter.id);
          if (!price) {
            console.log('No price found for subscription');
            return;
          }
          // Attach the metered member-count price to the subscription so usage
          // is actually billed. We must NOT pass price IDs as `items[].id` —
          // that field is a subscription-item id (si_…). To add a new item we
          // pass only `price`; existing items (e.g. the base plan) are left
          // untouched. Skip if the metered price is already on the subscription.
          const alreadyHasMeteredItem = subscription.items.data.some(
            (item) => item.price?.id === price.id
          );
          if (!alreadyHasMeteredItem) {
            await stripeService.subscriptions.update(workspace.premium.subscriptionId, {
              items: [{ price: price.id }],
            });
          }
        }
      }
      await stripeService.billing.meterEvents.create({
        event_name: `${workspace.groupId}-member-count`,
        payload: {
          stripe_customer_id: subscription.customer.toString(),
          value: memberCount.toString()
        }
      })
    } catch (e) {
      console.log(`Workspace stripe sync error for members - ${workspace.groupId}: ${e}`);
      try {
        if (e) {
          if (e?.toString()?.includes('Cannot create the usage record because the subscription has been canceled')) {
            await readminCollections.workspace.updateOne({
              _id: workspace._id
            }, {
              $set: {
                premium: {
                  is: false
                }
              }
            })
          }
        }
      } catch (e) {
        console.log('wth')
      }
    }
  }
  console.timeEnd(`SyncMembers-${workspace.groupId}`);
}
