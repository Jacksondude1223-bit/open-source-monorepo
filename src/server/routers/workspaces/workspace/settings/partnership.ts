import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';

function assertAdmin(department: { permissions: { admin: boolean } }) {
  if (!department.permissions.admin) {
    throw ReturnNormalFailure(
      'UNAUTHORIZED',
      'You must be a workspace admin to do this operation',
    );
  }
}

export const workspaceSettingsPartnershipRouter = router({
  // Returns the latest partnership application for the workspace (if any) so the
  // UI can show submitted state instead of re-presenting the form.
  getStatus: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      assertAdmin(ctx.department);

      const request = await readminCollections.partnership_request
        .find({ groupId: ctx.workspace.groupId })
        .sort({ created: -1 })
        .limit(1)
        .next();

      if (!request) return { submitted: false as const };

      return {
        submitted: true as const,
        status: request.status,
        created: request.created,
      };
    }),

  submit: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        contact: z.string().min(1).max(500),
        communityType: z.string().min(1).max(1000),
        currentStaffManagement: z.string().min(1).max(2000),
        featuresUsed: z.string().min(1).max(2000),
        reason: z.string().min(1).max(2000),
        willingToProvideFeedback: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, user, workspace } = ctx;
      assertAdmin(department);

      const contact = input.contact.trim();
      const communityType = input.communityType.trim();
      const currentStaffManagement = input.currentStaffManagement.trim();
      const featuresUsed = input.featuresUsed.trim();
      const reason = input.reason.trim();

      // Avoid duplicate spam: block a new submission while one is still pending.
      const pending = await readminCollections.partnership_request.findOne({
        groupId: workspace.groupId,
        status: { $in: ['pending', 'reviewing'] },
      });
      if (pending) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'You already have a partnership application under review.',
        );
      }

      await readminCollections.partnership_request.insertOne({
        groupId: workspace.groupId,
        groupName: workspace.groupName,
        robloxId: user.dbUser.robloxId as string,
        contact,
        communityType,
        currentStaffManagement,
        featuresUsed,
        reason,
        willingToProvideFeedback: input.willingToProvideFeedback,
        status: 'pending',
        created: new Date(),
      });

      try {
        const description = [
          `**Workspace:** ${workspace.groupName || 'Unknown'} (\`${workspace.groupId}\`)`,
          `**Submitted by (Roblox ID):** ${user.dbUser.robloxId}`,
          `**Discord/Website:** ${contact}`,
          `**Community type:** ${communityType}`,
          `**Current staff management:** ${currentStaffManagement}`,
          `**Features used/wanted:** ${featuresUsed}`,
          `**Why partner:** ${reason}`,
          `**Willing to provide feedback/testimonial:** ${input.willingToProvideFeedback ? 'Yes' : 'No'}`,
        ].join('\n');
        await sendReAdminInternalWebhookMessage(
          'partnerRequest',
          'blue',
          'New partnership application',
          description,
        );
      } catch (e) {
        console.error('Failed to send partnership request Discord notification', e);
      }

      return { ok: true };
    }),
});
