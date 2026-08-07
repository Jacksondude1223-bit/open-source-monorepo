/* eslint-disable sort-keys */
// @ts-check

/* eslint-disable @typescript-eslint/no-var-requires */
const { z } = require('zod');

/*eslint sort-keys: "error"*/
const envSchema = z.object({
  MONGODB_URI: z.string().url(),
  MONGODB_DATABASE: z.string(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_PUBLIC_KEY: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_TOKEN: z.string(),
  ROBLOX_SECRET: z.string(),
  STRIPE_PUBLIC: z.string(),
  STRIPE_SECRET: z.string(),
  STRIPE_SIGNING_SECRET: z.string(),
  JSON_WEB_TOKEN_SECRET: z.string(),
  // Where uploaded files live: 's3' (any S3-compatible bucket, the default) or
  // 'local' (this server's own disk, served by the API — see services/storage).
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('s3'),
  // Local driver only: directory holding the objects. Must be writable by the
  // API, panel and sync processes, and is what you back up.
  STORAGE_LOCAL_PATH: z.string().optional(),
  // S3 driver only. Optional in the schema because STORAGE_DRIVER=local needs
  // none of them; the S3 driver checks for them when it first builds a client.
  CDN_URL: z.string().optional(),
  CDN_ACCESS_KEY_ID: z.string().optional(),
  CDN_SECRET_ACCESS_KEY: z.string().optional(),
  CDN_ENDPOINT: z.string().optional(),
  CDN_BUCKET_NAME: z.string().optional(),
  CDN_REIGON: z.string().optional(),
  CRYPTO_KEY: z.string(),
  ROBLOX_COOKIE: z.string(),
  ROBLOX_API_KEY: z.string(),
  VERCEL_URL: z.string().optional(),
  NEXT_PUBLIC_VERCEL_URL: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  NEXT_PUBLIC_VERCEL_ENV: z
    .enum(['production', 'preview', 'development'])
    .optional(),
  ROBLOX_USER_ID: z.string(),
  ROBLOX_CLIENT_ID: z.string(),
  ROBLOX_CLIENT_SECRET: z.string(),
  BLOXLINK_TOKEN: z.string(),
  CONTIGUITY_SECRET: z.string(),
  COMMIT_HASH: z.string().optional(),
  APP_NAME: z.enum(['panel', 'lambda']).default('panel'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_ENV: z.enum(['prod', 'dev']).optional(),
  // Set to 'true' on a self-hosted deployment (anything that is not
  // readmin.app). Enables the workspace data import tooling. Left unset, it is
  // inferred — see utils/deployment.ts.
  SELF_HOSTED: z.string().optional(),
  // Self-hosting: the public URLs of this deployment. When set they replace the
  // readmin.app defaults, so the panel calls your API instead of ours. Both are
  // read at build time — see utils/trpc.ts. install.sh writes them.
  NEXT_PUBLIC_PANEL_URL: z.string().optional(),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  // Self-hosting: your own Roblox OAuth app, used to build the authorize URL in
  // the browser. Must match ROBLOX_CLIENT_ID. Defaults to ReAdmin's own app,
  // which will not accept your redirect URIs — see utils/robloxOAuth.ts.
  NEXT_PUBLIC_ROBLOX_CLIENT_ID: z.string().optional(),
  // Self-hosting: comma-separated origins the API accepts cross-origin requests
  // from. Replaces the built-in per-environment allowlist in fastifyAPI/index.ts.
  CORS_ORIGINS: z.string().optional(),
  // Self-hosting: extra space-separated hosts appended to the panel's
  // Content-Security-Policy — your panel, API and CDN domains. See next.config.js.
  CSP_EXTRA_DOMAINS: z.string().optional(),
  // OpenSearch (optional — when set, powers Roblox user search).
  OPENSEARCH_URL: z.string().optional(),
  OPENSEARCH_USERNAME: z.string().optional(),
  OPENSEARCH_PASSWORD: z.string().optional()
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(env.error.format(), null, 4),
  );
  process.exit(1);
}
module.exports.env = env.data;