import { readminCollections } from "~/services/mongo.service";
import { getUserInfo, batchGetRobloxUsers } from "~/services/roblox.service";
import { UserInfo } from "~/services/types/roblox.types";
import { s3Client } from '~/services/CDN-service';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 } from 'uuid';
import { json2csv } from 'json-2-csv';
import { UserGameSessionDistributionSummary } from "~/services/NewMongoTypes";
import { andFilters, memberRoleIds, roleIdInFilter } from "~/services/groupMember.helpers";


// Helper functions
function getValueByPath(obj: any, path: any): any {
    return path.split('.').reduce((o: any, p: any) => (o ? o[p] : undefined), obj);
}

function mapFilterToProperty(filterName: 'totalMinutes' | 'activeMinutes' | 'typingMinutes' | 'idleMinutes' | 'messages' | 'sessions'):
    'minutes.total' | 'hours.activeMinutes' | 'minutes.typing' | 'minutes.inactive' | 'minutes.messages' | 'minutes.sessions' {
    const mapping = {
        totalMinutes: 'minutes.total',
        activeMinutes: 'minutes.active',
        typingMinutes: 'minutes.typing',
        idleMinutes: 'minutes.inactive',
        messages: 'minutes.messages',
        sessions: 'sessions',
    };
    return mapping[filterName] as any;
}

function buildFilterQuery(filters: any) {
    return filters.reduce((query: any, filter: any) => {
        const filterPath = mapFilterToProperty(filter.name);
        if (!filterPath) {
            throw new Error(`Unsupported filter category: ${filter.name}`);
        }
        const filterOperations = {
            '<': '$lt',
            '>': '$gt',
            '=': '$eq',
            '!=': '$ne',
            '<=': '$lte',
            '>=': '$gte',
        };
        //@ts-expect-error itll bff
        const operation = filterOperations[filter.type];
        if (!operation) {
            throw new Error(`Unsupported filter operation: ${filter.type}`);
        }
        query[filterPath] = { [operation]: filter.value };
        return query;
    }, {});
}

function buildSortQuery(sort: any) {
    //@ts-expect-error it'll buff
    return sort.reduce((query, sortItem) => {
        const sortPath = mapFilterToProperty(sortItem.name);
        if (!sortPath) {
            throw new Error(`Unsupported sort category: ${sortItem.name}`);
        }
        query[sortPath] = sortItem.type === 'ASC' ? 1 : -1;
        return query;
    }, {});
}

function createPseudoDistributionSummary(userId: string, groupId: string, distributionNum: number | string) {
    return {
        userId,
        groupId,
        distribution: distributionNum,
        sessions: [],
        minutes: {
            total: 0,
            active: 0,
            inactive: 0,
            typing: 0,
            messages: 0,
        },
        attendedSessions: [],
        goals: {},
        created: new Date(),
    };
}

function buildFilterPredicate(filters: any) {
    return (summary: any) => {
        return filters.every((filter: any) => {
            const filterPath = mapFilterToProperty(filter.name);
            const value = getValueByPath(summary, filterPath);
            if (value === undefined) {
                return false;
            }
            switch (filter.type) {
                case '<':
                    return value < filter.value;
                case '>':
                    return value > filter.value;
                case '=':
                    return value === filter.value;
                case '!=':
                    return value !== filter.value;
                case '<=':
                    return value <= filter.value;
                case '>=':
                    return value >= filter.value;
                default:
                    return true;
            }
        });
    };
}

function buildSortComparator(sort: any) {
    return (a: any, b: any) => {
        for (let sortItem of sort) {
            const sortPath = mapFilterToProperty(sortItem.name);
            const aValue = getValueByPath(a, sortPath);
            const bValue = getValueByPath(b, sortPath);
            if (!sortPath) {
                continue;
            }
            if (aValue < bValue) {
                return sortItem.type === 'ASC' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortItem.type === 'ASC' ? 1 : -1;
            }
        }
        return 0;
    };
}

export async function generateView(processId: string) {
    try {

        const { groupId, viewId, distributionNum, exportType } = await readminCollections.workspace_view_export.findOne({ processId }) as any;


        const foundView = await readminCollections.workspace_view.findOne({ groupId, viewId });
        if (!foundView) {
            throw new Error('not found view')
        }

        const distribution = await readminCollections.distribution.findOne({
            groupId,
            ...(distributionNum ? { num: distributionNum } : { isCurrent: true })
        });

        if (!distribution) {
            throw new Error('not found distribution')
        }

        const departments = await readminCollections.department.find({ groupId }).toArray();

        const [departmentRoles, departmentMembers] = await Promise.all([
            readminCollections.department_role.find({
                departmentId: { $in: foundView.departments },
            }).toArray(),
            readminCollections.department_users.find({
                departmentId: { $in: foundView.departments }
            }).toArray()
        ]);

        const departmentRoleMembers = await readminCollections.group_member.find(andFilters( // This is an extremly slow find. It takes a full second
            { groupId },
            {
                $or: [
                    // Matches any of the member's roles, so someone whose
                    // secondary role is in this department is included.
                    ...(roleIdInFilter(departmentRoles.map(role => role.roleId)).$or ?? []),
                    { userId: { $in: departmentMembers.map(member => parseInt(member.userId)) } }
                ]
            },
        )).toArray();

        // Build filter and sort queries
        const filterQuery = buildFilterQuery(foundView.filters);
        const sortQuery = buildSortQuery(foundView.sort);


        // Apply filter and sort queries to find distribution summaries
        const query = {
            groupId,
            distribution: distribution.num.toString(),
            userId: { $in: departmentRoleMembers.map(member => member.userId.toString()) },
            ...filterQuery,
        };

        const distributionSummary = await readminCollections.user_game_session_distribution_summary.find(query, { sort: sortQuery }).toArray(); // also an extremly slow query

        const allUserIds = departmentRoleMembers.map(member => member.userId.toString());
        const distributionSummaryWithPseudo = await Promise.all(allUserIds.map(async userId => {
            let existingSummary: UserGameSessionDistributionSummary | null | undefined = distributionSummary.find(summary => summary.userId.toString() === userId);
            if (!existingSummary) {
                existingSummary = await readminCollections.user_game_session_distribution_summary.findOne({
                    groupId,
                    distribution: distribution.num.toString(),
                    userId: userId.toString()
                })
            }
            return existingSummary || createPseudoDistributionSummary(userId, groupId, distribution.num.toString());
        }));

        let filteredAndPseudoSummaries = distributionSummaryWithPseudo.filter(buildFilterPredicate(foundView.filters));
        filteredAndPseudoSummaries.sort(buildSortComparator(foundView.sort));

        // Query for group members
        const departmentUsers = await readminCollections.department_users.find({
            departmentId: { $in: foundView.departments }
        }).toArray();
        const roleIds = departmentRoles.map(role => role.roleId);
        const userIds = departmentUsers.map(user => user.userId);
        const groupMembers = await readminCollections.group_member.find(andFilters(
            { groupId },
            {
                $or: [
                    ...(roleIdInFilter(roleIds).$or ?? []),
                    { userId: { $in: userIds.map(thing => parseInt(thing)) } }
                ]
            },
        )).toArray();

        // Process the summaries to add department information
        const computedSummary = filteredAndPseudoSummaries.map((user, i) => {
            const foundGroupMember = groupMembers.find(member => member.userId.toString() === user.userId.toString());
            // Match on ANY of the member's roles, not just their highest — the
            // role that puts them in this view's department may be a secondary.
            const memberRoles = foundGroupMember ? memberRoleIds(foundGroupMember) : [];
            const foundRole = departmentRoles.find(role => memberRoles.includes(role.roleId));
            const foundDepartment = departments.find(dep => (dep?._id?.toString() || '') === (foundRole?.departmentId?.toString() || ''));
            //@ts-expect-error itll buff
            user.department = foundDepartment;
            //@ts-expect-error itll buff
            user.position = i + 1;
            return user;
        });

        const finalUserIds = computedSummary.map(summary => parseInt(summary.userId)).filter(a => Number.isNaN(a) == false);
        const members = await readminCollections.group_member.find({
            groupId: groupId.toString(),
            'userId': {
                $in: finalUserIds
            }
        }).toArray();

        // Batch-resolve names from roblox_user (canonical source)
        const robloxUsers = await batchGetRobloxUsers(finalUserIds);

        const finishedSummary = await Promise.all(computedSummary.map(async (summary: any) => {
            const member = members.find(a => a.userId == parseInt(summary.userId))
            const rUser = robloxUsers.get(parseInt(summary.userId));
            if (member) {
                return {
                    position: summary.position,
                    name: rUser?.name || summary.userId,
                    displayName: rUser?.displayName || summary.userId,
                    id: summary.userId,
                    department: summary.department.name,
                    total: summary.minutes.total,
                    active: summary.minutes.active,
                    inactive: summary.minutes.inactive,
                    typing: summary.minutes.typing,
                    messages: summary.minutes.messages,
                    sessions: summary.sessions.length,
                    attendedSessions: summary.attendedSessions.length,
                };
            }
            const userInfoResp = await getUserInfo(summary.userId) as UserInfo;
            return {
                position: summary.position,
                name: userInfoResp.name,
                displayName: userInfoResp.displayName,
                id: summary.userId,
                department: summary.department.name,
                total: summary.minutes.total,
                active: summary.minutes.active,
                inactive: summary.minutes.inactive,
                typing: summary.minutes.typing,
                messages: summary.minutes.messages,
                sessions: summary.sessions.length,
                attendedSessions: summary.attendedSessions.length,
            };
        }));

        const exportData = exportType == 'json' ? JSON.stringify(finishedSummary) : await json2csv(finishedSummary);
        const id = v4();
        const fileName = `export.${exportType == 'json' ? 'json' : 'csv'}`
        const filePath = `workspaces/${groupId}/views/${viewId}/${v4()}/${id}-${foundView.name.split(' ').join('-')}-distribution${distribution.num}-${fileName}`;
        //const dataBuffer = Buffer.from(exportData, 'base64');
        const ContentType = exportType == 'json' ? 'application/json' : 'text/csv';
        await s3Client.send(
            new PutObjectCommand({
                Bucket: 'readmin',
                Key: filePath,
                Body: exportData,
                ACL: 'public-read',
                ContentType: ContentType,
                Metadata: {
                    'Content-Disposition': `attachment; file="${fileName}"`
                }
                //ContentEncoding: 'base64',
            }),
        );

        await readminCollections.workspace_view_export.updateOne({ processId }, { $set: { status: 'finished', url: `https://cdn.readmin.app/${filePath}`, completed: new Date() } })


        // Return the computed data
        return { url: `https://cdn.readmin.app/${filePath}` };

    } catch (e) {
        console.error(e);
        throw e; // Or handle errors as needed
    }
}