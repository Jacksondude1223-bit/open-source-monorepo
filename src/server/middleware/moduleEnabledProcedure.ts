import { TRPCError } from "@trpc/server";
import { workspacePremiumProcedure } from "~/server/procedures";
import { EnabledModules } from "~/services/NewMongoTypes/Workspace.type";

// Builds a procedure that is gated on BOTH workspace premium (inherited from
// `workspacePremiumProcedure`) AND the given module being enabled for the
// workspace. This is the tRPC half of the module mechanism — the Fastify v2
// routes do the equivalent check via `ensureOrdersModule`. Generic over the
// module key so future modules (applications, sessions, …) reuse it verbatim.
export function moduleEnabledProcedure(moduleKey: keyof EnabledModules) {
  return workspacePremiumProcedure.use(async ({ ctx, next }) => {
    if (!ctx.workspace?.enabledModules?.[moduleKey]) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `The ${String(moduleKey)} module is not enabled for this workspace.`,
      });
    }
    return next();
  });
}
