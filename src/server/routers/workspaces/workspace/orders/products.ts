import { z } from "zod";
import { ObjectId } from "mongodb";
import { router } from "~/server/trpc";
import { readminCollections } from "~/services/mongo.service";
import { Product } from "~/services/NewMongoTypes/Product.type";
import { ProductCategory } from "~/services/NewMongoTypes/ProductCategory.type";
import { bumpCatalogVersion } from "~/services/orders/catalog.service";
import { getRobloxAssetThumbnail } from "~/services/roblox.service";
import { ordersProcedure, assertOrdersPermission } from "./_helpers";

function toObjectId(id?: string): ObjectId | undefined {
  if (!id) return undefined;
  try {
    return new ObjectId(id);
  } catch {
    return undefined;
  }
}

const productInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  imageAssetId: z.string().max(50).optional(),
  price: z.number().nonnegative().optional(),
  categoryId: z.string().optional(),
  toolName: z.string().max(100).optional(),
  barcodeId: z.string().max(50).optional(),
  queues: z.array(z.string().max(40)).max(20).optional(),
  enabled: z.boolean().optional(),
});

const categoryInputSchema = z.object({
  name: z.string().min(1).max(80),
  routeToBoardTags: z.array(z.string().max(40)).max(20).optional(),
});

export const workspaceProductsRouter = router({
  // ── products ──────────────────────────────────────────────────────────────
  list: ordersProcedure
    .input(z.object({ groupId: z.string(), includeArchived: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const filter: Record<string, unknown> = { groupId: input.groupId };
      if (!input.includeArchived) filter.archived = false;
      return readminCollections.product
        .find(filter)
        .sort({ sortOrder: 1 })
        .toArray();
    }),

  get: ordersProcedure
    .input(z.object({ groupId: z.string(), productId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const _id = toObjectId(input.productId);
      if (!_id) return null;
      return readminCollections.product.findOne({ _id, groupId: input.groupId });
    }),

  create: ordersProcedure
    .input(z.object({ groupId: z.string(), product: productInputSchema }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      const now = new Date();
      const userId = ctx.user.dbUser.robloxId;
      const last = await readminCollections.product
        .find({ groupId: input.groupId })
        .sort({ sortOrder: -1 })
        .limit(1)
        .toArray();
      const sortOrder = (last[0]?.sortOrder ?? -1) + 1;
      const doc: Product = {
        groupId: input.groupId,
        name: input.product.name,
        description: input.product.description,
        imageAssetId: input.product.imageAssetId,
        price: input.product.price,
        categoryId: toObjectId(input.product.categoryId),
        toolName: input.product.toolName,
        barcodeId: input.product.barcodeId,
        queues: input.product.queues,
        sortOrder,
        enabled: input.product.enabled ?? true,
        archived: false,
        created: now,
        createdBy: userId,
      };
      const res = await readminCollections.product.insertOne(doc);
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { product: { ...doc, _id: res.insertedId }, catalogVersion };
    }),

  update: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        productId: z.string(),
        product: productInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      const _id = toObjectId(input.productId);
      if (!_id) return { ok: false as const };
      const set: Partial<Product> = {
        lastModified: new Date(),
        lastModifiedBy: ctx.user.dbUser.robloxId,
      };
      const p = input.product;
      if (p.name !== undefined) set.name = p.name;
      if (p.description !== undefined) set.description = p.description;
      if (p.imageAssetId !== undefined) set.imageAssetId = p.imageAssetId;
      if (p.price !== undefined) set.price = p.price;
      if (p.categoryId !== undefined) set.categoryId = toObjectId(p.categoryId);
      if (p.toolName !== undefined) set.toolName = p.toolName;
      if (p.barcodeId !== undefined) set.barcodeId = p.barcodeId;
      if (p.queues !== undefined) set.queues = p.queues;
      if (p.enabled !== undefined) set.enabled = p.enabled;
      await readminCollections.product.updateOne(
        { _id, groupId: input.groupId },
        { $set: set },
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  setEnabled: ordersProcedure
    .input(z.object({ groupId: z.string(), productId: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      const _id = toObjectId(input.productId);
      if (!_id) return { ok: false as const };
      await readminCollections.product.updateOne(
        { _id, groupId: input.groupId },
        { $set: { enabled: input.enabled, lastModified: new Date(), lastModifiedBy: ctx.user.dbUser.robloxId } },
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  // Soft delete — products are never hard-removed because orders snapshot them,
  // but historical orders already hold name/price snapshots so this is safe.
  archive: ordersProcedure
    .input(z.object({ groupId: z.string(), productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      const _id = toObjectId(input.productId);
      if (!_id) return { ok: false as const };
      await readminCollections.product.updateOne(
        { _id, groupId: input.groupId },
        { $set: { archived: true, enabled: false, lastModified: new Date(), lastModifiedBy: ctx.user.dbUser.robloxId } },
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  reorder: ordersProcedure
    .input(z.object({ groupId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      await Promise.all(
        input.orderedIds.map((id, index) => {
          const _id = toObjectId(id);
          if (!_id) return Promise.resolve();
          return readminCollections.product.updateOne(
            { _id, groupId: input.groupId },
            { $set: { sortOrder: index } },
          );
        }),
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  // ── categories ──────────────────────────────────────────────────────────────
  listCategories: ordersProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      return readminCollections.product_category
        .find({ groupId: input.groupId })
        .sort({ sortOrder: 1 })
        .toArray();
    }),

  createCategory: ordersProcedure
    .input(z.object({ groupId: z.string(), category: categoryInputSchema }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      const now = new Date();
      const last = await readminCollections.product_category
        .find({ groupId: input.groupId })
        .sort({ sortOrder: -1 })
        .limit(1)
        .toArray();
      const doc: ProductCategory = {
        groupId: input.groupId,
        name: input.category.name,
        routeToBoardTags: input.category.routeToBoardTags,
        sortOrder: (last[0]?.sortOrder ?? -1) + 1,
        created: now,
        createdBy: ctx.user.dbUser.robloxId,
      };
      const res = await readminCollections.product_category.insertOne(doc);
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { category: { ...doc, _id: res.insertedId }, catalogVersion };
    }),

  updateCategory: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        categoryId: z.string(),
        category: categoryInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      const _id = toObjectId(input.categoryId);
      if (!_id) return { ok: false as const };
      const set: Partial<ProductCategory> = {
        lastModified: new Date(),
        lastModifiedBy: ctx.user.dbUser.robloxId,
      };
      if (input.category.name !== undefined) set.name = input.category.name;
      if (input.category.routeToBoardTags !== undefined)
        set.routeToBoardTags = input.category.routeToBoardTags;
      await readminCollections.product_category.updateOne(
        { _id, groupId: input.groupId },
        { $set: set },
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  // Deleting a category orphans its products (their categoryId is cleared) rather
  // than deleting them, so the catalog stays intact.
  deleteCategory: ordersProcedure
    .input(z.object({ groupId: z.string(), categoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      const _id = toObjectId(input.categoryId);
      if (!_id) return { ok: false as const };
      await Promise.all([
        readminCollections.product_category.deleteOne({ _id, groupId: input.groupId }),
        readminCollections.product.updateMany(
          { groupId: input.groupId, categoryId: _id },
          { $unset: { categoryId: "" } },
        ),
      ]);
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  reorderCategories: ordersProcedure
    .input(z.object({ groupId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageProducts");
      await Promise.all(
        input.orderedIds.map((id, index) => {
          const _id = toObjectId(id);
          if (!_id) return Promise.resolve();
          return readminCollections.product_category.updateOne(
            { _id, groupId: input.groupId },
            { $set: { sortOrder: index } },
          );
        }),
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  // ── asset thumbnail proxy (live preview + moderation validation) ────────────
  getAssetThumbnail: ordersProcedure
    .input(z.object({ groupId: z.string(), assetId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const cleaned = input.assetId.replace(/\D/g, "");
      if (!cleaned) return { imageUrl: "", state: "Error" as const };
      return getRobloxAssetThumbnail(cleaned);
    }),
});
