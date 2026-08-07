import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { getTeamById } from '~/services/teams.service';
import { uploadImage, publicUrl } from '~/services/CDN-service';
import { v4 } from 'uuid';
import StringToObjectID from '~/utils/StringToObjectID';
import { assertCanManageTeam, requireTeamView } from './auth';

export const workspaceTeamsDocumentsRouter = router({
  getDocuments: workspaceProcedure
    .input(z.object({ groupId: z.string(), teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireTeamView(ctx);
      const docs = await readminCollections.team_document
        .find({
          groupId: input.groupId,
          teamId: StringToObjectID(input.teamId),
        })
        .sort({ pinned: -1, uploadedAt: -1 })
        .toArray();
      return docs;
    }),

  upload: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        fileName: z.string(),
        fileUrl: z.string().optional(),
        fileData: z.string().optional(), // base64 data URL for direct CDN upload
        fileSize: z.number(),
        description: z.string().optional(),
        category: z.enum(['guide', 'roster', 'policy', 'other']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      const team = await getTeamById(ctx.workspace.groupId, input.teamId);
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found.' });

      // Determine the file URL: direct upload takes priority over a provided URL
      let fileUrl = input.fileUrl ?? '';
      if (input.fileData) {
        const ext = (input.fileName.split('.').pop() ?? 'bin').toLowerCase();
        const cdnPath = `team-documents/${input.groupId}/${input.teamId}/${v4()}.${ext}`;
        await uploadImage(cdnPath, input.fileName, input.fileData, 'public-read');
        // The driver knows where public objects are served from — a bucket's CDN
        // host, or this API's /files/public route when storage is on local disk.
        fileUrl = publicUrl(cdnPath);
      }

      if (!fileUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Provide a file URL or upload a file.' });
      }

      const doc = await readminCollections.team_document.insertOne({
        groupId: input.groupId,
        teamId: StringToObjectID(input.teamId),
        fileName: input.fileName,
        fileUrl,
        fileSize: input.fileSize,
        category: input.category || 'other',
        description: input.description || '',
        uploadedBy: ctx.user.dbUser.robloxId!,
        uploadedAt: new Date(),
        pinned: false,
      });

      return doc;
    }),

  delete: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        documentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      const result = await readminCollections.team_document.deleteOne({
        _id: StringToObjectID(input.documentId),
        groupId: input.groupId,
        teamId: StringToObjectID(input.teamId),
      });
      if (result.deletedCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
      }
    }),

  togglePin: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        teamId: z.string(),
        documentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageTeam(ctx, input.teamId);
      const doc = await readminCollections.team_document.findOne({
        _id: StringToObjectID(input.documentId),
        groupId: input.groupId,
        teamId: StringToObjectID(input.teamId),
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });

      await readminCollections.team_document.updateOne(
        { _id: doc._id },
        { $set: { pinned: !doc.pinned } },
      );
    }),
});
