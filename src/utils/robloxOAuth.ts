/**
 * The Roblox OAuth client ID the browser uses to build `authorize.roblox.com`
 * URLs (login, workspace creation, bot authorisation).
 *
 * A self-hosted deployment must register its own Roblox OAuth app — ReAdmin's
 * will not accept your redirect URIs — and set `NEXT_PUBLIC_ROBLOX_CLIENT_ID`
 * to it, matching the server-side `ROBLOX_CLIENT_ID`. `install.sh` prompts for
 * it once and writes both.
 *
 * Read through `process.env` so Next inlines it at build time; the fallback is
 * ReAdmin's own app, which keeps the hosted site working unchanged.
 */
export const ROBLOX_OAUTH_CLIENT_ID =
  process.env.NEXT_PUBLIC_ROBLOX_CLIENT_ID || '8369795969584799403';
