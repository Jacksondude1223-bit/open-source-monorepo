import { sendWebhookMessage } from "~/services/discord.service";
import { readminCollections } from "~/services/mongo.service";
import { DiscordLogType } from "~/services/NewMongoTypes/DiscordLogging.type";
import { GroupAuditLog, GroupAuditLogAction } from "~/services/NewMongoTypes/GroupAuditLog.type";
import * as Roblox from '~/services/roblox.service';

export default async function groupUserEventHandler(event: GroupAuditLog) {
    try {
        // Exhaustive by type. `null` means "no Discord logging for this action":
        // the role-set actions have no message template below, so falling through
        // to the old `|| ['all']` default would match every 'all' webhook, pay for
        // a user-info + thumbnail fetch, and then send nothing — exactly the
        // Roblox thumbnail hammering the short-circuit below exists to prevent.
        const EVENTS_FOR_ACTION: Record<GroupAuditLogAction, DiscordLogType[] | null> = {
            demote: ['all', 'member-demotion'],
            promote: ['all', 'member-promotion'],
            join: ['all', 'new-group-member'],
            leave: ['all', 'removed-group-member'],
            'role.added': null,
            'role.removed': null,
        };
        const inEvents = EVENTS_FOR_ACTION[event.action];
        if (!inEvents) return;

        const foundLoggingMechanisms = await readminCollections.discord_logging.find({
            groupId: event.groupId,
            event: { $in: inEvents }
        }).toArray();

        // Short-circuit: if no Discord logging is configured for this group/action,
        // skip the expensive user info + thumbnail + group_role lookups entirely.
        // Without this guard, every sync audit event triggered a Roblox thumbnail
        // request even when no webhook was going to be sent.
        if (foundLoggingMechanisms.length === 0) return;

        // Hoist per-event lookups out of the per-mechanism loop — these don't
        // depend on the logging mechanism, so fetching them once per event is
        // correct (previously they ran once per mechanism).
        const needsRoles = event.action === 'promote' || event.action === 'demote';
        const [userInfo, userThumbnail, roles] = await Promise.all([
            Roblox.getUserInfo(event.userId),
            Roblox.getUserThumbnail(event.userId),
            // Only need roles for promote/demote messages
            needsRoles
                ? readminCollections.group_role.find({ groupId: event.groupId }).toArray()
                : Promise.resolve([]),
        ]);

        for (const loggingMechanism of foundLoggingMechanisms) {
            const url = loggingMechanism.webhookUrl;

            if (event.action == 'join') {
                await sendWebhookMessage(url, 'green', 'New Group Member', `${userInfo?.name} has joined the group`, userThumbnail);
            }
            if (event.action == 'promote') {
                const oldRole = roles.find(r => r.id == event.oldRole);
                const newRole = roles.find(r => r.id == event.newRole);
                await sendWebhookMessage(url, 'green', 'Member Promotion', `${userInfo?.name} has been promoted from ${oldRole?.name} to ${newRole?.name}`, userThumbnail);
            }
            if (event.action == 'demote') {
                const oldRole = roles.find(r => r.id == event.oldRole);
                const newRole = roles.find(r => r.id == event.newRole);
                await sendWebhookMessage(url, 'red', 'Member Demotion', `${userInfo?.name} has been demoted from ${oldRole?.name} to ${newRole?.name}`, userThumbnail);
            }
            if (event.action == 'leave') {
                await sendWebhookMessage(url, 'red', 'Removed Group Member', `${userInfo?.name} has left the group`, userThumbnail);
            }

        }
    } catch (e) {
        console.log(e, 'groupusereventhandler')
    }

}