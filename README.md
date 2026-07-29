# ReAdmin

Staff management, activity tracking, ranking, sessions, and applications for Roblox groups.

This document covers everything needed to stand up a ReAdmin instance from scratch: the external
services you must provision, the credentials each one needs, and the deployment steps for
DigitalOcean App Platform (the setup the hosted service runs on).

> **Self-hosting note:** the hosted service at `readmin.app` is shutting down
> (`READMIN_IS_SHUTTING_DOWN` in [Subscriptions.ts](src/services/constants/Subscriptions.ts#L19)).
> A self-hosted instance is detected via the `SELF_HOSTED` flag or the request host — see
> [deployment.ts](src/utils/deployment.ts) — and unlocks the workspace **import** tooling so you can
> restore a bundle exported from the hosted site.

## What standing this up involves

Read in order — each section assumes the previous one. Skip to §4 if you only want to run it locally.

1. [Architecture](#1-architecture) — three processes, one repo. Read this first; the rest assumes it.
2. [Required services](#2-required-services) — MongoDB, Redis, S3 storage, Roblox, Discord. **Do this
   before anything else**; the app will not boot without every credential in place.
3. [Full environment reference](#3-full-environment-reference) — the complete variable list.
4. [Local development](#4-local-development) — `.env`, then three commands.
5. [Deploying](#5-deploying-to-digitalocean-app-platform) — three App Platform components.
6. [Hardcoded values to change](#6-hardcoded-values-you-must-change-when-self-hosting) — ⚠️ easy to
   miss and the deployment silently misbehaves without it.
7. [Post-deploy checklist](#7-post-deploy-checklist) — ten checks that prove it works.
8. [Security notes](#8-security-notes) · 9. [Licence](#9-licence) — noncommercial use only.

Budget a few hours: most of it is waiting on managed databases to provision and on Roblox/Discord
app setup, not on the code.

---

## 1. Architecture

ReAdmin is a single repository that builds into **three long-running processes**. All three share the
same `src/services` layer and therefore need the same environment.

| Process | Entry point | Build | Run | Listens on |
| --- | --- | --- | --- | --- |
| **Panel** (Next.js UI + SSR) | `src/pages` | `npm run build` | `npm run start` | `$PORT` (3000) |
| **API** (Fastify: tRPC + in-game REST) | [src/fastifyAPI/index.ts](src/fastifyAPI/index.ts) | `npm run fastify:build` | `npm run fastify:start` | `$PORT` (3001) |
| **Sync worker** (node-cron jobs) | [src/fastifyAPI/sync.index.ts](src/fastifyAPI/sync.index.ts) | `npm run fastify:build` | `npm run sync:start` | — (no port) |

- The panel's browser and SSR code call the **API**, not Next's own API routes — the tRPC client
  points at the API host (see [trpc.ts:10-30](src/utils/trpc.ts#L10-L30)).
- The API also serves the in-game REST surface used by the Roblox loader:
  `/activity`, `/games`, `/ranking`, `/sessions`, `/staff`, `/teams`, `/time-off`, `/users`,
  `/applications`, `/calls`, `/promotion-requests`, `/v2` — see
  [routers/index.ts](src/fastifyAPI/routers/index.ts).
- Two webhook receivers live on the API: `POST /internal/discord` (Discord interactions) and
  `POST /internal/billing` (Stripe).
- The sync worker registers Discord slash commands on boot, then runs every-minute jobs (session
  messaging, bans, game killer, ranking, workspace sync, task reminders, flow engine), hourly
  distributions, and a daily user-info refresh.

**Node 24** is required (`engines.node` in [package.json](package.json)).

---

## 2. Required services

### 2.1 Data stores

| Service | Required? | What it's for | Env vars |
| --- | --- | --- | --- |
| **MongoDB** (DO Managed MongoDB) | **Yes** | Primary datastore — every collection in [mongo.service.ts](src/services/mongo.service.ts#L90) | `MONGODB_URI`, `MONGODB_DATABASE` |
| **Valkey / Redis** (DO Managed Caching) | **Yes** | Cross-process OAuth refresh locking and caching ([redis.client.ts](src/services/redis.client.ts), [cache.service.ts](src/services/cache.service.ts)) | `REDIS_URL` |
| **S3-compatible object storage** (DO Spaces) | **Yes** | Uploads: logos, banners, note/feed/session images, workspace export bundles ([CDN-service.ts](src/services/CDN-service.ts)) | `CDN_ENDPOINT`, `CDN_REIGON`, `CDN_BUCKET_NAME`, `CDN_ACCESS_KEY_ID`, `CDN_SECRET_ACCESS_KEY`, `CDN_URL` |
| **OpenSearch** (DO Managed OpenSearch) | Optional | Fast Roblox user search + in-game chat search. When `OPENSEARCH_URL` is unset every helper is a no-op and callers fall back to MongoDB ([opensearch.service.ts](src/services/opensearch.service.ts)) | `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD` |

**MongoDB.** The client forces `ssl: true` / `tls: true`, so the URI must be a TLS-capable
`mongodb+srv://` (or `mongodb://…?tls=true`) connection string. DO Managed MongoDB satisfies this.
`MONGODB_DATABASE` is the database name (`readmin` on the hosted production instance — pick your own
when self-hosting, since `readmin` is one of the signals used to identify the hosted deployment).
Add the App Platform components to the database's **trusted sources**.

**Indexes provision themselves.** [mongo.service.ts](src/services/mongo.service.ts#L186) declares
the full set — both this file's own `idx_*` indexes and the ones that were originally created by
hand on the hosted cluster — and creates them on every process start. It is idempotent, so restarts
cost nothing, and there is no script to run. See §2.1.1 for what to check afterwards.

**Valkey/Redis.** Use the `rediss://` scheme for DO's TLS-only managed caching cluster. Keys are
namespaced `readmin-<NEXT_PUBLIC_VERCEL_ENV>`, so several environments can share one cluster safely.

**Spaces.** Create a bucket and a Spaces access key pair. Objects are written with explicit ACLs
(`private` by default, `public-read` for public assets) and private objects are served through
presigned URLs cached in the `image_cache` collection.

- `CDN_ENDPOINT` — regional Spaces endpoint, e.g. `https://nyc3.digitaloceanspaces.com`
- `CDN_REIGON` — the region slug, e.g. `nyc3` (yes, the variable name is misspelled in code)
- `CDN_BUCKET_NAME` — bucket name; **defaults to `cdn.readmin.app` if unset**, so always set it
- `CDN_URL` — public base URL used to build asset links (Spaces CDN endpoint or a custom subdomain)

**OpenSearch.** Indexes `roblox_users_<NODE_ENV>` and `game_chats_<NODE_ENV>` are created
automatically on first use. Skip this service entirely for a small instance; search stays functional
via MongoDB, just slower on large member sets.

#### 2.1.1 How index provisioning works

`MANAGED_INDEXES` in [mongo.service.ts](src/services/mongo.service.ts#L186) is the single
declaration of every index the app needs. On start-up each one is created **independently**, and the
process logs either `[mongo] N indexes verified.` or a list of the ones that failed.

Two details worth knowing when reading that list:

- **Entries without an explicit `name`** deliberately take MongoDB's generated default (`loaderId_1`,
  `groupId_-1`, …). Those reproduce indexes originally made by hand on the hosted cluster; naming
  them anything else would raise `IndexOptionsConflict` against the index already there.
- **`user_identity.{keys: 1}`** is declared `unique`, but the hosted cluster carries it non-unique.
  Same key with different uniqueness is a hard conflict, so on that cluster this one entry fails and
  logs while everything else proceeds. Drop the existing `keys_1` if you want the invariant
  enforced — the rebuild then also fails if a key is genuinely shared between two identity
  documents, which is the thing worth finding out.

On a large `roblox_user` or `user_game_session_event` collection the initial builds take a while, and
queries against them stay slow until the build finishes. Builds are backgrounded, so start-up itself
is not blocked.

> **Text indexes are deliberately not provisioned.** The hosted cluster carried 15 of them
> (`{groupId: 'text'}`, `{robloxId: 'text'}`, …). Nothing in `src/` issues a `$text` query, so they
> cost writes and serve no read — and because a text index cannot satisfy an equality match, several
> were *masking a missing ordinary index*: `user.findOne({ robloxId })` sits on the authenticated
> request path and had no usable index at all. Each is replaced by a regular index on the same
> field. If you add a `$text` query, add the text index back alongside it.

### 2.2 Third-party integrations

| Service | Required? | What it's for | Env vars |
| --- | --- | --- | --- |
| **Roblox Open Cloud** | **Yes** | Login, group reads/writes, ranking, place/universe metadata | `ROBLOX_API_KEY`, `ROBLOX_CLIENT_ID`, `ROBLOX_CLIENT_SECRET`, `ROBLOX_COOKIE`, `ROBLOX_USER_ID` |
| **Discord application** | **Yes** | Discord login, workspace bot, slash commands, DMs, logging | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `NEXT_PUBLIC_DISCORD_CLIENT_ID` |
| **Stripe** | Schema-required | Subscription billing. Signups/subscriptions are closed while `READMIN_IS_SHUTTING_DOWN` is true, but the env vars are still validated at boot | `STRIPE_PUBLIC`, `STRIPE_SECRET`, `STRIPE_SIGNING_SECRET` |
| **Bloxlink** | **Yes** (schema) | Discord ID → Roblox ID resolution ([bloxlink.ts](src/services/bloxlink.ts)) | `BLOXLINK_TOKEN` |
| **PostHog** | Optional | Product analytics. The project key was stripped before open-sourcing and is now an empty string, so nothing is sent anywhere — see §6 | — |

#### Roblox

1. **Open Cloud API key** ([create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials))
   → `ROBLOX_API_KEY`. Grant group read/write and universe/place read permissions, and add your
   deployment's egress IPs to the key's IP allowlist (App Platform egress is not a fixed IP — use
   `0.0.0.0/0` or a dedicated egress path).
2. **OAuth 2.0 app** → `ROBLOX_CLIENT_ID` / `ROBLOX_CLIENT_SECRET`.
   - Redirect URI: `https://<panel-domain>/auth/roblox` (add `http://localhost:3000/auth/roblox` for
     local development).
   - Scopes for user login: `openid`, `profile`, `group:read`.
   - Additional scopes for linking a workspace's group: `group:write`, `legacy-group:manage`.
   - ⚠️ The client ID used to *build* the authorize URL is **hardcoded in the frontend** — see §6.
3. **`ROBLOX_COOKIE`** — a `.ROBLOSECURITY` cookie for the bot account, used for the legacy endpoints
   Open Cloud doesn't cover ([roblox.service.ts:389](src/services/roblox.service.ts#L389)). Use a
   dedicated alt account, not a personal one.
4. **`ROBLOX_USER_ID`** — the user ID of that bot account.

#### Discord

Create one application at [discord.com/developers](https://discord.com/developers/applications).

| Setting | Value |
| --- | --- |
| Bot token | → `DISCORD_TOKEN` |
| Public key | → `DISCORD_PUBLIC_KEY` (verifies interaction signatures) |
| Client ID / secret | → `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, plus `NEXT_PUBLIC_DISCORD_CLIENT_ID` (same value, exposed to the browser) |
| **Interactions Endpoint URL** | `https://<api-domain>/internal/discord` |
| OAuth redirect URIs | `https://<panel-domain>/auth/discord`, `https://<panel-domain>/workspaces/discord/link`, `https://<panel-domain>/dashboard/settings/link-discord` |
| Invite scopes | `identify`, `bot`, `applications.commands` |

Discord will not accept the interactions URL until the API is deployed and reachable — it sends a
signed PING first. Slash commands are registered by the **sync worker** at startup
([setup-discord-commands](src/fastifyAPI/sync/setup-discord-commands)), so deploy that component
before expecting commands to appear.

#### Stripe

- `STRIPE_PUBLIC` doubles as the mode switch: a key starting with `pk_test` selects the test product
  and price IDs ([stripe.service.ts:11-13](src/services/stripe.service.ts#L11-L13)).
- Webhook endpoint: `https://<api-domain>/internal/billing` → signing secret goes in
  `STRIPE_SIGNING_SECRET`. The handler requires the raw body, which the API already configures.
- The product/price IDs are hardcoded to ReAdmin's Stripe account — see §6.

### 2.3 Environment variables that are required but unused

[env.js](src/services/env.js) validates the whole environment with Zod and **`process.exit(1)`s on
any failure**, including during `next build`. These four are still required by the schema but are no
longer read anywhere in `src/` — set any non-empty placeholder:

`ROBLOX_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CONTIGUITY_SECRET`

### 2.4 MUI X Pro — a paid, non-transferable licence

The panel depends on three **commercial** MUI packages:

- `@mui/x-data-grid-pro` — the data grid behind the member, activity, and admin tables
- `@mui/x-charts-pro` — dashboard charts
- `@mui/x-date-pickers-pro` — the date-range pickers

**No licence key ships with this source.** The call at
[_app.tsx:119](src/pages/_app.tsx#L119) is `LicenseInfo.setLicenseKey('')` — ReAdmin's own key was
removed before publishing. MUI X licences are sold per developer and are not sublicensable, so a
self-hosted deployment could not lawfully have used it anyway.

> ⚠️ **Out of the box the grids render with a watermark and a console error.** That is the
> unlicensed state, not a bug. Pick one of the options below before putting the panel in front of
> users.

Self-hosters have three options:

1. **Buy your own MUI X Pro licence** ([mui.com/pricing](https://mui.com/pricing)) and set the
   key at [_app.tsx:119](src/pages/_app.tsx#L119).
2. **Downgrade to the free packages** — swap `@mui/x-data-grid-pro` → `@mui/x-data-grid`,
   `@mui/x-charts-pro` → `@mui/x-charts`, `@mui/x-date-pickers-pro` → `@mui/x-date-pickers`, then
   drop the `LicenseInfo` call. This costs the Pro-only features those six files use — column
   pinning/grouping, tree data, and the date-*range* pickers, which have no free equivalent and need
   replacing with two single date pickers. Affected files:
   [DateBetweenPicker.tsx](src/components/ui/DateBetweenPicker.tsx),
   [admin/workspaces](src/pages/admin/workspaces/index.tsx),
   [admin/game-stats](src/pages/admin/game-stats/index.tsx),
   [settings/ranking-api](src/pages/workspaces/%5BgroupId%5D/settings/ranking-api/index.tsx),
   [users/logging](src/pages/workspaces/%5BgroupId%5D/users/%5BuserId%5D/logging/index.tsx).
3. **Run unlicensed** — the current default. The components still render, but with a watermark over
   the grid and a console error. Not a viable option for anything user-facing, and a breach of MUI's
   terms.

Note that `@mui/x-data-grid` and `@mui/x-data-grid-pro` are both listed in `transpilePackages` in
[next.config.js](next.config.js), so option 2 needs no build-config change.

---

## 3. Full environment reference

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | ✅ | `development` \| `test` \| `production` |
| `NEXT_PUBLIC_VERCEL_ENV` | ✅ in practice | `production` \| `development` \| `preview`. Drives the API base URL, CORS allowlist and Redis namespace. Legacy name — nothing about it requires Vercel. |
| `MONGODB_URI` | ✅ | Must be a valid URL; TLS is forced |
| `MONGODB_DATABASE` | ✅ | Database name |
| `REDIS_URL` | ✅ | `rediss://…` for DO managed caching |
| `CDN_ENDPOINT` | ✅ | e.g. `https://nyc3.digitaloceanspaces.com` |
| `CDN_REIGON` | ✅ | e.g. `nyc3` (misspelling intentional) |
| `CDN_BUCKET_NAME` | ⚠️ optional in schema | Defaults to `cdn.readmin.app` — always set it |
| `CDN_ACCESS_KEY_ID` / `CDN_SECRET_ACCESS_KEY` | ✅ | Spaces key pair |
| `CDN_URL` | ✅ | Public asset base URL |
| `CRYPTO_KEY` | ✅ | **Exactly 32 bytes** — AES-256-CBC key used verbatim as `Buffer.from(key)` ([Crypto-service](src/services/Crypto-service.service.ts#L14)). Encrypts stored OAuth tokens. Changing it invalidates every stored token. |
| `JSON_WEB_TOKEN_SECRET` | ✅ | Session JWT signing secret |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_TOKEN` / `DISCORD_PUBLIC_KEY` | ✅ | See §2.2 |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | ✅ | Same as `DISCORD_CLIENT_ID`; needed at **build** time |
| `ROBLOX_API_KEY` / `ROBLOX_CLIENT_ID` / `ROBLOX_CLIENT_SECRET` / `ROBLOX_COOKIE` / `ROBLOX_USER_ID` | ✅ | See §2.2 |
| `STRIPE_PUBLIC` / `STRIPE_SECRET` / `STRIPE_SIGNING_SECRET` | ✅ | See §2.2 |
| `BLOXLINK_TOKEN` | ✅ | Bloxlink API v4 token |
| `OPENSEARCH_URL` / `OPENSEARCH_USERNAME` / `OPENSEARCH_PASSWORD` | Optional | Omit to disable OpenSearch |
| `SELF_HOSTED` | Optional | `true` on any non-`readmin.app` deployment. Enables workspace import. Inferred if unset. |
| `APP_NAME` | Optional | `panel` (default) or `lambda`; only tags the Mongo connection |
| `PORT` | Set by platform | API defaults to 3001, panel to 3000 |
| `ROBLOX_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CONTIGUITY_SECRET` | ✅ (unused) | Placeholders — see §2.3 |
| `NPM_CONFIG_PRODUCTION` | Recommended | Set to `false` so devDependencies (TypeScript) install — required for `fastify:build` |

Because [next.config.js](next.config.js) imports `env.js` at the top, **the Next build fails unless
the complete server environment is present at build time**, not just at runtime.

---

## 4. Local development

```bash
nvm use 24          # or any Node 24 toolchain
npm install
```

Create a `.env` at the repo root with every variable from §3. `NODE_ENV=development`, and leave
`NEXT_PUBLIC_VERCEL_ENV` unset so the tRPC client targets `http://localhost:3001` and the API's CORS
allowlist falls through to `http://localhost:3000`.

Point at throwaway infrastructure — a local or development MongoDB/Redis and a separate Spaces
bucket. The sync worker acts on live data (ranking, bans, game shutdowns, Discord DMs), so never run
it against production while developing.

```bash
npm run dev        # panel  → http://localhost:3000
npm run api:dev    # API    → http://localhost:3001 (tsc --watch + nodemon)
npm run sync:start # optional worker; requires `npm run fastify:build` first
```

Checks:

```bash
npm test                 # jest
npx tsc --noEmit         # panel typecheck
npm run fastify:build    # API typecheck + emit to ./apiBuild
```

> `npm run lint` does not work: ESLint 10 requires a flat `eslint.config.js` and this repo still has
> a legacy `.eslintrc`. Use the two typechecks above instead.

---

## 5. Deploying to DigitalOcean App Platform

### 5.1 Provision infrastructure first

1. **Managed MongoDB** cluster → connection string + database.
2. **Managed Caching (Valkey)** cluster → `rediss://` URI.
3. **Spaces bucket** + access keys (optionally enable the Spaces CDN and attach a subdomain).
4. *(Optional)* **Managed OpenSearch** cluster.

After the app exists, add each App Platform component to the **trusted sources** of every managed
database.

### 5.2 Create the app with three components

All three build from the same repo and branch, and all three need the **full** environment from §3.
Set variables at the **app level** so they are shared, and mark them **encrypted** where secret.

**Component 1 — Web service: `panel`**

| Field | Value |
| --- | --- |
| Type | Web Service |
| Build command | `npm install && npm run build` |
| Run command | `npm run start` |
| HTTP port | `8080` (App Platform injects `PORT`; `next start` honours it) |
| Health check | `/api/health` |
| Routes | `/` |

**Component 2 — Web service: `api`**

| Field | Value |
| --- | --- |
| Type | Web Service |
| Build command | `npm install && npm run fastify:build` |
| Run command | `npm run fastify:start` |
| HTTP port | `8080` (the server reads `PORT`, defaulting to 3001) |
| Health check | `/` (returns `{ success: true, message: 'ReAdmin API' }`) |

**Component 3 — Worker: `sync`**

| Field | Value |
| --- | --- |
| Type | Worker |
| Build command | `npm install && npm run fastify:build` |
| Run command | `npm run sync:start` |

Keep the worker at **exactly one instance**. The jobs are not sharded, and multiple replicas would
duplicate ranking actions, DMs, and distributions.

The API build output lands in `./apiBuild`, and `_moduleAliases` in `package.json` maps `~` there at
runtime via `module-alias` — so the run command must execute from the repo root.

### 5.3 Domains

The panel and API must be on **separate hostnames**, because the panel calls the API cross-origin:

- `panel.<your-domain>` → `panel` component
- `api.<your-domain>` → `api` component
- *(optional)* `cdn.<your-domain>` → Spaces CDN

Both hostnames must be reflected in the hardcoded lists described in §6, or the panel will call the
wrong API and CORS will reject it.

### 5.4 Environment scoping

App Platform lets each variable apply at build time, run time, or both. Set **all** of them to
**"Build and run time"** — `next.config.js` validates the entire schema during the build, and
`NEXT_PUBLIC_*` values are inlined into the client bundle then.

### 5.5 Puppeteer / Chromium

[images.service.ts](src/services/images.service.ts) renders images with `puppeteer-core`, falling
back to `@sparticuz/chromium` when no system Chrome is found. [Aptfile](Aptfile) lists the native
libraries Chromium needs; it is only honoured by apt-aware buildpacks. If image generation fails at
runtime with a shared-library error, either switch that component to a Dockerfile that installs those
packages, or leave image generation unused.

---

## 6. Hardcoded values you must change when self-hosting

These are **not** environment variables. A self-hosted deployment will misbehave — or point at
ReAdmin's own infrastructure — until they are edited.

**Must change, or the deployment does not work:**

| Location | What it is | Why it matters |
| --- | --- | --- |
| [trpc.ts:14-29](src/utils/trpc.ts#L14-L29) | Panel and API base URLs keyed by `NEXT_PUBLIC_VERCEL_ENV` | With `NEXT_PUBLIC_VERCEL_ENV=production` the panel calls `https://api.readmin.app`. Replace with your own hostnames. |
| [fastifyAPI/index.ts:28-36](src/fastifyAPI/index.ts#L28-L36) | CORS allowlist | Your panel domain must be listed or every request is blocked. |
| [next.config.js:48](next.config.js#L48) | Content-Security-Policy allowlist | Add your panel/API/CDN domains or the browser blocks your own assets and API calls. |
| [login/index.tsx:68](src/pages/login/index.tsx#L68), [workspaces/create/index.tsx:426](src/pages/workspaces/create/index.tsx#L426), [settings/integrations/index.tsx:115](src/pages/workspaces/%5BgroupId%5D/settings/integrations/index.tsx#L115) and `:214` | Roblox OAuth `client_id=8369795969584799403` | The authorize URL is built client-side with ReAdmin's client ID; swap in yours (it must match `ROBLOX_CLIENT_ID`). Login fails until you do. |

**Blank placeholders — fill in only if you want the feature:**

| Location | What it is | Why it matters |
| --- | --- | --- |
| [discord.service.ts:285](src/services/discord.service.ts#L285) | Internal Discord logging webhooks (billing, distributions, game errors, image uploads, …) | Redacted to `''`. Every send fails harmlessly until you supply your own webhook URLs. Unrelated to the per-workspace logging webhooks users configure in the UI. |
| [posthog.service.ts:3](src/services/posthog.service.ts#L3) | PostHog project API key | Redacted to `''`, so no analytics are sent. Add your own project key or delete the client. |
| [_app.tsx:119](src/pages/_app.tsx#L119) | MUI X Pro licence key | Empty — grids render watermarked until you supply a licence. See §2.4. |

**Only matters if you enable billing:**

| Location | What it is | Why it matters |
| --- | --- | --- |
| [stripe.service.ts:11-13](src/services/stripe.service.ts#L11-L13) | Stripe product and price IDs | Tied to ReAdmin's Stripe account; billing cannot work with them under your own keys. Signups are closed while `READMIN_IS_SHUTTING_DOWN` is true, so this is inert by default. |
| `https://cdn.readmin.app/...` literals across `src/pages` and `src/server` | Default avatars, logos, in-game preview images | Point at your own bucket if you don't want to depend on ReAdmin's CDN staying up. |

---

## 7. Post-deploy checklist

1. `GET https://api.<domain>/` returns `{ success: true, message: "ReAdmin API" }`.
2. `GET https://panel.<domain>/api/health` returns `{ success: true, status: "ok" }`.
3. API logs show `MongoDB connected`, `[mongo] N indexes verified.`, and no Redis connection errors.
   If the index line instead reports failures, read them — each names the collection, key, and
   reason (§2.1.1).
4. Sync worker logs show `Discord commands setup completed.` followed by minute-interval
   `Running sync tasks...`.
5. Sign in with Roblox at `https://panel.<domain>/login` — this exercises OAuth, JWT issuance,
   `CRYPTO_KEY` encryption, and the Mongo write path in one step.
6. Save Discord's **Interactions Endpoint URL**; it only saves if the signature check passes.
7. Send a Stripe test webhook and confirm a `200` from `/internal/billing`.
8. Upload a workspace logo to confirm Spaces credentials and ACLs.
9. If you set `SELF_HOSTED=true`, confirm the import UI appears at
   `/workspaces/<groupId>/settings/data-export`.
10. Spot-check that the indexes landed: `db.workspace.getIndexes()` should show `loaderId_1`, and
    `db.group_member.getIndexes()` should show several `idx_*` names.

---

## 8. Security notes

Operational notes for anyone running an instance:

- `ROBLOX_COOKIE` is a `.ROBLOSECURITY` session cookie and grants **full account access** — it is the
  single most dangerous value in the environment. Use a dedicated bot account holding only the group
  permissions it needs, never a personal account.
- `CRYPTO_KEY` encrypts every stored OAuth token. Rotating it invalidates all of them, forcing every
  user and workspace to relink — plan the rotation, don't do it casually.
- `JSON_WEB_TOKEN_SECRET` signs session JWTs; rotating it logs everyone out.
- Mark every secret **encrypted** in App Platform (§5.2). Values set as plaintext are visible to
  anyone with read access to the app.

---

## 9. Licence

ReAdmin is source-available under the **PolyForm Noncommercial License 1.0.0** — see
[LICENSE.md](LICENSE.md). Copyright © 2026 ReAdmin, LLC.

You may use, modify, and share it for any **noncommercial** purpose, including running your own
instance for your own Roblox group. Using it for commercial advantage or monetary compensation —
offering it as a hosted or managed service, selling access, or bundling it into a paid product —
requires a separate agreement.

**Commercial licensing enquiries: [matthew@mwalden.tech](mailto:matthew@mwalden.tech).**

Two things this licence does *not* cover:

- **Third-party dependencies**, which are licensed by their own authors. Most notably the MUI X Pro
  packages are commercial software needing a licence bought from MUI — no key ships with this
  source. See §2.4.
- **Redistribution obligations.** If you pass ReAdmin on, PolyForm requires you to include these
  terms and the `Required Notice:` line from [LICENSE.md](LICENSE.md) with it.
