import { readminCollections } from '~/services/mongo.service';
import { PunishmentVisibility, Workspace, WriteUps } from "../NewMongoTypes";
import { getDepartmentForUserId, getRolesDepartmentCanRankTo, getWorkspaceCurrentDistribution } from "../workspaces.service";
import { uploadImage, presignUrl } from "../CDN-service";
import { v4 } from "uuid";
import { dmUserDiscord, sendReAdminInternalWebhookMessage, sendWebhookMessage } from "../discord.service";
import { getGroupInfo, getProcessedUserObject, getUserInfo, getUserThumbnail } from "../roblox.service";
import { rankUser } from "../group-actions.service";
import { ReturnNormalFailure } from "~/utils/NormalResponseTypes";
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';
import { emitFlowEvent } from '~/services/flows/flowEngine.service';


export async function handleCreationOfLoggingEvent(loggingEvent: WriteUps, workspace: Workspace) {
    const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'member-punishment'] }
    }).toArray();

    const action = { promotion: 'promote', suspension: 'suspend', termination: 'terminate', writeup: 'write up', demotion: 'demote' }[loggingEvent.type];
    const actionPastTense = { promotion: 'promoted', suspension: 'suspended', termination: 'terminated', writeup: 'wrote up', demotion: 'demoted' }[loggingEvent.type];

    const actioningUserInfo = await getUserInfo(loggingEvent.disciplinarianId);

    for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getProcessedUserObject(loggingEvent.userId);
        const userThumbnail = await getUserThumbnail(loggingEvent.userId);

        await sendWebhookMessage(url, 'red', 'New Logging Event', `${userInfo?.name} has been ${actionPastTense} by ${actioningUserInfo?.name || 'unknown'}${loggingEvent.expires ? ` until ${new Date(loggingEvent.expires as Date).toLocaleDateString()}` : ''} for ${loggingEvent.reason}`, userThumbnail);
    }
    
    if (loggingEvent.pendingApproval !== true) {
        if (loggingEvent.notify) {
            const groupInfo = await getGroupInfo(loggingEvent.groupId);
            await dmUserDiscord(
                loggingEvent.userId,
                `You were ${actionPastTense} by ${actioningUserInfo?.name || 'unknown'
                } in ${groupInfo?.displayName || loggingEvent.groupId} ${loggingEvent.expires ? `until ${new Date(loggingEvent.expires as Date).toLocaleDateString() || loggingEvent.expires}` : ''} ${loggingEvent?.pendingApproval ? 'awaiting approval' : ''}`,
                loggingEvent.reason,
                'red',
                undefined,
                { workspace, category: 'moderation', variables: { groupName: groupInfo?.displayName || loggingEvent.groupId, moderatorName: actioningUserInfo?.name || 'unknown', action: actionPastTense, reason: loggingEvent.reason, expiry: loggingEvent.expires ? new Date(loggingEvent.expires as Date).toLocaleDateString() : '' } }
            )
        }

        if (loggingEvent.rankTo && typeof (loggingEvent.rankTo) == 'string') {
            const department = await getDepartmentForUserId(loggingEvent.disciplinarianId.toString(), workspace.groupId);
            if (!department) {
                throw ReturnNormalFailure('BAD_REQUEST', `User is not in a department`);
            }
            const rankableRanks = await getRolesDepartmentCanRankTo(workspace, department);
            if (rankableRanks.map(r => r.id.toString()).includes(loggingEvent.rankTo) == false) {
                throw ReturnNormalFailure('BAD_REQUEST', `Rank ${loggingEvent.rankTo} is not rankable by the disciplinarian`);
            }
            const resp = await rankUser('group', workspace.groupId, workspace.groupId, loggingEvent.userId, loggingEvent.rankTo?.toString() as string, 'user', { sourceUserId: (loggingEvent.disciplinarianId || '').toString(), employeeHistoryType: loggingEvent.type });
            if (resp !== true) {
                throw ReturnNormalFailure('BAD_REQUEST', `Failed to ${action} user, however, logging was successfully created. ${resp}`)
            }
        }
    }
}


export async function createHistory({
    groupId,
    actioningUser,
    userId,
    reason,
    type,
    notify,
    role,
    expires,
    approval_required,
    files,
    visibility,
}: {
    groupId: string,
    actioningUser: string,
    userId: string,
    reason: string,
    type: 'promotion' | 'writeup' | 'suspension' | 'termination' | 'demotion',
    notify: boolean,
    role?: string | false,
    expires?: Date,
    approval_required: boolean,
    files: [string, string][],
    visibility?: PunishmentVisibility,
}) {
    if (await isUserGDPRIgnored(userId)) {
        throw new Error('User is GDPR ignored');
    }

    const workspace = await readminCollections.workspace.findOne({ groupId });
    if (!workspace) {
        throw new Error('Invalid workspace');
    }

    const [groupMember, rankTo, currentDistribution] = await Promise.all([
        readminCollections.group_member.findOne({
            groupId: workspace.groupId,
            userId: parseInt(userId)
        }), readminCollections.group_role.findOne({
            groupId: workspace.groupId,
            rank: parseInt(role as string)
        }),
        getWorkspaceCurrentDistribution(workspace.groupId)
    ]);


    const urls: string[] = [];
    if (files) {
        for (const file of files) {
            const [fileName, fileData] = file;
            const filePath = `workspaces/${workspace.groupId}/imgs/${actioningUser}/${v4()}-${fileName}`;
            urls.push(filePath);
            await uploadImage(filePath, fileName, fileData);
            const presignedUrl = await presignUrl(filePath, 604800);
            await sendReAdminInternalWebhookMessage('imageUploads', 'blue', `Image upload - ${type} Creation`, `https://cdn.readmin.app/${filePath}`, presignedUrl, undefined, presignedUrl)
        }
    }

    const newLogItem = {
        groupId: workspace.groupId,
        userId: parseInt(userId),
        disciplinarianId: parseInt(actioningUser),
        reason,
        type,
        notify,
        rankFrom: groupMember?.roleId?.toString() || '0',
        rankTo: rankTo?.id?.toString() || false,
        distribution: currentDistribution,
        ...(visibility && visibility !== 'public' ? { visibility } : {}),
        ...(expires ? { expires } : {}),
        created: new Date(),
        ...(approval_required ? {
            pendingApproval: true,
        } : {}),
        evidence: urls
    } as WriteUps;

    const created = await readminCollections.write_ups.insertOne(newLogItem);
    const found = await readminCollections.write_ups.findOne({ _id: created.insertedId });
    if (found) {
        await handleCreationOfLoggingEvent(found, workspace);
        // Notify the Flows engine — fire-and-forget, never blocks/breaks this mutation.
        emitFlowEvent({
            groupId: workspace.groupId,
            type: 'writeup.created',
            subjectUserId: found.userId.toString(),
            actorUserId: found.disciplinarianId.toString(),
            refId: found._id?.toString(),
            event: {
                writeUp: {
                    type: found.type,
                    reason: found.reason,
                    notify: found.notify,
                    rankTo: found.rankTo,
                    rankFrom: found.rankFrom,
                },
            },
        });
    }
    return found;

}