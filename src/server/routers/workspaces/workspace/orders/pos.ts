import { z } from "zod";
import { router } from "~/server/trpc";
import { readminCollections } from "~/services/mongo.service";
import { PosConfig } from "~/services/NewMongoTypes/PosConfig.type";
import {
  bumpCatalogVersion,
  getWorkspaceDefaultConfig,
  resolvePosConfig,
} from "~/services/orders/catalog.service";
import { ordersProcedure, assertOrdersPermission } from "./_helpers";

const posThemeSchema = z.object({
  accent: z.string().max(9),
  background: z.string().max(9),
  surface: z.string().max(9),
  textPrimary: z.string().max(9),
  textSecondary: z.string().max(9),
  font: z.string().max(40).optional(),
  logoAssetId: z.string().max(50).optional(),
  cornerRadius: z.enum(["sharp", "rounded", "pill"]),
});

const posPricingSchema = z.object({
  mode: z.enum(["cosmetic", "currency_hook", "free"]),
  currencySymbol: z.string().max(5),
  showPrices: z.boolean(),
});

const posQueueSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
});

const posConfigInputSchema = z.object({
  venueMode: z.enum(["restaurant", "retail"]),
  pricing: posPricingSchema,
  theme: posThemeSchema,
  queues: z.array(posQueueSchema).max(20),
  kiosk: z.object({ enabled: z.boolean(), idleText: z.string().max(160).optional() }),
  register: z.object({ enabled: z.boolean() }),
  prepFlow: z.object({ requireClaim: z.boolean(), awaitingPickupStep: z.boolean() }),
});

export const workspacePosRouter = router({
  // The settings page payload: the workspace default (resolved or factory),
  // every per-game override, and the workspace's games for the per-game tab.
  getConfig: ordersProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const [defaultConfig, overrides, games] = await Promise.all([
        getWorkspaceDefaultConfig(input.groupId),
        readminCollections.pos_config
          .find({ groupId: input.groupId, gameId: { $exists: true } })
          .toArray(),
        readminCollections.game.find({ groupId: input.groupId }).toArray(),
      ]);
      return {
        default: defaultConfig,
        overrides,
        games: games.map((g) => ({
          gameId: g.gameId.toString(),
          placeId: g.placeId,
          name: g.name,
          icon: g.images?.icon,
        })),
      };
    }),

  // Resolved (deep-merged) config a station would see for a given game — drives
  // the live in-game mock preview.
  getResolvedConfig: ordersProcedure
    .input(z.object({ groupId: z.string(), gameId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      return resolvePosConfig(input.groupId, input.gameId);
    }),

  updateDefault: ordersProcedure
    .input(z.object({ groupId: z.string(), config: posConfigInputSchema }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageSettings");
      await readminCollections.pos_config.updateOne(
        { groupId: input.groupId, gameId: { $exists: false } },
        {
          $set: { ...input.config, lastModifiedBy: ctx.user.dbUser.robloxId },
          $setOnInsert: { created: new Date(), catalogVersion: 0 },
        },
        { upsert: true },
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  upsertGameOverride: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string().min(1),
        config: posConfigInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageSettings");
      await readminCollections.pos_config.updateOne(
        { groupId: input.groupId, gameId: input.gameId },
        {
          $set: { ...input.config, lastModifiedBy: ctx.user.dbUser.robloxId },
          $setOnInsert: {
            groupId: input.groupId,
            gameId: input.gameId,
            created: new Date(),
            catalogVersion: 0,
          } as Partial<PosConfig>,
        },
        { upsert: true },
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  deleteGameOverride: ordersProcedure
    .input(z.object({ groupId: z.string(), gameId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageSettings");
      await readminCollections.pos_config.deleteOne({
        groupId: input.groupId,
        gameId: input.gameId,
      });
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),
});
