import { TRPCError } from '@trpc/server';
import { v4 } from 'uuid';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { presignArrayOfPaths, presignUrl, uploadImage } from '~/services/CDN-service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import {
  getUserInfo,
  getUserThumbnail,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';

export const workspaceActivityUsersNotesRouter = router({
  get: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, userId } = input;
      const posts = await readminCollections.user_note.find({
        groupId,
        userId,
        $or: [
          {
            adminOnly: {
              $in: department.permissions.activity.admin
                ? [true, false]
                : [false],
            },
          },
          {
            userId: user.roblox?.id?.toString() || '0',
          },
        ],
      }, { sort: { created: -1 } }).toArray();

      const processedPosts = await Promise.all(
        posts.map(async (post) => {
          return {
            ...post,
            authorInfo: {
              ...(await getUserInfo(post.authorId)),
              thumbnail: await getUserThumbnail(post.authorId),
            },
            attachments: await presignArrayOfPaths(post.attachments, 60),
          };
        }),
      );

      return processedPosts;
    }),
  post: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        comment: z.string(),
        admin: z.boolean(),
        files: z.array(z.tuple([z.string(), z.string()])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      if (!user) return;
      const { comment, userId, admin, files } = input;

      if (!user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must have a verified Roblox account',
        });
      }

      const urls: string[] = [];
      for (const file of files) {
        const [fileName, fileData] = file;
        const id = v4();
        const filePath = `workspaces/${workspace.groupId}/imgs/${user.dbUser.robloxId}/${id}-${fileName}`;
        urls.push(filePath);
        uploadImage(filePath, fileName, fileData);
        const presignedUrl = await presignUrl(filePath, 604800);
        await sendReAdminInternalWebhookMessage('imageUploads', 'blue', 'Image upload - Note Upload', `https://cdn.readmin.app/${filePath}`, presignedUrl, undefined, presignedUrl)
      }

      await readminCollections.user_note.insertOne({
        groupId: workspace.groupId,
        userId,
        authorId: user.dbUser.robloxId,
        note: comment,
        attachments: urls,
        adminOnly: admin,
        created: new Date(),
      });
    }),
  bulkPost: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userIds: z.array(z.string()).min(1).max(200),
        comment: z.string().min(1),
        admin: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      if (!user) return { created: 0 };
      const { userIds, comment, admin } = input;

      if (!user.dbUser.robloxId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must have a verified Roblox account',
        });
      }

      const created = new Date();
      await readminCollections.user_note.insertMany(
        userIds.map((userId) => ({
          groupId: workspace.groupId,
          userId,
          authorId: user.dbUser.robloxId as string,
          note: comment,
          attachments: [] as string[],
          adminOnly: admin,
          created,
        })),
      );

      return { created: userIds.length };
    }),
  delete: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        postId: z.string()
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, postId } = input;
      if (!user) return;

      if (!department.permissions.activity.admin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have the required permissions',
        });
      }

      await readminCollections.user_note.deleteOne({
        groupId,
        _id: StringToObjectID(postId)
      });

      return {};
    })
});
