import { TRPCError } from '@trpc/server';
import { Filter, ObjectId, WithId } from 'mongodb';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { Department, GroupMember } from '~/services/NewMongoTypes';
import { readminCollections } from '~/services/mongo.service';
import { batchGetRobloxUsers } from '~/services/roblox.service';
import { router } from '~/server/trpc';
import { andFilters, roleIdFilter } from '~/services/groupMember.helpers';

export interface MemberResponse extends GroupMember {
  name: string;
  displayName: string;
  rankName: string;
  thumbnail: string;
  department: Department;
}

const DEFAULT_THUMBNAIL = 'https://cdn.readmin.app/readmin-public/backon-hair.png';

const PAGE_SIZE = 30;

// Members are ordered by join date with `_id` as the tie-breaker, so the cursor
// has to carry BOTH parts. Cursoring on `_id` alone (as this used to) compared
// against a field the results were not ordered by: `_id` follows insertion
// order, `created` follows the Roblox join date, and the two are unrelated for
// members written by a bulk sync. Pages then silently skipped members, or
// filtered everything out and returned an empty page — which is what made
// "Load more" appear to do nothing.
function encodeCursor(member: WithId<GroupMember>): string {
  return `${new Date(member.created ?? 0).getTime()}_${member._id.toString()}`;
}

function decodeCursor(cursor: string): { created: Date; id: ObjectId } | null {
  const split = cursor.lastIndexOf('_');
  if (split <= 0) return null;
  const createdMs = Number(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (!Number.isFinite(createdMs) || !ObjectId.isValid(id)) return null;
  return { created: new Date(createdMs), id: new ObjectId(id) };
}

export const workspaceActivityStaffRouter = router({
  getUsersInRole: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        roleId: z.string(),
        cursor: z.string().optional(),
        sort: z.enum(['recent', 'oldest']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      if (!user) return;
      const { groupId, roleId, cursor, sort } = input;

      // Perform request
      const foundRole = await readminCollections.group_role.findOne({
        groupId: groupId,
        id: parseInt(roleId),
      });

      if (!foundRole) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Role does not exist',
        });
      }

      // Matches on the member's full role set, so a member holding several roles
      // now appears under each of them — which is also what makes this count
      // reconcile with the Roblox per-role count shown in the sidebar.
      const roleFilter: Filter<GroupMember> = andFilters(
        { groupId: groupId },
        roleIdFilter(parseInt(roleId)),
      );
      const query: Filter<GroupMember> = { ...roleFilter };
      // `oldest` walks the list ascending (oldest -> newest), `recent`
      // descending (newest -> oldest). The cursor comparison has to follow the
      // same direction so paging continues from the correct end.
      const sortDir = sort === 'oldest' ? 1 : -1;
      const decoded = cursor ? decodeCursor(cursor) : null;
      if (decoded) {
        const op = sortDir === 1 ? '$gt' : '$lt';
        query.$or = [
          { created: { [op]: decoded.created } },
          { created: decoded.created, _id: { [op]: decoded.id } },
        ];
      }

      // Fetch one extra row to find out whether another page exists, rather than
      // making the client infer it by comparing against the role's Roblox member
      // count. The two should now agree, but the server is still the authority
      // on whether the page it just built was truncated — inferring it on the
      // client left "Load more" on screen forever with nothing left to fetch.
      const [page, total] = await Promise.all([
        readminCollections.group_member
          .find(query, { limit: PAGE_SIZE + 1, sort: { created: sortDir, _id: sortDir } })
          .toArray(),
        readminCollections.group_member.countDocuments(roleFilter),
      ]);
      const hasMore = page.length > PAGE_SIZE;
      const membersInRole = hasMore ? page.slice(0, PAGE_SIZE) : page;
      const departments = await readminCollections.department.find({ groupId }).toArray();

      // Batch-resolve names + thumbnails from roblox_user (single DB query)
      const memberUserIds = membersInRole.map(m => m.userId);
      const robloxUsersMap = await batchGetRobloxUsers(memberUserIds);
      const roleName = foundRole.name || '';

      const members: MemberResponse[] = membersInRole.map((member) => {
        const robloxUser = robloxUsersMap.get(member.userId);
        return {
          ...member,
          name: robloxUser?.name || member.userId.toString(),
          displayName: robloxUser?.displayName || member.userId.toString(),
          rankName: roleName,
          thumbnail: robloxUser?.headshotUrl || DEFAULT_THUMBNAIL,
          department: departments.find(d => d._id === member.departmentId) as Department,
        };
      });

      return {
        members,
        // `total` is the number of members ReAdmin actually holds for this role,
        // which is what the list can page through — not the role's Roblox
        // member count shown in the sidebar.
        total,
        nextCursor: hasMore && membersInRole.length > 0
          ? encodeCursor(membersInRole[membersInRole.length - 1]!)
          : null,
      };
    }),
});
