import { z } from "zod";
import { ObjectId } from "mongodb";
import { TRPCError } from "@trpc/server";
import { router } from "~/server/trpc";
import { readminCollections } from "~/services/mongo.service";
import { DeviceProfile } from "~/services/NewMongoTypes/DeviceProfile.type";
import { bumpCatalogVersion } from "~/services/orders/catalog.service";
import { ordersProcedure, assertOrdersPermission } from "./_helpers";

function toObjectId(id?: string): ObjectId | undefined {
  if (!id) return undefined;
  try {
    return new ObjectId(id);
  } catch {
    return undefined;
  }
}

const deviceProfileInputSchema = z.object({
  name: z.string().min(1).max(80),
  // The slug a device references via its `Profile` Studio attribute. Lowercase,
  // stable, human-typable.
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores only."),
  deviceType: z.enum(["register", "kiosk", "board", "bumpbar", "scanner", "drivethru"]),
  queueId: z.string().max(40).optional(),
  venueMode: z.enum(["restaurant", "retail"]).optional(),
  display: z.enum(["prompt", "surface", "both"]).optional(),
  boardTags: z.array(z.string().max(40)).max(20).optional(),
  idleText: z.string().max(160).optional(),
  activationDistance: z.number().min(1).max(64).optional(),
  promptKey: z.string().max(20).optional(),
  source: z.enum(["register", "kiosk", "drive_thru", "api"]).optional(),
  enabled: z.boolean().optional(),
});

export const workspaceDevicesRouter = router({
  list: ordersProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      return readminCollections.device_profile
        .find({ groupId: input.groupId })
        .sort({ sortOrder: 1 })
        .toArray();
    }),

  create: ordersProcedure
    .input(z.object({ groupId: z.string(), profile: deviceProfileInputSchema }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageSettings");
      const now = new Date();
      const last = await readminCollections.device_profile
        .find({ groupId: input.groupId })
        .sort({ sortOrder: -1 })
        .limit(1)
        .toArray();
      const p = input.profile;
      const doc: DeviceProfile = {
        groupId: input.groupId,
        name: p.name,
        key: p.key,
        deviceType: p.deviceType,
        queueId: p.queueId,
        venueMode: p.venueMode,
        display: p.display,
        boardTags: p.boardTags,
        idleText: p.idleText,
        activationDistance: p.activationDistance,
        promptKey: p.promptKey,
        source: p.source,
        enabled: p.enabled ?? true,
        sortOrder: (last[0]?.sortOrder ?? -1) + 1,
        created: now,
        createdBy: ctx.user.dbUser.robloxId,
      };
      try {
        const res = await readminCollections.device_profile.insertOne(doc);
        const catalogVersion = await bumpCatalogVersion(input.groupId);
        return { profile: { ...doc, _id: res.insertedId }, catalogVersion };
      } catch (e: any) {
        if (e?.code === 11000) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A device profile with key "${p.key}" already exists.`,
          });
        }
        throw e;
      }
    }),

  update: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        profileId: z.string(),
        profile: deviceProfileInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageSettings");
      const _id = toObjectId(input.profileId);
      if (!_id) return { ok: false as const };
      const set: Partial<DeviceProfile> = {
        lastModified: new Date(),
        lastModifiedBy: ctx.user.dbUser.robloxId,
      };
      const p = input.profile;
      // Apply only provided fields so a partial edit doesn't wipe others.
      for (const field of [
        "name",
        "key",
        "deviceType",
        "queueId",
        "venueMode",
        "display",
        "boardTags",
        "idleText",
        "activationDistance",
        "promptKey",
        "source",
        "enabled",
      ] as const) {
        if (p[field] !== undefined) {
          (set as Record<string, unknown>)[field] = p[field];
        }
      }
      try {
        await readminCollections.device_profile.updateOne(
          { _id, groupId: input.groupId },
          { $set: set },
        );
      } catch (e: any) {
        if (e?.code === 11000) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A device profile with key "${p.key}" already exists.`,
          });
        }
        throw e;
      }
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  delete: ordersProcedure
    .input(z.object({ groupId: z.string(), profileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageSettings");
      const _id = toObjectId(input.profileId);
      if (!_id) return { ok: false as const };
      await readminCollections.device_profile.deleteOne({ _id, groupId: input.groupId });
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),

  reorder: ordersProcedure
    .input(z.object({ groupId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manageSettings");
      await Promise.all(
        input.orderedIds.map((id, index) => {
          const _id = toObjectId(id);
          if (!_id) return Promise.resolve();
          return readminCollections.device_profile.updateOne(
            { _id, groupId: input.groupId },
            { $set: { sortOrder: index } },
          );
        }),
      );
      const catalogVersion = await bumpCatalogVersion(input.groupId);
      return { ok: true as const, catalogVersion };
    }),
});
