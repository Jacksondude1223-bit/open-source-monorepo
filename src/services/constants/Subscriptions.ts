/**
 * ReAdmin's hosted service (readmin.app) is shutting down, so it takes no new
 * signups and no new Premium subscriptions or free trials:
 *
 *  - `workspaces.createWorkspace` refuses, and the create flow shows a shutdown
 *    notice instead of the signup form
 *  - `workspaces.workspace.settings.billing.subscribeToWorkspacePlan` refuses,
 *    and the upsale / billing UI stops offering Premium
 *
 * Self-hosted deployments run this exact same code and are *not* shutting down,
 * so signup is gated on which deployment is serving the request rather than on
 * a build flag — see `isShutdownDeployment()` in `~/utils/deployment`, which
 * server code calls with the request's host. Premium is closed everywhere
 * (`SUBSCRIPTIONS_CLOSED`): it bills through our Stripe account either way.
 *
 * Existing subscriptions are untouched: they keep billing, can still be managed
 * through the Stripe billing portal, and can still be cancelled.
 */
export const READMIN_IS_SHUTTING_DOWN: boolean = true;

/** The domain the hosted service runs on — the apex plus `panel.`, `api.`, etc. */
const HOSTED_DOMAIN = 'readmin.app';

/**
 * Whether `host` belongs to ReAdmin's own hosted service. Takes anything host
 * shaped: a `Host` header (which may carry a port) or a `location.hostname`.
 */
export function isHostedReAdmin(host?: string | null): boolean {
  if (!host) {
    return false;
  }
  const hostname = host.trim().toLowerCase().split(':')[0] || '';
  return hostname === HOSTED_DOMAIN || hostname.endsWith(`.${HOSTED_DOMAIN}`);
}

/**
 * Whether Premium is closed. Deliberately not host aware: subscriptions bill
 * through ReAdmin's own Stripe account wherever the code runs, so they close
 * everywhere. This module stays free of `~/services/env` (which parses the
 * server environment and `process.exit`s) because client components import it.
 */
export const SUBSCRIPTIONS_CLOSED = true;

/** Shown to users (and returned from the API) wherever Premium used to be sold. */
export const SUBSCRIPTIONS_CLOSED_MESSAGE =
  'ReAdmin is shutting down. New Premium subscriptions and free trials are no longer available.';

/** Shown to users (and returned from the API) wherever signup used to happen. */
export const SIGNUPS_CLOSED_MESSAGE =
  'ReAdmin is shutting down, so new workspaces can no longer be created on readmin.app.';

/** Public shutdown notice - linked from every place we explain the shutdown. */
export const SHUTDOWN_INFO_URL =
  'https://cdn.readmin.app/readmin-public/ReAdmin%20-%20Shutdown.pdf';
