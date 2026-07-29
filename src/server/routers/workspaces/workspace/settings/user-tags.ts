import { router } from '~/server/trpc';
import { workspacePremiumProcedure, workspaceProcedure } from '~/server/procedures';
import { z } from 'zod';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { v4 } from 'uuid';
import { readminCollections } from '~/services/mongo.service';
import { TagColor } from '~/services/NewMongoTypes/Tag.type';

export const workspaceSettingsUserTagsRouter = router({
  get: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId } = input;
      return await readminCollections.workspace_tag.find({ groupId }).toArray();
    }),
  create: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        color: z.custom<TagColor>(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, name, color } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }
      const newTag = {
        groupId: groupId,
        tagId: v4(),
        name: name,
        color: color,
        created: new Date(),
      }

      await readminCollections.workspace_tag.insertOne(newTag);

      return newTag;
    }),
  edit: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        tagId: z.string(),
        name: z.string(),
        color: z.custom<TagColor>(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, tagId, name, color } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const tag = await readminCollections.workspace_tag.findOne({ groupId, tagId });
      if (!tag) {
        throw ReturnNormalFailure(
          'NOT_FOUND',
          'Tag not found',
        );
      }

      await readminCollections.workspace_tag.updateOne({ _id: tag._id }, {
        $set: {
          name,
          color
        }
      })

      return tag;
    }),
  delete: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        tagId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, tagId } = input;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      const tag = await readminCollections.workspace_tag.findOne({ groupId, tagId });
      if (!tag) {
        throw ReturnNormalFailure(
          'NOT_FOUND',
          'Tag not found',
        );
      }
      await readminCollections.workspace_tag_member.deleteMany({ groupId, tagId });
      await readminCollections.workspace_tag.deleteOne({ _id: tag._id });


      return true;
    }),

  // User management


  getUser: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, userId } = input;
      return await readminCollections.workspace_tag_member.find({ groupId, userId }).toArray();
    }),
  addMemberToTag: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        tagId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, tagId, userId } = input;

      const existingMember = await readminCollections.workspace_tag_member.findOne({ groupId, tagId, userId });
      if (existingMember) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'User already in tag',
        );
      }

      const newMember = {
        groupId: groupId,
        tagId: tagId,
        userId: userId,
        created: new Date()
      }

      await readminCollections.workspace_tag_member.insertOne(newMember);


      return newMember;
    }),
  // Bulk-assign a single tag to many users at once (used by view bulk actions).
  addMembersToTag: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        tagId: z.string(),
        userIds: z.array(z.string()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { groupId, tagId, userIds } = input;

      const existing = await readminCollections.workspace_tag_member
        .find({ groupId, tagId, userId: { $in: userIds } })
        .toArray();
      const existingSet = new Set(existing.map((m) => m.userId.toString()));

      const toInsert = userIds
        .filter((userId) => !existingSet.has(userId.toString()))
        .map((userId) => ({ groupId, tagId, userId, created: new Date() }));

      if (toInsert.length > 0) {
        await readminCollections.workspace_tag_member.insertMany(toInsert);
      }

      return { added: toInsert.length, skipped: userIds.length - toInsert.length };
    }),
  removeMemberFromTag: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        tagId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, tagId, userId } = input;

      const existingMember = await readminCollections.workspace_tag_member.findOne({ groupId, tagId, userId });
      if (!existingMember) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'User not in tag',
        );
      }

      await readminCollections.workspace_tag_member.deleteOne({ _id: existingMember._id });

      return true;
    }),
})