import { TRPCError } from "@trpc/server";
import { DepartmentPermissions } from "~/services/NewMongoTypes/Department.type";
import { moduleEnabledProcedure } from "~/server/middleware/moduleEnabledProcedure";

// The base procedure for every Orders v2 web endpoint: authenticated + premium
// workspace (via workspacePremiumProcedure) + orders module enabled. Individual
// procedures still assert the specific orders.* permission on top.
export const ordersProcedure = moduleEnabledProcedure("orders");

export type OrdersPermission = keyof DepartmentPermissions["orders"];

// Assert the acting department has a given orders permission. `admin` overrides
// everything (matches every other feature). `view` is additionally implied by
// holding ANY orders permission, so a manager who can manage products can also
// read the orders pages.
export function assertOrdersPermission(
  department: { permissions: DepartmentPermissions },
  perm: OrdersPermission,
): void {
  const p = department.permissions;
  if (p.admin) return;
  const orders = p.orders;
  if (perm === "view") {
    if (
      orders?.view ||
      orders?.manage ||
      orders?.manageProducts ||
      orders?.manageSettings
    ) {
      return;
    }
  } else if (orders?.[perm]) {
    return;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `You do not have permission to ${permissionVerb(perm)} for orders.`,
  });
}

function permissionVerb(perm: OrdersPermission): string {
  switch (perm) {
    case "view":
      return "view";
    case "manage":
      return "manage orders";
    case "manageProducts":
      return "manage the product catalog";
    case "manageSettings":
      return "manage POS settings";
  }
}
