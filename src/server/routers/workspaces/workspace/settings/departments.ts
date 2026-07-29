import { v4 } from 'uuid';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { Department, DepartmentRole, DepartmentUser } from '~/services/NewMongoTypes';
import { ZodDepartmentPermisisons } from '~/services/constants/WorkspaceOwnerPermissions';
import { sendWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import {
  getUserInfo,
  getUserInfoByUsername,
  getUserThumbnail,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import StringToObjectID from '~/utils/StringToObjectID';
import { andFilters, roleIdInFilter } from '~/services/groupMember.helpers';

const zDepartmentColor = z
  .enum(['red', 'orange', 'yellow', 'green', 'teal', 'sky', 'cyan', 'blue', 'indigo', 'purple', 'rose', 'pink'])
  .optional();

export const workspaceSettingsDepartmentsRouter = router({
  getDepartments: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { } = input;
      return await readminCollections.department.find({ groupId: workspace.groupId }).toArray();
    }),
  getRoleAssignments: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      const { workspace } = ctx;
      const [departments, roleRecords] = await Promise.all([
        readminCollections.department.find({ groupId: workspace.groupId }).toArray(),
        readminCollections.department_role.find({ groupId: workspace.groupId }).toArray(),
      ]);
      const nameById = new Map(
        departments.map((dept) => [dept._id.toString(), dept.name] as const),
      );
      return roleRecords.map((record) => ({
        rankId: record.rankId,
        departmentId: record.departmentId.toString(),
        departmentName: nameById.get(record.departmentId.toString()) ?? 'Unknown department',
      }));
    }),
  getDepartmentStats: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      const { workspace } = ctx;
      const [userCounts, roleRecords] = await Promise.all([
        readminCollections.department_users
          .aggregate<{ _id: any; count: number }>([
            { $match: { groupId: workspace.groupId } },
            { $group: { _id: '$departmentId', count: { $sum: 1 } } },
          ])
          .toArray(),
        readminCollections.department_role
          .find({ groupId: workspace.groupId })
          .toArray(),
      ]);

      const stats: Record<string, { userCount: number; roleCount: number; syncedCount: number }> = {};
      const ensure = (id: string) => {
        if (!stats[id]) stats[id] = { userCount: 0, roleCount: 0, syncedCount: 0 };
        return stats[id];
      };
      for (const row of userCounts) {
        const id = row._id?.toString();
        if (!id) continue;
        ensure(id).userCount = row.count;
      }

      // Members get their department from their group roles. Summing per-role
      // counts would double-count anyone holding two roles that map to the SAME
      // department, so count distinct members per department instead: one
      // index-covered countDocuments per department (there are tens at most).
      const rolesByDepartment = new Map<string, number[]>();
      for (const record of roleRecords) {
        const id = record.departmentId?.toString();
        if (!id) continue;
        const entry = ensure(id);
        entry.roleCount += 1;
        if (!rolesByDepartment.has(id)) rolesByDepartment.set(id, []);
        rolesByDepartment.get(id)!.push(record.roleId);
      }

      await Promise.all(
        Array.from(rolesByDepartment.entries()).map(async ([departmentId, roleIds]) => {
          ensure(departmentId).syncedCount = await readminCollections.group_member.countDocuments(
            andFilters({ groupId: workspace.groupId }, roleIdInFilter(roleIds)),
          );
        }),
      );

      return stats;
    }),
  createWorkspaceDepartment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        permissions: ZodDepartmentPermisisons,
        color: zDepartmentColor,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { name, permissions, color } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const insert = await readminCollections.department.insertOne({
        groupId: workspace.groupId,
        name,
        permissions,
        color,
        created: new Date(),
      });

      return await readminCollections.department.findOne({ _id: insert.insertedId });
    }),
  bulkCreateWorkspaceDepartments: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        names: z.array(z.string()),
        permissions: ZodDepartmentPermisisons,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { names, permissions } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const cleanedNames = names
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (cleanedNames.length === 0) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Provide at least one department name');
      }

      const now = new Date();
      const insert = await readminCollections.department.insertMany(
        cleanedNames.map((name) => ({
          groupId: workspace.groupId,
          name,
          permissions,
          created: now,
        })),
      );

      return { count: insert.insertedCount };
    }),
  duplicateDepartment: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { departmentId, name } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const source = await readminCollections.department.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(departmentId),
      });
      if (!source) {
        throw ReturnNormalFailure('NOT_FOUND', 'Department not found');
      }

      const insert = await readminCollections.department.insertOne({
        groupId: workspace.groupId,
        name: name?.trim() || `${source.name} (Copy)`,
        permissions: source.permissions,
        color: source.color,
        cankRankRoles: source.cankRankRoles,
        created: new Date(),
      });

      const sourceRoles = await readminCollections.department_role.find({
        groupId: workspace.groupId,
        departmentId: source._id,
      }).toArray();

      if (sourceRoles.length > 0) {
        await readminCollections.department_role.insertMany(
          sourceRoles.map((role) => ({
            groupId: workspace.groupId,
            departmentId: insert.insertedId,
            roleId: role.roleId,
            rankId: role.rankId,
            created: new Date(),
          })),
        );
      }

      return await readminCollections.department.findOne({ _id: insert.insertedId });
    }),
  getDepartmentById: workspaceProcedure.input(
    z.object({
      groupId: z.string(),
      departmentId: z.string(),
    })).query(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { departmentId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const foundDepartment = await readminCollections.department.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(departmentId),
      });
      if (!foundDepartment) {
        throw ReturnNormalFailure('NOT_FOUND', 'Department not found');
      }
      type ModifiedUser = {
        userInfo: any;
        thumbnail: string;
      }
      type ModifiedDepUser = DepartmentUser & ModifiedUser;
      type toReturn = Department & { staff: ModifiedDepUser[]; roles: DepartmentRole[]; };

      const foundDepartmentt = foundDepartment as toReturn;

      const staff = await readminCollections.department_users.find({
        groupId: workspace.groupId,
        departmentId: foundDepartment._id,
      }).toArray() as ModifiedDepUser[];
      const roles = await readminCollections.department_role.find({
        groupId: workspace.groupId,
        departmentId: foundDepartment._id,
      }).toArray();

      for (const member of staff) {
        member.userInfo = await getUserInfo(member.userId);
        member.thumbnail = await getUserThumbnail(member.userId);
      }

      foundDepartmentt.staff = staff;
      foundDepartmentt.roles = roles;
      return foundDepartmentt;
    }),
  updateDepartmentById: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
        name: z.string(),
        permissions: ZodDepartmentPermisisons,
        cankRankRoles: z.array(z.string()).optional(),
        color: zDepartmentColor,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { departmentId, name, permissions, cankRankRoles, color } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const foundDepartment = await readminCollections.department.findOne({
        groupId: workspace.groupId, _id: StringToObjectID(departmentId),
      });
      if (!foundDepartment) {
        throw ReturnNormalFailure('NOT_FOUND', 'Not found');
      }

      await readminCollections.department.updateOne({
        _id: foundDepartment._id
      }, {
        $set: {
          name,
          permissions,
          cankRankRoles,
          color,
        }
      });

      return foundDepartment;
    }),
  deleteDepartmentById: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { departmentId, groupId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const foundDepartment = await readminCollections.department.findOne({
        groupId: workspace.groupId, _id: StringToObjectID(departmentId)
      });
      if (!foundDepartment) {
        throw ReturnNormalFailure('NOT_FOUND', 'Not found');
      }
      await readminCollections.department.deleteOne({ _id: foundDepartment._id });
      await readminCollections.department_users.deleteMany({ groupId, departmentId: foundDepartment._id });
      await readminCollections.department_role.deleteMany({ groupId, departmentId: foundDepartment._id });

      return foundDepartment;
    }),
  addDepartmentMember: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
        username: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { departmentId, username } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      return new Promise((resolve, err) => {
        getUserInfoByUsername(username)
          .then(async (foundUser) => {


            const userExists = await readminCollections.department_users.findOne({
              userId: foundUser.id.toString(),
              groupId: workspace.groupId,
            });
            if (userExists) {
              throw ReturnNormalFailure('BAD_REQUEST', 'User is already in a department');
            }
            const departmentExists = await readminCollections.department.findOne({
              _id: StringToObjectID(departmentId),
              groupId: workspace.groupId,
            });
            if (!departmentExists) {
              throw ReturnNormalFailure('BAD_REQUEST', 'Department does not exist');
            }
            await readminCollections.department_users.insertOne({
              userId: foundUser.id.toString(),
              groupId: workspace.groupId,
              departmentId: departmentExists._id,
              created: new Date(),
            });


            const foundLoggingMechanisms = await readminCollections.discord_logging.find({
              groupId: department.groupId,
              event: { $in: ['all', 'new-department-user'] }
            }).toArray();

            for (const webhook of foundLoggingMechanisms) {
              const url = webhook.webhookUrl;
              const userInfo = await getUserInfo(foundUser.id.toString());
              const userThumbnail = await getUserThumbnail(foundUser.id.toString());
              await sendWebhookMessage(url, 'green', 'New Department User', `${userInfo?.name} was added to the department by ${user.roblox?.name}`, userThumbnail);
            }

            resolve(true);



          })
          .catch((e) => {
            err(ReturnNormalFailure('BAD_REQUEST', e));
          });
      });
    }),
  removeDepartmentMember: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const { userId, departmentId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const foundDepartment = await readminCollections.department.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(departmentId)
      });
      if (!foundDepartment) {
        throw ReturnNormalFailure('NOT_FOUND', 'Not found');
      }
      const foundMember = await readminCollections.department_users.findOne({
        userId,
        departmentId: foundDepartment._id,
        groupId: workspace.groupId,
      });
      if (!foundMember) {
        throw ReturnNormalFailure('NOT_FOUND', 'Could not find user');
      }
      await readminCollections.department_users.deleteOne({
        _id: foundMember._id,
      });


      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: department.groupId,
        event: { $in: ['all', 'removed-department-user'] }
      }).toArray();

      for (const webhook of foundLoggingMechanisms) {
        const url = webhook.webhookUrl;
        const userInfo = await getUserInfo(foundMember.userId.toString());
        const userThumbnail = await getUserThumbnail(foundMember.userId.toString());
        await sendWebhookMessage(url, 'red', 'Removed Department User', `${userInfo?.name} was removed from the department by ${user.roblox?.name}`, userThumbnail);
      }

      return { success: true };
    }),
  addDepartmentRole: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { departmentId, roleId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const foundDepartment = await readminCollections.department.findOne({
        groupId: workspace.groupId, _id: StringToObjectID(departmentId),
      });
      if (!foundDepartment) {
        throw ReturnNormalFailure('NOT_FOUND', 'Could not find department');
      }
      const foundRole = await readminCollections.department_role.findOne({
        rankId: parseInt(roleId),
        departmentId: foundDepartment._id,
        groupId: workspace.groupId,
      });
      if (foundRole) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Role already exists');
      }
      const groupRoles = await readminCollections.group_role.find({
        groupId: workspace.groupId,
      }).toArray();
      if (!groupRoles) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Could not find roles');
      }
      const foundRank = groupRoles.find(
        (role) => role.rank.toString() == roleId.toString(),
      );
      if (!foundRank) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Could not find rank');
      }

      await readminCollections.department_role.insertOne({
        groupId: workspace.groupId,
        departmentId: foundDepartment._id,
        roleId: foundRank.id,
        rankId: foundRank.rank,
        created: new Date(),
      });

      return { success: true };
    }),
  removeDepartmentRole: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { departmentId, roleId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const foundDepartment = await readminCollections.department.findOne({
        groupId: workspace.groupId, _id: StringToObjectID(departmentId)
      });
      if (!foundDepartment) {
        throw ReturnNormalFailure('NOT_FOUND', 'Could not find department');
      }
      const foundRole = await readminCollections.department_role.findOne({
        rankId: parseInt(roleId),
        departmentId: foundDepartment._id,
        groupId: workspace.groupId,
      });
      if (!foundRole) {
        throw ReturnNormalFailure('NOT_FOUND', 'Could not find role');
      }

      await readminCollections.department_role.deleteOne({
        _id: foundRole._id,
      });

      return { success: true };
    }),
  setDepartmentRoles: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        departmentId: z.string(),
        rankIds: z.array(z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { departmentId, rankIds } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const foundDepartment = await readminCollections.department.findOne({
        groupId: workspace.groupId,
        _id: StringToObjectID(departmentId),
      });
      if (!foundDepartment) {
        throw ReturnNormalFailure('NOT_FOUND', 'Could not find department');
      }

      const groupRoles = await readminCollections.group_role.find({
        groupId: workspace.groupId,
      }).toArray();

      // Only keep ranks that exist in the group, ignore guest rank 0.
      const desiredRanks = Array.from(new Set(rankIds)).filter((rank) =>
        groupRoles.some((role) => role.rank === rank && role.rank !== 0),
      );

      // A role may only belong to a single department. Reject ranks already
      // assigned to a different department.
      const conflicting = await readminCollections.department_role.find({
        groupId: workspace.groupId,
        departmentId: { $ne: foundDepartment._id },
        rankId: { $in: desiredRanks },
      }).toArray();
      if (conflicting.length > 0) {
        throw ReturnNormalFailure(
          'CONFLICT',
          'One or more of these roles are already assigned to another department.',
        );
      }

      const existing = await readminCollections.department_role.find({
        groupId: workspace.groupId,
        departmentId: foundDepartment._id,
      }).toArray();
      const existingRanks = new Set(existing.map((role) => role.rankId));

      const toAdd = desiredRanks.filter((rank) => !existingRanks.has(rank));
      const toRemove = existing.filter((role) => !desiredRanks.includes(role.rankId));

      if (toRemove.length > 0) {
        await readminCollections.department_role.deleteMany({
          _id: { $in: toRemove.map((role) => role._id) },
        });
      }

      if (toAdd.length > 0) {
        const now = new Date();
        await readminCollections.department_role.insertMany(
          toAdd.map((rank) => {
            const groupRole = groupRoles.find((role) => role.rank === rank);
            return {
              groupId: workspace.groupId,
              departmentId: foundDepartment._id,
              roleId: groupRole?.id ?? rank,
              rankId: rank,
              created: now,
            };
          }),
        );
      }

      return { success: true };
    }),
});
