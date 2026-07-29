import { TRPCError } from '@trpc/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { authenticatedProcedure, workspaceProcedure } from '~/server/procedures';
import { publicProcedure, router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';
import { presignUrl } from '~/services/CDN-service';
import { getGroupInfo, getGroupThumbnail, getUserInfo, getUserThumbnail } from '~/services/roblox.service';
import {
  ApplicationMethod,
  JobPosting,
  JOB_POSTING_TAGS,
  JobPostingStatus,
  JobPostingTag,
  JobPostingVisibility,
} from '~/services/NewMongoTypes/JobPosting.type';
import { JobApplication, JobApplicationStatus } from '~/services/NewMongoTypes/JobApplication.type';

const PAGE_SIZE = 24;

const ApplicationMethodSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('readmin_application'), applyOnlineId: z.string().min(1) }),
  z.object({ type: z.literal('readmin_resume') }),
  z.object({ type: z.literal('contact_info'), prompt: z.string().max(500).optional() }),
  z.object({
    type: z.literal('roblox_game'),
    gameId: z.string().min(1),
    gameUrl: z.string().url(),
    instructions: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('discord_guild'),
    inviteUrl: z.string().url(),
    instructions: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('google_form'),
    url: z
      .string()
      .url()
      .refine(
        (u) =>
          /^https:\/\/(docs\.google\.com\/forms|forms\.gle)\b/i.test(u),
        { message: 'Must be a Google Forms URL (docs.google.com/forms or forms.gle)' },
      ),
    instructions: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal('external_link'), url: z.string().url(), label: z.string().max(80).optional() }),
]);

const CompensationSchema = z
  .object({
    amount: z.string().max(80).optional(),
    type: z.enum(['robux', 'usd', 'unpaid', 'other']),
    period: z.enum(['one-time', 'weekly', 'biweekly', 'monthly']).optional(),
  })
  .optional();

const PostingTagsSchema = z.array(z.enum(JOB_POSTING_TAGS as [JobPostingTag, ...JobPostingTag[]])).max(8);

const PostingBodySchema = z.object({
  title: z.string().min(3).max(120),
  shortSummary: z.string().min(3).max(280),
  description: z.string().min(3).max(20_000),
  requirements: z.array(z.string().min(1).max(280)).max(20),
  tags: PostingTagsSchema,
  applicationMethods: z.array(ApplicationMethodSchema).min(1).max(6),
  compensation: CompensationSchema,
  opensAt: z.date().nullable().optional(),
  closesAt: z.date().nullable().optional(),
  visibility: z.enum(['public', 'unlisted']).default('public'),
});

/**
 * Resolve group display info (name + icon) for a list of unique group IDs.
 * Batched lookup so listing pages do one fetch per group, not one per card.
 */
async function resolveGroupInfoBatch(groupIds: string[]): Promise<Record<string, { name: string; icon: string }>> {
  const unique = Array.from(new Set(groupIds.filter(Boolean)));
  const out: Record<string, { name: string; icon: string }> = {};
  await Promise.all(
    unique.map(async (gid) => {
      try {
        const [info, icon] = await Promise.all([getGroupInfo(gid), getGroupThumbnail(gid)]);
        out[gid] = {
          name: info?.displayName || `Group ${gid}`,
          icon: icon || '',
        };
      } catch {
        out[gid] = { name: `Group ${gid}`, icon: '' };
      }
    }),
  );
  return out;
}

function attachGroupInfo<T extends { groupId: string }>(
  postings: T[],
  groupInfo: Record<string, { name: string; icon: string }>,
): (T & { groupName: string; groupIconUrl: string })[] {
  return postings.map((p) => ({
    ...p,
    groupName: groupInfo[p.groupId]?.name || `Group ${p.groupId}`,
    groupIconUrl: groupInfo[p.groupId]?.icon || '',
  }));
}

/**
 * Resolve workspace branding (custom logo + brand color) for a single groupId.
 * Returns null if no workspace exists. logoUrl is presigned for browser use.
 */
async function resolveWorkspaceBranding(
  groupId: string,
): Promise<{ logoUrl: string | null; brandColor: string | null } | null> {
  const workspace = await readminCollections.workspace.findOne({ groupId });
  if (!workspace) return null;
  let logoUrl: string | null = null;
  if (workspace.logoImage) {
    try {
      const presigned = await presignUrl(workspace.logoImage, 1000);
      if (presigned) logoUrl = presigned;
    } catch {
      /* ignore */
    }
  }
  return {
    logoUrl,
    brandColor: workspace.brandColor || null,
  };
}

const publicPostings = router({
  getAll: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(), // ISO date
        tags: z.array(z.string()).optional(),
        compensationType: z.enum(['robux', 'usd', 'unpaid', 'other']).optional(),
        search: z.string().max(100).optional(),
      }),
    )
    .query(async ({ input }) => {
      const filter: Record<string, unknown> = {
        status: 'active',
        visibility: 'public',
        $and: [
          { $or: [{ opensAt: { $exists: false } }, { opensAt: null }, { opensAt: { $lte: new Date() } }] },
        ],
      };
      if (input.cursor) {
        filter.createdAt = { $lt: new Date(input.cursor) };
      }
      if (input.tags?.length) {
        filter.tags = { $in: input.tags };
      }
      if (input.compensationType) {
        filter['compensation.type'] = input.compensationType;
      }
      if (input.search) {
        const safe = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        (filter.$and as Record<string, unknown>[]).push({
          $or: [
            { title: { $regex: safe, $options: 'i' } },
            { shortSummary: { $regex: safe, $options: 'i' } },
          ],
        });
      }
      const items = await readminCollections.job_posting
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE + 1)
        .toArray();

      const hasMore = items.length > PAGE_SIZE;
      const sliced = hasMore ? items.slice(0, PAGE_SIZE) : items;
      const last = sliced[sliced.length - 1];
      const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
      const groupInfo = await resolveGroupInfoBatch(sliced.map((p) => p.groupId));
      return {
        items: attachGroupInfo(sliced, groupInfo),
        nextCursor,
      };
    }),

  getByGroup: publicProcedure
    .input(
      z.object({
        groupId: z.string().min(1),
        includeClosed: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const filter: Record<string, unknown> = {
        groupId: input.groupId,
        visibility: 'public',
      };
      if (!input.includeClosed) {
        filter.status = 'active';
        filter.$or = [
          { opensAt: { $exists: false } },
          { opensAt: null },
          { opensAt: { $lte: new Date() } },
        ];
      }
      const [items, groupInfo, icon, branding] = await Promise.all([
        readminCollections.job_posting.find(filter).sort({ createdAt: -1 }).limit(100).toArray(),
        getGroupInfo(input.groupId),
        getGroupThumbnail(input.groupId),
        resolveWorkspaceBranding(input.groupId),
      ]);
      return {
        group: {
          groupId: input.groupId,
          name: groupInfo?.displayName || `Group ${input.groupId}`,
          description: groupInfo?.description,
          memberCount: groupInfo?.memberCount,
          icon: icon || '',
        },
        branding,
        items,
      };
    }),

  getById: publicProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(async ({ input }) => {
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid job ID.' });
      }
      const posting = await readminCollections.job_posting.findOne({ _id });
      if (!posting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Posting not found.' });
      // Allow viewing unlisted by direct link; just hide closed except to the owner-side workspace UI.
      const [groupInfo, icon, branding] = await Promise.all([
        getGroupInfo(posting.groupId),
        getGroupThumbnail(posting.groupId),
        resolveWorkspaceBranding(posting.groupId),
      ]);
      return {
        ...posting,
        group: {
          groupId: posting.groupId,
          name: groupInfo?.displayName || `Group ${posting.groupId}`,
          description: groupInfo?.description,
          memberCount: groupInfo?.memberCount,
          icon: icon || '',
        },
        branding,
      };
    }),

  report: authenticatedProcedure
    .input(
      z.object({
        jobId: z.string().min(1),
        reason: z.enum(['spam', 'inappropriate', 'misleading', 'other']),
        details: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reAdminUserId = ctx.user.dbUser._id?.toString();
      if (!reAdminUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        await readminCollections.content_report.insertOne({
          contentType: 'job_posting',
          contentId: input.jobId,
          reportedBy: reAdminUserId,
          reason: input.reason,
          details: input.details,
          status: 'open',
          createdAt: new Date(),
        });
      } catch (e: unknown) {
        const err = e as { code?: number };
        if (err.code === 11000) {
          throw new TRPCError({ code: 'CONFLICT', message: 'You already have an open report for this posting.' });
        }
        throw e;
      }
      return { ok: true };
    }),
});

const applyToPosting = authenticatedProcedure
  .input(
    z.object({
      jobId: z.string().min(1),
      submissionType: z.enum(['readmin_application', 'readmin_resume', 'contact_info']),
      resumeId: z.string().optional(),
      responseId: z.string().optional(),
      contactInfo: z
        .object({
          robloxUsername: z.string().max(100).optional(),
          robloxId: z.string().max(50).optional(),
          discordUsername: z.string().max(100).optional(),
          discordId: z.string().max(50).optional(),
          message: z.string().max(500).optional(),
        })
        .optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const reAdminUserId = ctx.user.dbUser._id?.toString();
    if (!reAdminUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    let _id: ObjectId;
    try {
      _id = new ObjectId(input.jobId);
    } catch {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid job ID.' });
    }
    const posting = await readminCollections.job_posting.findOne({ _id });
    if (!posting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Posting not found.' });
    if (posting.status !== 'active') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'This posting is not currently accepting applications.' });
    }
    if (posting.opensAt && posting.opensAt > new Date()) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'This posting is not open yet.' });
    }
    if (posting.closesAt && posting.closesAt < new Date()) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'This posting has closed.' });
    }

    const supportsType = posting.applicationMethods.some((m) => m.type === input.submissionType);
    if (!supportsType) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This posting does not accept that submission type.',
      });
    }

    // Prevent duplicate active applications from the same user
    const existing = await readminCollections.job_application.findOne({
      jobPostingId: input.jobId,
      reAdminUserId,
      status: { $in: ['pending', 'reviewing', 'accepted'] },
    });
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'You already have an active application for this posting.',
      });
    }

    if (input.submissionType === 'readmin_resume') {
      const resume = await readminCollections.readmin_resume.findOne({ reAdminUserId });
      if (!resume) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must build a ReAdmin Resume before applying with one.',
        });
      }
      input.resumeId = resume._id?.toString();
    }

    if (input.submissionType === 'contact_info' && !input.contactInfo) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Contact info is required.' });
    }

    const now = new Date();
    const doc: JobApplication = {
      jobPostingId: input.jobId,
      groupId: posting.groupId,
      reAdminUserId,
      robloxId: ctx.user.dbUser.robloxId?.toString(),
      discordId: ctx.user.dbUser.discordId?.toString(),
      submissionType: input.submissionType,
      resumeId: input.resumeId,
      responseId: input.responseId,
      contactInfo: input.contactInfo,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const result = await readminCollections.job_application.insertOne(doc);
    await readminCollections.job_posting.updateOne({ _id }, { $inc: { applicantCount: 1 } });
    return { applicationId: result.insertedId.toString() };
  });

const myApplications = authenticatedProcedure.query(async ({ ctx }) => {
  const reAdminUserId = ctx.user.dbUser._id?.toString();
  if (!reAdminUserId) return [];
  const applications = await readminCollections.job_application
    .find({ reAdminUserId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  if (!applications.length) return [];

  // Pull posting titles + group info
  const postingIds = applications.map((a) => {
    try {
      return new ObjectId(a.jobPostingId);
    } catch {
      return null;
    }
  }).filter((x): x is ObjectId => Boolean(x));
  const postings = await readminCollections.job_posting.find({ _id: { $in: postingIds } }).toArray();
  const postingMap = new Map(postings.map((p) => [p._id?.toString() || '', p]));
  const groupInfo = await resolveGroupInfoBatch(postings.map((p) => p.groupId));
  return applications.map((a) => {
    const p = postingMap.get(a.jobPostingId);
    const posting = p
      ? {
          title: p.title,
          groupId: p.groupId,
          groupName: groupInfo[p.groupId]?.name || `Group ${p.groupId}`,
          groupIconUrl: groupInfo[p.groupId]?.icon || '',
        }
      : null;
    return {
      ...a,
      jobId: a.jobPostingId,
      posting,
    };
  });
});

/**
 * Returns the list of jobIds the current user has an active (non-withdrawn) application for.
 * Used by browse pages to mark cards the user has already applied to.
 */
const myActiveAppliedJobIds = authenticatedProcedure.query(async ({ ctx }) => {
  const reAdminUserId = ctx.user.dbUser._id?.toString();
  if (!reAdminUserId) return [] as string[];
  const apps = await readminCollections.job_application
    .find(
      { reAdminUserId, status: { $ne: 'withdrawn' } },
      { projection: { jobPostingId: 1 } },
    )
    .limit(500)
    .toArray();
  return apps.map((a) => a.jobPostingId);
});

const withdrawApplication = authenticatedProcedure
  .input(z.object({ applicationId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const reAdminUserId = ctx.user.dbUser._id?.toString();
    if (!reAdminUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });
    let _id: ObjectId;
    try {
      _id = new ObjectId(input.applicationId);
    } catch {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid application ID.' });
    }
    const app = await readminCollections.job_application.findOne({ _id });
    if (!app) throw new TRPCError({ code: 'NOT_FOUND' });
    if (app.reAdminUserId !== reAdminUserId) throw new TRPCError({ code: 'FORBIDDEN' });
    if (app.status !== 'pending' && app.status !== 'reviewing') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You can only withdraw pending applications.' });
    }
    await readminCollections.job_application.updateOne(
      { _id },
      { $set: { status: 'withdrawn', updatedAt: new Date() } },
    );
    try {
      const postingObjId = new ObjectId(app.jobPostingId);
      await readminCollections.job_posting.updateOne({ _id: postingObjId }, { $inc: { applicantCount: -1 } });
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

// Workspace-side: manage postings + applicants
function assertCanManagePostings(department: { permissions: { admin: boolean; postings?: { canManage: boolean } } }) {
  if (!department.permissions.admin && !department.permissions.postings?.canManage) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to manage job postings.' });
  }
}
function assertCanViewApplicants(department: { permissions: { admin: boolean; postings?: { canViewApplicants: boolean; canManage: boolean } } }) {
  if (
    !department.permissions.admin &&
    !department.permissions.postings?.canViewApplicants &&
    !department.permissions.postings?.canManage
  ) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view applicants.' });
  }
}

const workspacePostings = router({
  list: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      assertCanManagePostings(ctx.department);
      return await readminCollections.job_posting
        .find({ groupId: ctx.workspace.groupId })
        .sort({ createdAt: -1 })
        .toArray();
    }),

  get: workspaceProcedure
    .input(z.object({ groupId: z.string(), jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertCanManagePostings(ctx.department);
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const posting = await readminCollections.job_posting.findOne({
        _id,
        groupId: ctx.workspace.groupId,
      });
      if (!posting) throw new TRPCError({ code: 'NOT_FOUND' });
      return posting;
    }),

  create: workspaceProcedure
    .input(z.object({ groupId: z.string() }).merge(PostingBodySchema))
    .mutation(async ({ ctx, input }) => {
      assertCanManagePostings(ctx.department);
      const reAdminUserId = ctx.user.dbUser._id?.toString();
      const now = new Date();
      const doc: JobPosting = {
        groupId: ctx.workspace.groupId,
        title: input.title,
        shortSummary: input.shortSummary,
        description: input.description,
        requirements: input.requirements,
        tags: input.tags,
        applicationMethods: input.applicationMethods as ApplicationMethod[],
        status: 'active',
        visibility: input.visibility,
        opensAt: input.opensAt || null,
        closesAt: input.closesAt || null,
        compensation: input.compensation,
        applicantCount: 0,
        createdBy: reAdminUserId || '',
        createdAt: now,
        updatedAt: now,
      };
      const r = await readminCollections.job_posting.insertOne(doc);
      return { jobId: r.insertedId.toString() };
    }),

  update: workspaceProcedure
    .input(
      z.object({ groupId: z.string(), jobId: z.string() }).merge(PostingBodySchema.partial()),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanManagePostings(ctx.department);
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const { groupId: _g, jobId: _j, ...rest } = input;
      const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      const r = await readminCollections.job_posting.updateOne(
        { _id, groupId: ctx.workspace.groupId },
        { $set: update },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  updateStatus: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        jobId: z.string(),
        status: z.enum(['active', 'paused', 'closed']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanManagePostings(ctx.department);
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const status: JobPostingStatus = input.status;
      const r = await readminCollections.job_posting.updateOne(
        { _id, groupId: ctx.workspace.groupId },
        { $set: { status, updatedAt: new Date() } },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  updateVisibility: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        jobId: z.string(),
        visibility: z.enum(['public', 'unlisted']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanManagePostings(ctx.department);
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const visibility: JobPostingVisibility = input.visibility;
      const r = await readminCollections.job_posting.updateOne(
        { _id, groupId: ctx.workspace.groupId },
        { $set: { visibility, updatedAt: new Date() } },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  delete: workspaceProcedure
    .input(z.object({ groupId: z.string(), jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanManagePostings(ctx.department);
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.jobId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const r = await readminCollections.job_posting.deleteOne({
        _id,
        groupId: ctx.workspace.groupId,
      });
      if (!r.deletedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      await readminCollections.job_application.deleteMany({ jobPostingId: input.jobId });
      return { ok: true };
    }),

  getApplicants: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        jobId: z.string(),
        status: z
          .enum(['pending', 'reviewing', 'accepted', 'rejected', 'withdrawn'])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertCanViewApplicants(ctx.department);
      const filter: Record<string, unknown> = {
        jobPostingId: input.jobId,
        groupId: ctx.workspace.groupId,
      };
      if (input.status) filter.status = input.status;
      const applicants = await readminCollections.job_application
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();

      // Resolve unique Roblox user info + thumbnails in parallel.
      const uniqueIds = Array.from(
        new Set(applicants.map((a) => a.robloxId).filter((x): x is string => Boolean(x))),
      );
      const userMap: Record<string, { username: string; displayName: string; thumbnailUrl: string }> = {};
      await Promise.all(
        uniqueIds.map(async (rid) => {
          try {
            const [info, thumb] = await Promise.all([
              getUserInfo(rid),
              getUserThumbnail(rid).catch(() => ''),
            ]);
            if (info) {
              userMap[rid] = {
                username: info.name,
                displayName: info.displayName || info.name,
                thumbnailUrl: thumb || '',
              };
            }
          } catch {
            /* ignore */
          }
        }),
      );

      return applicants.map((a) => ({
        ...a,
        user: a.robloxId ? userMap[a.robloxId] || null : null,
      }));
    }),

  updateApplicantStatus: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        status: z.enum(['pending', 'reviewing', 'accepted', 'rejected']),
        internalNote: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanViewApplicants(ctx.department);
      let _id: ObjectId;
      try {
        _id = new ObjectId(input.applicationId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      const status: JobApplicationStatus = input.status;
      const set: Record<string, unknown> = { status, updatedAt: new Date() };
      if (input.internalNote !== undefined) set.internalNote = input.internalNote;
      const r = await readminCollections.job_application.updateOne(
        { _id, groupId: ctx.workspace.groupId },
        { $set: set },
      );
      if (!r.matchedCount) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),
});

export const postingsRouter = router({
  public: publicPostings,
  applyToPosting: applyToPosting,
  withdraw: withdrawApplication,
  getMyApplications: myApplications,
  myActiveAppliedJobIds,
  workspace: workspacePostings,
});
