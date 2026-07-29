import { z } from 'zod';
import { v4 } from 'uuid';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections, MongoTypes } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { isSelfHosted } from '~/utils/deployment';
import {
  generateWorkspaceExport,
  presignExportFiles,
} from '~/services/businessLogic/generateWorkspaceExport';
import {
  IMPORT_BATCH_LIMIT,
  importCdnFile,
  importCollectionBatch,
  summariseImportManifest,
} from '~/services/workspaceImport.service';
import { WORKSPACE_COLLECTIONS } from '~/services/workspaceExportCollections';

/**
 * Full workspace takeout, for the ReAdmin shutdown: an admin exports
 * everything the workspace owns (all collections plus a manifest of its CDN
 * files), and — on a self-hosted instance only — loads a bundle back in.
 *
 * Exports run in the background and the UI polls `status`. Only one may run per
 * workspace at a time, which is what stops an impatient admin from starting six
 * full-database scans in a row.
 */

/** Reject a caller who is not a workspace admin. */
function requireAdmin(ctx: any) {
  if (!ctx.department.permissions.admin) {
    throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to do this operation');
  }
}

/**
 * Import endpoints exist only where there is something to import into.
 * Keyed off the request's host so the same build serves readmin.app and a
 * self-hosted deployment correctly — the pattern the shutdown gates already use.
 */
function requireSelfHosted(ctx: any) {
  if (!isSelfHosted(ctx.host)) {
    throw ReturnNormalFailure(
      'BAD_REQUEST',
      'Importing is only available on a self-hosted ReAdmin instance',
    );
  }
}

/** A job left untouched this long is treated as dead, not running. */
const STALE_JOB_MS = 60 * 60 * 1000;

export const workspaceSettingsDataExportRouter = router({
  /** Whether this deployment can import, so the UI knows what to render. */
  deployment: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      return {
        selfHosted: isSelfHosted(ctx.host),
        collectionCount: WORKSPACE_COLLECTIONS.length,
      };
    }),

  /** Start a background export. Returns the processId to poll. */
  start: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const { groupId } = input;

      // One at a time per workspace. A stalled job (process restarted
      // mid-export) stops counting after an hour so an admin is never stuck.
      const running = await readminCollections.workspace_export.findOne({
        groupId,
        status: { $in: ['pending', 'running'] },
        updated: { $gt: new Date(Date.now() - STALE_JOB_MS) },
      });
      if (running) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'An export is already running for this workspace. Wait for it to finish.',
        );
      }

      const job: MongoTypes.WorkspaceExport = {
        processId: v4(),
        groupId,
        status: 'pending',
        requestedByRobloxId: ctx.user.dbUser.robloxId.toString(),
        requestedByName: ctx.user.dbUser.name,
        stage: 'Queued',
        collectionsDone: 0,
        collectionsTotal: WORKSPACE_COLLECTIONS.length,
        completedCollections: [],
        counts: {},
        totalRecords: 0,
        files: [],
        cdnObjectCount: 0,
        cdnTotalBytes: 0,
        created: new Date(),
        updated: new Date(),
      };

      await readminCollections.workspace_export.insertOne(job);

      // Fire and forget — the UI polls `status`. Mirrors how view exports are
      // kicked off (see workspace/views/index.ts).
      generateWorkspaceExport(job.processId).catch((error) => {
        console.error('Workspace export failed to start:', error);
      });

      return { processId: job.processId };
    }),

  /**
   * Pick a stalled or failed export back up. The worker skips whatever it
   * already finished, so this costs only the collections still outstanding —
   * it does not re-scan the database from the beginning.
   */
  resume: workspaceProcedure
    .input(z.object({ groupId: z.string(), processId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);

      const job = await readminCollections.workspace_export.findOne({
        groupId: input.groupId,
        processId: input.processId,
      });
      if (!job) throw ReturnNormalFailure('NOT_FOUND', 'Export not found');
      if (job.status === 'finished') {
        throw ReturnNormalFailure('BAD_REQUEST', 'That export already finished');
      }
      // A job still being written to is genuinely running — leave it alone
      // rather than starting a second worker over the same files.
      if (job.status === 'running' && job.updated && job.updated > new Date(Date.now() - STALE_JOB_MS)) {
        throw ReturnNormalFailure('BAD_REQUEST', 'That export is still running');
      }

      await readminCollections.workspace_export.updateOne(
        { processId: job.processId },
        { $set: { status: 'running', stage: 'Resuming', error: undefined, updated: new Date() } },
      );

      generateWorkspaceExport(job.processId).catch((error) => {
        console.error('Workspace export failed to resume:', error);
      });

      return { processId: job.processId };
    }),

  /** Poll one job. Finished jobs come back with presigned download URLs. */
  status: workspaceProcedure
    .input(z.object({ groupId: z.string(), processId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);

      const job = await readminCollections.workspace_export.findOne({
        groupId: input.groupId,
        processId: input.processId,
      });
      if (!job) throw ReturnNormalFailure('NOT_FOUND', 'Export not found');

      if (job.status !== 'finished') return { ...job, files: [] as any[] };

      return { ...job, files: await presignExportFiles(job.files) };
    }),

  /** Recent exports for this workspace, newest first. */
  list: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      return readminCollections.workspace_export
        .find(
          { groupId: input.groupId },
          // The file list can be long and is only needed once an export is
          // opened, so it is left out of the listing.
          { projection: { files: 0 }, sort: { created: -1 }, limit: 20 },
        )
        .toArray();
    }),

  // ── Import (self-hosted instances only) ──────────────────────────────────

  /** Check a bundle's manifest before writing anything. */
  validateImport: workspaceProcedure
    .input(z.object({ groupId: z.string(), manifestJson: z.string().min(2) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      requireSelfHosted(ctx);
      try {
        return summariseImportManifest(input.manifestJson, input.groupId);
      } catch (error: any) {
        throw ReturnNormalFailure('BAD_REQUEST', error.message);
      }
    }),

  /** Load one batch of documents. The client walks the bundle and calls this repeatedly. */
  importBatch: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        collectionKey: z.string(),
        lines: z.array(z.string()).max(IMPORT_BATCH_LIMIT),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      requireSelfHosted(ctx);
      try {
        return await importCollectionBatch({
          groupId: input.groupId,
          collectionKey: input.collectionKey,
          lines: input.lines,
        });
      } catch (error: any) {
        throw ReturnNormalFailure('BAD_REQUEST', error.message);
      }
    }),

  /** Re-upload one CDN file to this instance's bucket, under its original key. */
  importFile: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        key: z.string().min(1),
        base64: z.string().min(1),
        contentType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      requireSelfHosted(ctx);
      try {
        return await importCdnFile(input);
      } catch (error: any) {
        throw ReturnNormalFailure('BAD_REQUEST', error.message);
      }
    }),
});
