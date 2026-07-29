import { env } from '~/services/env';
import { isHostedReAdmin, READMIN_IS_SHUTTING_DOWN } from '~/services/constants/Subscriptions';

/**
 * Whether this deployment is somebody's own instance rather than readmin.app.
 *
 * Matters because ReAdmin is shutting down: the hosted site can only ever
 * export a workspace, while a self-hosted instance also needs to import a
 * bundle back in. The import tooling is gated on this.
 *
 * Answered in order of how much we trust the source:
 *
 *  1. `SELF_HOSTED`, when set — an explicit operator decision wins outright.
 *  2. The request's host, when we have one. "Not readmin.app" is precisely the
 *     question being asked, so a real Host header settles it (see
 *     `isHostedReAdmin`, which handles subdomains and ports).
 *  3. Otherwise infer from the deployment: the hosted site is the one running
 *     on Vercel against the production `readmin` database.
 *
 * The inference is deliberately biased toward "self hosted": a false positive
 * costs an extra import screen, while a false negative would leave a
 * self-hoster with no way to restore their data.
 */
export function isSelfHosted(host?: string | null): boolean {
  const explicit = env.SELF_HOSTED?.trim().toLowerCase();
  if (explicit === 'true' || explicit === '1') return true;
  if (explicit === 'false' || explicit === '0') return false;

  if (host) return !isHostedReAdmin(host);

  return !(env.VERCEL_ENV && env.MONGODB_DATABASE === 'readmin');
}

/**
 * Whether this deployment is the hosted site that is shutting down, and so
 * should turn away new signups and subscriptions. Server side only — pass the
 * request's `Host` header wherever one is available, since that answers it far
 * more precisely than the fallback inference does.
 */
export function isShutdownDeployment(host?: string | null): boolean {
  return READMIN_IS_SHUTTING_DOWN && !isSelfHosted(host);
}
