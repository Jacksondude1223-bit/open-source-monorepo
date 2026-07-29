import { TRPCError } from '@trpc/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { authenticatedProcedure } from '~/server/procedures';
import { publicProcedure, router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';
import { getUserInfo, getUserThumbnail } from '~/services/roblox.service';
import { ReAdminResume, ResumeWorkEntry } from '~/services/NewMongoTypes/ReAdminResume.type';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

const WorkEntrySchema = z.object({
  _id: z.string().min(1).max(64),
  groupId: z.string().max(50).optional(),
  groupName: z.string().min(1).max(120),
  groupIconUrl: z.string().url().max(500).optional().nullable(),
  position: z.string().min(1).max(120),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

const UpsertSchema = z.object({
  headline: z.string().max(160).optional(),
  bio: z.string().max(300).optional(),
  skills: z.array(z.string().min(1).max(40)).max(20),
  slug: z
    .string()
    .min(3)
    .max(32)
    .regex(SLUG_RE, 'Slug must be lowercase alphanumeric with hyphens.')
    .optional()
    .nullable(),
  workHistory: z.array(WorkEntrySchema).max(30),
  contactPreferences: z.object({
    showRoblox: z.boolean(),
    showDiscord: z.boolean(),
    allowDirectMessages: z.boolean(),
  }),
  isPublic: z.boolean(),
});

async function computeWorkVerification(
  reAdminUserId: string,
  workHistory: z.infer<typeof WorkEntrySchema>[],
): Promise<ResumeWorkEntry[]> {
  const out: ResumeWorkEntry[] = [];
  const user = await readminCollections.user.findOne({ _id: new ObjectId(reAdminUserId) });
  const robloxId = user?.robloxId;
  for (const entry of workHistory) {
    let isVerified = false;
    if (entry.groupId && robloxId) {
      // Verified if the user is currently a department user OR has a group membership in that workspace
      const [deptUser, groupMember] = await Promise.all([
        readminCollections.department_users.findOne({
          groupId: entry.groupId,
          userId: robloxId,
        }),
        readminCollections.group_member.findOne({
          groupId: entry.groupId,
          userId: parseInt(robloxId, 10),
        }),
      ]);
      isVerified = Boolean(deptUser || groupMember);
    }
    out.push({
      _id: entry._id,
      groupId: entry.groupId,
      groupName: entry?.groupName,
      groupIconUrl: entry.groupIconUrl ?? undefined,
      position: entry.position,
      startDate: entry.startDate || null,
      endDate: entry.endDate || null,
      description: entry.description ?? undefined,
      isVerified,
    });
  }
  return out;
}

async function computeVerifiedBadges(reAdminUserId: string, robloxId: string) {
  const badges: ReAdminResume['verifiedBadges'] = [];
  if (robloxId) {
    const deptUsers = await readminCollections.department_users
      .find({ userId: robloxId })
      .limit(20)
      .toArray();
    for (const du of deptUsers) {
      const ws = await readminCollections.workspace.findOne({ groupId: du.groupId });
      if (ws) {
        badges.push({ type: 'staff_verified', groupId: du.groupId, groupName: `Group ${du.groupId}` });
      }
    }
  }
  const passedCount = await readminCollections.response.countDocuments({
    userId: robloxId,
    status: 'passed',
  });
  if (passedCount > 0) {
    badges.push({ type: 'applications_passed', count: passedCount });
  }
  return badges;
}

export const resumeRouter = router({
  getMine: authenticatedProcedure.query(async ({ ctx }) => {
    const reAdminUserId = ctx.user.dbUser._id?.toString();
    if (!reAdminUserId) return null;
    const resume = await readminCollections.readmin_resume.findOne({ reAdminUserId });
    return resume;
  }),

  upsert: authenticatedProcedure
    .input(UpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const reAdminUserId = ctx.user.dbUser._id?.toString();
      const robloxId = ctx.user.dbUser.robloxId?.toString();
      if (!reAdminUserId || !robloxId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Slug uniqueness
      if (input.slug) {
        const existing = await readminCollections.readmin_resume.findOne({ slug: input.slug });
        if (existing && existing.reAdminUserId !== reAdminUserId) {
          throw new TRPCError({ code: 'CONFLICT', message: 'That URL is taken.' });
        }
      }

      const workHistory = await computeWorkVerification(reAdminUserId, input.workHistory);
      const verifiedBadges = await computeVerifiedBadges(reAdminUserId, robloxId);

      const now = new Date();
      const set: Record<string, unknown> = {
        reAdminUserId,
        robloxId,
        discordId: ctx.user.dbUser.discordId?.toString(),
        headline: input.headline,
        bio: input.bio,
        skills: input.skills,
        workHistory,
        contactPreferences: input.contactPreferences,
        verifiedBadges,
        isPublic: input.isPublic,
        updatedAt: now,
      };
      const updateOp: Record<string, unknown> = {
        $set: set,
        $setOnInsert: { createdAt: now },
      };
      if (input.slug) {
        set.slug = input.slug;
      } else {
        updateOp.$unset = { slug: '' };
      }
      const r = await readminCollections.readmin_resume.findOneAndUpdate(
        { reAdminUserId },
        updateOp,
        { upsert: true, returnDocument: 'after' },
      );
      return r;
    }),

  delete: authenticatedProcedure.mutation(async ({ ctx }) => {
    const reAdminUserId = ctx.user.dbUser._id?.toString();
    if (!reAdminUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });
    await readminCollections.readmin_resume.deleteOne({ reAdminUserId });
    return { ok: true };
  }),

  getPublic: publicProcedure
    .input(
      z.union([
        z.object({ slug: z.string().min(1) }),
        z.object({ robloxId: z.string().min(1) }),
        z.object({ resumeId: z.string().min(1) }),
      ]),
    )
    .query(async ({ input }) => {
      let filter: Record<string, unknown> = {};
      if ('slug' in input) filter = { slug: input.slug };
      else if ('robloxId' in input) filter = { robloxId: input.robloxId };
      else {
        try {
          filter = { _id: new ObjectId(input.resumeId) };
        } catch {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
      }
      const resume = await readminCollections.readmin_resume.findOne(filter);
      if (!resume) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!resume.isPublic) throw new TRPCError({ code: 'NOT_FOUND' });
      // Strip current-group memberships (staff_verified badges leak which groups
      // the user is currently in). Keep other verified signals.
      const filteredBadges = (resume.verifiedBadges || []).filter(
        (b) => b.type !== 'staff_verified',
      );
      // Resolve Roblox username + thumbnail for the resume header.
      let robloxUser: { username: string; displayName: string; thumbnailUrl: string } | null = null;
      if (resume.robloxId) {
        try {
          const [info, thumb] = await Promise.all([
            getUserInfo(resume.robloxId),
            getUserThumbnail(resume.robloxId).catch(() => ''),
          ]);
          if (info) {
            robloxUser = {
              username: info.name,
              displayName: info.displayName || info.name,
              thumbnailUrl: thumb || '',
            };
          }
        } catch {
          /* ignore */
        }
      }
      return { ...resume, verifiedBadges: filteredBadges, robloxUser };
    }),

  report: authenticatedProcedure
    .input(
      z.object({
        resumeId: z.string().min(1),
        reason: z.enum(['spam', 'inappropriate', 'misleading', 'other']),
        details: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reAdminUserId = ctx.user.dbUser._id?.toString();
      if (!reAdminUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        await readminCollections.content_report.insertOne({
          contentType: 'resume',
          contentId: input.resumeId,
          reportedBy: reAdminUserId,
          reason: input.reason,
          details: input.details,
          status: 'open',
          createdAt: new Date(),
        });
      } catch (e: unknown) {
        const err = e as { code?: number };
        if (err.code === 11000) {
          throw new TRPCError({ code: 'CONFLICT', message: 'You already have an open report for this resume.' });
        }
        throw e;
      }
      return { ok: true };
    }),
});
