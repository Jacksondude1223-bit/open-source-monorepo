import { TRPCError } from '@trpc/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { trustAndSafteyProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';

const PAGE_SIZE = 50;

async function attachReportCounts<T extends { _id?: ObjectId }>(
  contentType: 'job_posting' | 'resume',
  rows: T[],
): Promise<(T & { reportCount: number; openReportCount: number })[]> {
  const ids = rows.map((r) => r._id?.toString()).filter((x): x is string => Boolean(x));
  if (!ids.length) return rows.map((r) => ({ ...r, reportCount: 0, openReportCount: 0 }));
  const counts = await readminCollections.content_report
    .aggregate<{ _id: { contentId: string; status: string }; count: number }>([
      { $match: { contentType, contentId: { $in: ids } } },
      { $group: { _id: { contentId: '$contentId', status: '$status' }, count: { $sum: 1 } } },
    ])
    .toArray();
  const map = new Map<string, { total: number; open: number }>();
  for (const c of counts) {
    const key = c._id.contentId;
    const prev = map.get(key) || { total: 0, open: 0 };
    prev.total += c.count;
    if (c._id.status === 'open') prev.open += c.count;
    map.set(key, prev);
  }
  return rows.map((r) => {
    const id = r._id?.toString() || '';
    const m = map.get(id) || { total: 0, open: 0 };
    return { ...r, reportCount: m.total, openReportCount: m.open };
  });
}

const postings = router({
  getAll: trustAndSafteyProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        status: z.enum(['active', 'paused', 'closed']).optional(),
        visibility: z.enum(['public', 'unlisted']).optional(),
        groupId: z.string().optional(),
        flaggedOnly: z.boolean().optional(),
        search: z.string().max(120).optional(),
      }),
    )
    .query(async ({ input }) => {
      const filter: Record<string, unknown> = {};
      if (input.cursor) filter.createdAt = { $lt: new Date(input.cursor) };
      if (input.status) filter.status = input.status;
      if (input.visibility) filter.visibility = input.visibility;
      if (input.groupId) filter.groupId = input.groupId;
      if (input.flaggedOnly) filter.adminFlagged = true;
      if (input.search) {
        const safe = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { title: { $regex: safe, $options: 'i' } },
          { shortSummary: { $regex: safe, $options: 'i' } },
        ];
      }
      const items = await readminCollections.job_posting
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE + 1)
        .toArray();
      const hasMore = items.length > PAGE_SIZE;
      const sliced = hasMore ? items.slice(0, PAGE_SIZE) : items;
      const withCounts = await attachReportCounts('job_posting', sliced);
      return {
        items: withCounts,
        //@ts-expect-error
        nextCursor: hasMore ? sliced[sliced.length - 1].createdAt.toISOString() : null,
      };
    }),

  forceStatus: trustAndSafteyProcedure
    .input(
      z.object({
        jobId: z.string(),
        status: z.enum(['active', 'paused', 'closed']),
      }),
    )
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.job_posting.updateOne(
        { _id },
        {
          $set: {
            status: input.status,
            forcedClosedByAdmin: input.status === 'closed',
            updatedAt: new Date(),
          },
        },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  forceVisibility: trustAndSafteyProcedure
    .input(
      z.object({
        jobId: z.string(),
        visibility: z.enum(['public', 'unlisted']),
      }),
    )
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.job_posting.updateOne(
        { _id },
        {
          $set: {
            visibility: input.visibility,
            forcedUnpublishedByAdmin: input.visibility === 'unlisted',
            updatedAt: new Date(),
          },
        },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  setFlagged: trustAndSafteyProcedure
    .input(z.object({ jobId: z.string(), flagged: z.boolean() }))
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      await readminCollections.job_posting.updateOne(
        { _id },
        { $set: { adminFlagged: input.flagged, updatedAt: new Date() } },
      );
      return { ok: true };
    }),

  delete: trustAndSafteyProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.job_posting.deleteOne({ _id });
      if (!r.deletedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      await readminCollections.job_application.deleteMany({ jobPostingId: input.jobId });
      return { ok: true };
    }),
});

const resumes = router({
  getAll: trustAndSafteyProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        publicOnly: z.boolean().optional(),
        hasSlug: z.boolean().optional(),
        flaggedOnly: z.boolean().optional(),
        robloxId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const filter: Record<string, unknown> = {};
      if (input.cursor) filter.createdAt = { $lt: new Date(input.cursor) };
      if (input.publicOnly) filter.isPublic = true;
      if (input.hasSlug) filter.slug = { $exists: true, $ne: null };
      if (input.flaggedOnly) filter.adminFlagged = true;
      if (input.robloxId) filter.robloxId = input.robloxId;
      const items = await readminCollections.readmin_resume
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE + 1)
        .toArray();
      const hasMore = items.length > PAGE_SIZE;
      const sliced = hasMore ? items.slice(0, PAGE_SIZE) : items;
      const withCounts = await attachReportCounts('resume', sliced);
      return {
        items: withCounts,
        //@ts-expect-error
        nextCursor: hasMore ? sliced[sliced.length - 1].createdAt.toISOString() : null,
      };
    }),

  forcePrivate: trustAndSafteyProcedure
    .input(z.object({ resumeId: z.string() }))
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.resumeId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.readmin_resume.updateOne(
        { _id },
        { $set: { isPublic: false, forcedPrivateByAdmin: true, updatedAt: new Date() } },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  revokeSlug: trustAndSafteyProcedure
    .input(z.object({ resumeId: z.string() }))
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.resumeId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.readmin_resume.updateOne(
        { _id },
        { $unset: { slug: '' }, $set: { updatedAt: new Date() } },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  setFlagged: trustAndSafteyProcedure
    .input(z.object({ resumeId: z.string(), flagged: z.boolean() }))
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.resumeId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      await readminCollections.readmin_resume.updateOne(
        { _id },
        { $set: { adminFlagged: input.flagged, updatedAt: new Date() } },
      );
      return { ok: true };
    }),

  delete: trustAndSafteyProcedure
    .input(z.object({ resumeId: z.string() }))
    .mutation(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.resumeId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.readmin_resume.deleteOne({ _id });
      if (!r.deletedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),
});

const reports = router({
  getAll: trustAndSafteyProcedure
    .input(
      z.object({
        contentType: z.enum(['job_posting', 'resume']).optional(),
        status: z.enum(['open', 'reviewed', 'dismissed']).optional(),
      }),
    )
    .query(async ({ input }) => {
      const filter: Record<string, unknown> = {};
      if (input.contentType) filter.contentType = input.contentType;
      filter.status = input.status || 'open';
      return await readminCollections.content_report
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
    }),

  updateStatus: trustAndSafteyProcedure
    .input(
      z.object({
        reportId: z.string(),
        status: z.enum(['open', 'reviewed', 'dismissed']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.reportId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.content_report.updateOne(
        { _id },
        {
          $set: {
            status: input.status,
            reviewedBy: ctx.user.dbUser._id?.toString(),
            reviewedAt: new Date(),
          },
        },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),
});

export const adminPostingsModerationRouter = router({
  postings,
  resumes,
  reports,
});
