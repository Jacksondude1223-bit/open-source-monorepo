import { TRPCError } from '@trpc/server';
import { v4 } from 'uuid';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { presignArrayOfPaths, presignUrl, uploadImage } from '~/services/CDN-service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { processObjectsWithUserIdToUserData } from '~/services/roblox.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';
import { departmentScopeIds } from '~/services/departmentPermissions.service';

export const workspaceFeedRouter = router({
  getWorkspaceFeed: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { } = input;
      // Get feed
      const ors = [
        {
          departments: { $exists: false },
        },
        {
          // Every department the member's roles map into, not just the primary
          // one — a member holding several roles belongs to all of them.
          departments: { $in: departmentScopeIds(department) },
        },
      ];
      if (department.permissions.admin) {
        ors.push({
          departments: { $exists: true },
        });
      }
      const posts = await readminCollections.feed.find({
        groupId: workspace.groupId,
        $or: ors,
      }, {
        sort: { created: -1 },
      }).toArray();

      const processedPosts = await processObjectsWithUserIdToUserData(posts);
      const processedPostsWithSignedUrls = await Promise.all(processedPosts.map(async (post) => {
        const urls = await presignArrayOfPaths(post.attachments, 60);
        return {
          ...post,
          attachments: urls,
        };
      }))
      return processedPostsWithSignedUrls;
    }),
  postWorkspaceFeed: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        comment: z.string(),
        departments: z.array(z.string()),
        files: z.array(z.tuple([z.string(), z.string()])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { comment, departments, files } = input;

      if (!user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must have a verified Roblox account',
        });
      }

      if (
        !department.permissions.feed.postPublic &&
        !department.permissions.feed.postDepartment
      ) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to post in this category',
        });
      }

      // User can post to department only, and user is not in department
      if (
        !(
          (department.permissions.feed.postDepartment == true &&
            departments.length !== 0) ||
          (departments.length == 0 && department.permissions.feed.postPublic)
        )
      ) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to post in this category',
        });
      }

      const urls: string[] = [];
      for (const file of files) {
        const [fileName, fileData] = file;
        const id = v4();
        const filePath = `workspaces/${workspace.groupId}/imgs/${user.dbUser.robloxId}/${id}-${fileName}`;
        urls.push(filePath);
        await uploadImage(filePath, fileName, fileData);
        const presignedUrl = await presignUrl(filePath, 604800);
        await sendReAdminInternalWebhookMessage('imageUploads', 'blue', 'Image upload - Feed Upload', `https://cdn.readmin.app/${filePath}`, presignedUrl, undefined, presignedUrl)
      }

      const foundDepartments = await readminCollections.department.find({
        _id: { $in: departments.map((a) => StringToObjectID(a)) },
      }).toArray()

      await readminCollections.feed.insertOne({
        groupId: workspace.groupId,
        departments: foundDepartments.map((a) => a._id),
        userId: user.dbUser.robloxId,
        content: comment,
        attachments: urls,
        created: new Date(),
      })
    }),
  deletePost: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        postId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { groupId, postId } = input;
      if (!department.permissions.admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to delete posts',
        });
      }

      await readminCollections.feed.deleteOne({ _id: StringToObjectID(postId) });
      return true;
    })
});
