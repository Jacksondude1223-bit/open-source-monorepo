import { RouterOutput } from '~/utils/trpc';

type Workspace = RouterOutput['workspaces']['workspace']['getWorkspace'];

export type OrdersAccess = {
  /** The orders module is enabled for this workspace. */
  moduleEnabled: boolean;
  /** Can see orders pages + stats. Implied by any orders permission. */
  view: boolean;
  /** Can cancel/correct orders from the web. */
  manage: boolean;
  /** Can manage the product/category catalog. */
  manageProducts: boolean;
  /** Can manage POS config, queues, theming, per-game overrides. */
  manageSettings: boolean;
};

/**
 * Resolve the current user's Orders-module access from the workspace payload.
 * All page/action gating funnels through here so the rules stay in one place
 * and match the backend's permission checks exactly.
 */
export function ordersAccess(workspace: Workspace | null | undefined): OrdersAccess {
  const moduleEnabled = false; //workspace?.enabledModules?.orders === true;
  const p = workspace?.department?.permissions;
  const admin = !!p?.admin;

  const manage = admin || !!p?.orders?.manage;
  const manageProducts = admin || !!p?.orders?.manageProducts;
  const manageSettings = admin || !!p?.orders?.manageSettings;
  const view = admin || !!p?.orders?.view || manage || manageProducts || manageSettings;

  return { moduleEnabled, view, manage, manageProducts, manageSettings };
}
