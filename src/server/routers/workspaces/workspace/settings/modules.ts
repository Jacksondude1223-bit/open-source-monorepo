import { router } from "~/server/trpc";
import { workspaceProcedure } from "~/server/procedures";
import { z } from "zod";
import { ReturnNormalFailure } from "~/utils/NormalResponseTypes";
import { readminCollections } from "~/services/mongo.service";

// Toggleable workspace modules. This router is intentionally NOT module-gated
// (you must be able to reach it to turn a module on in the first place) — it is
// admin-gated instead. The first module is `orders`; future modules slot in here.
const moduleKeySchema = z.enum(["orders"]);

export const workspaceSettingsModulesRouter = router({
  get: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.workspace.enabledModules ?? {};
    }),

  setModule: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        module: moduleKeySchema,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.department.permissions.admin) {
        throw ReturnNormalFailure(
          "UNAUTHORIZED",
          "You must be a workspace admin to manage modules.",
        );
      }
      await readminCollections.workspace.updateOne(
        { _id: ctx.workspace._id },
        { $set: { [`enabledModules.${input.module}`]: input.enabled } },
      );
      return { ok: true, module: input.module, enabled: input.enabled };
    }),
});
