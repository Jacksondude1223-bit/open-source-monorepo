import { z } from 'zod';
import { v4 } from 'uuid';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { uploadImage, presignUrl } from '~/services/CDN-service';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import type { WorkspaceBanner } from '~/services/NewMongoTypes';
import { departmentScopeIds } from '~/services/departmentPermissions.service';

const bannerTypeSchema = z.union([
  z.literal('primary'),
  z.literal('warning'),
  z.literal('danger'),
]);

// Shared input shape for create/update. Kept permissive at the boundary and
// trimmed/normalised in the resolvers.
const bannerInputSchema = z.object({
  type: bannerTypeSchema,
  title: z.string().max(120).optional(),
  message: z.string().min(1).max(1000),
  link: z.string().url().max(2000).optional().or(z.literal('')),
  linkMessage: z.string().max(120).optional(),
  closable: z.boolean().optional(),
  enabled: z.boolean(),
  departmentIds: z.array(z.string()).optional(),
  imageUrl: z.string().optional(), // CDN object key returned by uploadImage
});

function assertAdmin(department: { permissions: { admin: boolean } }) {
  if (!department.permissions.admin) {
    throw ReturnNormalFailure(
      'UNAUTHORIZED',
      'You must be a workspace admin to do this operation',
    );
  }
}

export const workspaceSettingsBannersRouter = router({
  // Admin-only management list: every banner for the workspace plus the
  // department list used to build the restriction picker.
  list: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      assertAdmin(ctx.department);

      const [banners, departments] = await Promise.all([
        readminCollections.workspace_banner
          .find({ groupId: ctx.workspace.groupId })
          .sort({ created: -1 })
          .toArray(),
        readminCollections.department
          .find({ groupId: ctx.workspace.groupId })
          .toArray(),
      ]);

      const withImages = await Promise.all(
        banners.map(async (banner) => ({
          ...banner,
          _id: banner._id?.toString(),
          // Raw private CDN object key, preserved so the editor can keep the
          // existing attachment when saving without re-uploading.
          imageObjectKey: banner.imageUrl,
          // Presigned URL for rendering the preview/thumbnail.
          imageUrl: banner.imageUrl
            ? await presignUrl(banner.imageUrl, 604800)
            : undefined,
        })),
      );

      return {
        banners: withImages,
        departments: departments.map((d) => ({
          _id: d._id!.toString(),
          name: d.name,
          isOwner: d.isOwner === true,
        })),
      };
    }),

  // Banners the current member should actually see, filtered by their
  // department. Available to any workspace member (not just admins).
  getActiveBanners: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      // Every department the member's roles map into, not just the primary one.
      const scopeIds = departmentScopeIds(ctx.department).map((id) => id.toString());
      const isAdmin = ctx.department?.permissions?.admin === true;

      const banners = await readminCollections.workspace_banner
        .find({ groupId: ctx.workspace.groupId, enabled: true })
        .sort({ created: -1 })
        .toArray();

      const visible = banners.filter((banner) => {
        const restricted = (banner.departmentIds ?? []).length > 0;
        if (!restricted) return true;
        // Admins always see every banner; otherwise the member's department
        // must be in the allow-list.
        if (isAdmin) return true;
        return scopeIds.some((id) => banner.departmentIds!.includes(id));
      });

      return Promise.all(
        visible.map(async (banner) => ({
          id: banner.id,
          type: banner.type,
          title: banner.title,
          message: banner.message,
          link: banner.link || undefined,
          linkMessage: banner.linkMessage,
          closable: banner.closable === true,
          imageUrl: banner.imageUrl
            ? await presignUrl(banner.imageUrl, 604800)
            : undefined,
        })),
      );
    }),

  // Upload an image attachment and get back the private CDN object key. The key
  // is then passed into create/update as `imageUrl`.
  uploadImage: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        data: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.department);
      const { workspace, user } = ctx;
      const { name, data } = input;

      const id = v4();
      const filePath = `workspaces/${workspace.groupId}/imgs/banners/${user.dbUser.robloxId}/${id}-${name}`;
      await uploadImage(filePath, 'image.png', data);
      const presignedUrl = await presignUrl(filePath, 604800);
      await sendReAdminInternalWebhookMessage(
        'imageUploads',
        'blue',
        'Image upload - Workspace Banner',
        `https://cdn.readmin.app/${filePath}`,
        presignedUrl,
        undefined,
        presignedUrl,
      );

      return { filePath, url: presignedUrl };
    }),

  create: workspaceProcedure
    .input(z.object({ groupId: z.string(), banner: bannerInputSchema }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.department);
      const { workspace, user } = ctx;
      const { banner } = input;

      const doc: WorkspaceBanner = {
        id: v4(),
        groupId: workspace.groupId,
        type: banner.type,
        title: banner.title?.trim() || undefined,
        message: banner.message.trim(),
        link: banner.link?.trim() || undefined,
        linkMessage: banner.linkMessage?.trim() || undefined,
        imageUrl: banner.imageUrl || undefined,
        closable: banner.closable === true,
        enabled: banner.enabled,
        departmentIds: banner.departmentIds ?? [],
        createdBy: user.dbUser.robloxId,
        created: new Date(),
      };

      await readminCollections.workspace_banner.insertOne(doc);

      return { ok: true, id: doc.id };
    }),

  update: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        id: z.string(),
        banner: bannerInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.department);
      const { workspace } = ctx;
      const { id, banner } = input;

      const existing = await readminCollections.workspace_banner.findOne({
        id,
        groupId: workspace.groupId,
      });
      if (!existing) {
        throw ReturnNormalFailure('NOT_FOUND', 'Banner not found');
      }

      await readminCollections.workspace_banner.updateOne(
        { _id: existing._id },
        {
          $set: {
            type: banner.type,
            title: banner.title?.trim() || undefined,
            message: banner.message.trim(),
            link: banner.link?.trim() || undefined,
            linkMessage: banner.linkMessage?.trim() || undefined,
            imageUrl: banner.imageUrl || undefined,
            closable: banner.closable === true,
            enabled: banner.enabled,
            departmentIds: banner.departmentIds ?? [],
            updated: new Date(),
          },
        },
      );

      return { ok: true };
    }),

  delete: workspaceProcedure
    .input(z.object({ groupId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.department);
      const { workspace } = ctx;

      await readminCollections.workspace_banner.deleteOne({
        id: input.id,
        groupId: workspace.groupId,
      });

      return { ok: true };
    }),
});
