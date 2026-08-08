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

## Quick start — one command on a VPS

If you have a Linux VPS and the credentials from [§2](#2-required-services) to hand, the installer
does the rest:

```bash
git clone https://github.com/Jacksondude1223-bit/open-source-monorepo.git readmin
cd readmin
sudo ./install.sh
```

or, without cloning first:

```bash
curl -fsSL https://raw.githubusercontent.com/Jacksondude1223-bit/open-source-monorepo/master/install.sh | sudo bash
```

[install.sh](install.sh) installs Node 24, asks for every credential one at a time, writes a `0600`
`.env`, generates `CRYPTO_KEY` and `JSON_WEB_TOKEN_SECRET` for you, builds the panel and the API,
and registers all three processes as systemd services — `readmin-panel`, `readmin-api` and
`readmin-sync`. It also writes an nginx config for the two hostnames.

It is safe to re-run: every existing `.env` value comes back as the default, and `CRYPTO_KEY` is
never regenerated (that would invalidate every stored OAuth token).

**Updating later needs no `git pull`.** The installer checks whether your checkout is behind, shows
you the commits, and offers to bring itself up to date — then re-runs the *new* version, so what
installs is what you just pulled:

```bash
sudo ./install.sh            # asks before updating
sudo ./install.sh --update   # updates without asking
```

It refuses to touch a checkout with local edits to tracked files, or one that has diverged from the
remote, and tells you the command to resolve either. Your `.env` is never at risk — it is not
tracked by git.

| Flag | Effect |
| --- | --- |
| `--update` | Pull the latest commit first, without asking, then re-run on it |
| `--no-update` | Never check the repository for newer commits |
| `--yes` / `-y` | Accept confirmations, including the update prompt; still asks for credentials that have no value yet |
| `--env-only` | Run the credential wizard, write `.env`, stop |
| `--non-interactive` | Never prompt; requires a complete `.env` already. Good for re-deploys |
| `--skip-node` / `--skip-deps` / `--skip-build` / `--skip-services` | Skip that stage |
| `--service-user USER` | Run the services as `USER` (default: whoever owns the checkout) |

### HTTPS

The installer offers Let's Encrypt certificates and, if you accept, installs nginx, requests them and
turns on the HTTP→HTTPS redirect. Point two hostnames at the server **first** — it checks DNS before
asking Let's Encrypt for anything, since a failed challenge costs a rate limit.

It asks before writing `.env`, not after, because the answer decides whether the URLs baked into the
panel at build time say `http://` or `https://`. Answering later would mean building twice.

Say no and you get plain HTTP on `http://<ip>:3000`. That works for a look around, but **Discord and
Roblox OAuth generally refuse bare-IP redirect URIs**, so logins will not work, and session cookies
travel unencrypted. Re-run the installer with two hostnames whenever you are ready.

**It still does not do everything.** You have to point DNS at the box before running it, register the
OAuth redirect URIs it prints, and publish your own copies of the in-game Roblox modules
([§6.1](#61-the-in-game-roblox-modules)). The rest of this document explains what the installer is
asking you for and why.

---

## What standing this up involves

Read in order — each section assumes the previous one. Skip to §4 if you only want to run it locally.

1. [Architecture](#1-architecture) — three processes, one repo. Read this first; the rest assumes it.
2. [Required services](#2-required-services) — MongoDB, Redis, S3 storage, Roblox, Discord. **Do this
   before anything else**; the app will not boot without every credential in place.
3. [Full environment reference](#3-full-environment-reference) — the complete variable list.
4. [Local development](#4-local-development) — `.env`, then three commands.
5. [Deploying](#5-deploying-to-digitalocean-app-platform) — three App Platform components.
6. [Hardcoded values to change](#6-hardcoded-values-you-must-change-when-self-hosting) — ⚠️ easy to
   miss and the deployment silently misbehaves without it. Includes
   [the Roblox modules](#61-the-in-game-roblox-modules), which you must republish under your own
   account before anything works **in-game**.
7. [Post-deploy checklist](#7-post-deploy-checklist) — eleven checks that prove it works.
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
- Calling that surface is a **fourth component you deploy separately**: the Roblox modules in
  [modules/](modules/), published to Roblox rather than to your server. They are what run inside each
  game, and they carry your API's hostname baked in — see [§6.1](#61-the-in-game-roblox-modules).
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
| **File storage** — this server's disk, or an S3-compatible bucket | **Yes** (disk needs no account) | Uploads: logos, banners, note/feed/session images, workspace export bundles ([storage/](src/services/storage)) | `STORAGE_DRIVER`, then either `STORAGE_LOCAL_PATH` or the `CDN_*` set |
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

**File storage.** Objects are written with explicit ACLs (`private` by default, `public-read` for
public assets); private objects are reached through expiring signed URLs cached in the `image_cache`
collection. `STORAGE_DRIVER` picks where the bytes actually live — the two drivers are in
[services/storage/](src/services/storage) and nothing above that layer knows the difference.

*`STORAGE_DRIVER=local` — the VPS's own disk.* No account, no bucket, no bill. This is what
`install.sh` offers first.

- `STORAGE_LOCAL_PATH` — directory holding the objects, default `/var/lib/readmin/storage`. It gets
  an `objects/` tree (the bytes, at their key paths) and a `meta/` tree (content type and ACL).
- The API serves it at `<NEXT_PUBLIC_API_URL>/files`: `/files/signed/<key>` for private objects,
  carrying an HMAC over the key and expiry, and `/files/public/<key>` for `public-read` ones. A
  private object is a 404 on the public route, so a guessed key gets nothing.
- **All three processes must be able to write it.** The panel, API and sync worker all serve tRPC,
  so all three accept uploads. `install.sh` creates the directory owned by the service user and adds
  it to each unit's `ReadWritePaths`.
- **Back it up.** Unlike MongoDB this is not reproducible from anywhere else, and no managed service
  is replicating it for you.

*`STORAGE_DRIVER=s3` — any S3-compatible bucket* (DO Spaces, Cloudflare R2, MinIO, S3). Create a
bucket and an access key pair, then set:

- `CDN_ENDPOINT` — regional endpoint, e.g. `https://nyc3.digitaloceanspaces.com`
- `CDN_REIGON` — the region slug, e.g. `nyc3` (yes, the variable name is misspelled in code)
- `CDN_BUCKET_NAME` — bucket name; **defaults to `cdn.readmin.app` if unset**, so always set it
- `CDN_ACCESS_KEY_ID` / `CDN_SECRET_ACCESS_KEY` — the key pair
- `CDN_URL` — public base URL used to build asset links (bucket CDN endpoint or a custom subdomain)

Switching drivers does not migrate anything. Moving between them means copying the objects across
yourself, keeping the same key layout.

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

### 2.4 MUI — no licence needed

The panel's UI is [MUI](https://mui.com), which is **free and MIT licensed**. Nothing here needs a
paid key, and no watermark appears.

It did once. The panel used to depend on three *commercial* packages — `@mui/x-data-grid-pro`,
`@mui/x-charts-pro` and `@mui/x-date-pickers-pro` — and shipped with an empty
`LicenseInfo.setLicenseKey('')`, so grids rendered watermarked with a console error until you bought
your own licence. MUI X licences are per developer and not sublicensable, so a self-hosted
deployment could not lawfully have used ReAdmin's key anyway.

Those are gone. The panel now uses only the free tier:

| Was | Now |
| --- | --- |
| `@mui/x-data-grid-pro` | `@mui/x-data-grid` |
| `@mui/x-date-pickers-pro` | `@mui/x-date-pickers` |
| `@mui/x-charts-pro` | `@mui/x-charts` — it was already unused, every chart imported the free package |

Two Pro-only features were in use and were rebuilt rather than dropped:

- **The date-*range* picker** ([DateBetweenPicker.tsx](src/components/ui/DateBetweenPicker.tsx)) has
  no free equivalent. It is now two ordinary date pickers; the end date will not accept a day before
  the start. Consumers are unaffected — the component still exposes the same hidden `#startdate` and
  `#enddate` inputs.
- **The master-detail evidence panel** on
  [users/logging](src/pages/workspaces/%5BgroupId%5D/users/%5BuserId%5D/logging/index.tsx) —
  expandable detail rows are paid. Evidence is now an **Evidence** column showing the attachment
  count, which opens the same attachments in a dialog.

No Pro-only grid features (column pinning, row grouping, tree data) were used, so the four grids
carried over unchanged beyond the component name.

If you would rather have the Pro components back, buy a licence at
[mui.com/pricing](https://mui.com/pricing), reinstall the three `-pro` packages, and restore the
`LicenseInfo.setLicenseKey(...)` call in [_app.tsx](src/pages/_app.tsx). You do not need to: the free
tier is a complete panel.

---

## 3. Full environment reference

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | ✅ | `development` \| `test` \| `production` |
| `NEXT_PUBLIC_VERCEL_ENV` | ✅ in practice | `production` \| `development` \| `preview`. Drives the API base URL, CORS allowlist and Redis namespace. Legacy name — nothing about it requires Vercel. |
| `MONGODB_URI` | ✅ | Must be a valid URL; TLS is forced |
| `MONGODB_DATABASE` | ✅ | Database name |
| `REDIS_URL` | ✅ | `rediss://…` for DO managed caching |
| `STORAGE_DRIVER` | Optional | `local` (this server's disk) or `s3` (a bucket). Defaults to `s3` |
| `STORAGE_LOCAL_PATH` | ✅ when `local` | Directory for uploads, default `/var/lib/readmin/storage`. Must be writable by all three processes |
| `CDN_ENDPOINT` | ✅ when `s3` | e.g. `https://nyc3.digitaloceanspaces.com` |
| `CDN_REIGON` | ✅ when `s3` | e.g. `nyc3` (misspelling intentional) |
| `CDN_BUCKET_NAME` | ⚠️ optional in schema | Defaults to `cdn.readmin.app` — always set it |
| `CDN_ACCESS_KEY_ID` / `CDN_SECRET_ACCESS_KEY` | ✅ when `s3` | Bucket key pair |
| `CDN_URL` | ✅ when `s3` | Public asset base URL |
| `CRYPTO_KEY` | ✅ | **Exactly 32 bytes** — AES-256-CBC key used verbatim as `Buffer.from(key)` ([Crypto-service](src/services/Crypto-service.service.ts#L14)). Encrypts stored OAuth tokens. Changing it invalidates every stored token. |
| `JSON_WEB_TOKEN_SECRET` | ✅ | Session JWT signing secret |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_TOKEN` / `DISCORD_PUBLIC_KEY` | ✅ | See §2.2 |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | ✅ | Same as `DISCORD_CLIENT_ID`; needed at **build** time |
| `ROBLOX_API_KEY` / `ROBLOX_CLIENT_ID` / `ROBLOX_CLIENT_SECRET` / `ROBLOX_COOKIE` / `ROBLOX_USER_ID` | ✅ | See §2.2 |
| `STRIPE_PUBLIC` / `STRIPE_SECRET` / `STRIPE_SIGNING_SECRET` | ✅ | See §2.2 |
| `BLOXLINK_TOKEN` | ✅ | Bloxlink API v4 token |
| `OPENSEARCH_URL` / `OPENSEARCH_USERNAME` / `OPENSEARCH_PASSWORD` | Optional | Omit to disable OpenSearch |
| `SELF_HOSTED` | Optional | `true` on any non-`readmin.app` deployment. Enables workspace import. Inferred if unset. |
| `NEXT_PUBLIC_PANEL_URL` / `NEXT_PUBLIC_API_URL` | ✅ when self-hosting | Your own panel and API URLs. Set, they replace the `readmin.app` defaults in [trpc.ts](src/utils/trpc.ts) whatever `NEXT_PUBLIC_VERCEL_ENV` says. Read at **build** time. |
| `NEXT_PUBLIC_ROBLOX_CLIENT_ID` | ✅ when self-hosting | Your Roblox OAuth app, used to build the authorize URL in the browser. Must equal `ROBLOX_CLIENT_ID`. Defaults to ReAdmin's app, which will not accept your redirect URIs. |
| `CORS_ORIGINS` | ✅ when self-hosting | Comma-separated origins the API accepts. Replaces the built-in allowlist in [fastifyAPI/index.ts](src/fastifyAPI/index.ts). At minimum your panel URL. |
| `CSP_EXTRA_DOMAINS` | ✅ when self-hosting | Space-separated hosts appended to the panel's CSP — panel, API and CDN. Without them the browser blocks your own assets. |
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

`./install.sh --env-only` walks you through the whole variable list and writes the `.env` for you,
if you would rather not assemble one by hand.

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
>
> `npm test` does not work either: [jest.config.ts](jest.config.ts) imports `tsconfig.json` as an ES
> module without an import attribute, which Node ≥22 rejects (`ERR_IMPORT_ATTRIBUTE_MISSING`) before
> a single test runs. Unrelated to the installer, which never invokes it.

---

## 5. Deploying to DigitalOcean App Platform

### 5.1 Provision infrastructure first

1. **Managed MongoDB** cluster → connection string + database.
2. **Managed Caching (Valkey)** cluster → `rediss://` URI.
3. **Spaces bucket** + access keys (optionally enable the Spaces CDN and attach a subdomain).
   Skip this if you set `STORAGE_DRIVER=local` — but note App Platform containers have ephemeral
   disks, so on that platform a bucket is the right answer. Local storage suits a plain VPS.
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

A self-hosted deployment will misbehave — or point at ReAdmin's own infrastructure — until these are
dealt with. Most are now environment variables, which [install.sh](install.sh) fills in for you; the
last two are not, and no installer can do them for you.

**Environment variables, set by the installer (or by hand — see §3):**

| Setting | What it replaces | Why it matters |
| --- | --- | --- |
| `NEXT_PUBLIC_PANEL_URL` / `NEXT_PUBLIC_API_URL` | Panel and API base URLs in [trpc.ts](src/utils/trpc.ts) | Unset, `NEXT_PUBLIC_VERCEL_ENV=production` makes the panel call `https://api.readmin.app`. |
| `CORS_ORIGINS` | The allowlist in [fastifyAPI/index.ts](src/fastifyAPI/index.ts) | Your panel origin must be listed or every request is blocked. |
| `CSP_EXTRA_DOMAINS` | Additions to the CSP in [next.config.js](next.config.js) | Without your own domains the browser blocks your assets and API calls. |
| `NEXT_PUBLIC_ROBLOX_CLIENT_ID` | The default client ID in [robloxOAuth.ts](src/utils/robloxOAuth.ts) | The authorize URL is built in the browser. Login fails until it names *your* Roblox app. |

All four are read at **build** time, so changing one means rebuilding (`sudo ./install.sh --yes`,
or `npm run build`) — restarting the services is not enough.

**Still genuinely hardcoded — you must edit or republish these yourself:**

| Location | What it is | Why it matters |
| --- | --- | --- |
| [downloads/index.tsx:2528](src/pages/workspaces/%5BgroupId%5D/settings/downloads/index.tsx#L2528) and [:2903](src/pages/workspaces/%5BgroupId%5D/settings/downloads/index.tsx#L2903) | `require()` asset IDs for the two in-game Roblox modules | Nothing in-game works until you publish your own copies. **See §6.1** — this one is a Studio job, not a code edit. |

**Blank placeholders — fill in only if you want the feature:**

| Location | What it is | Why it matters |
| --- | --- | --- |
| [discord.service.ts:285](src/services/discord.service.ts#L285) | Internal Discord logging webhooks (billing, distributions, game errors, image uploads, …) | Redacted to `''`. Every send fails harmlessly until you supply your own webhook URLs. Unrelated to the per-workspace logging webhooks users configure in the UI. |
| [posthog.service.ts:3](src/services/posthog.service.ts#L3) | PostHog project API key | Redacted to `''`, so no analytics are sent. Add your own project key or delete the client. |

**Only matters if you enable billing:**

| Location | What it is | Why it matters |
| --- | --- | --- |
| [stripe.service.ts:11-13](src/services/stripe.service.ts#L11-L13) | Stripe product and price IDs | Tied to ReAdmin's Stripe account; billing cannot work with them under your own keys. Signups are closed while `READMIN_IS_SHUTTING_DOWN` is true, so this is inert by default. |
| `https://cdn.readmin.app/...` literals across `src/pages` and `src/server` | Default avatars, logos, in-game preview images | Point at your own bucket if you don't want to depend on ReAdmin's CDN staying up. |

### 6.1 The in-game Roblox modules

Do this once the panel is deployed and you can log in — everything below needs your API's real
hostname.

Half of ReAdmin runs inside Roblox, and that half is **not** deployed with the rest of the app. The
`.rbxm` sources live in [modules/](modules/):

| File | Published as | Referenced from |
| --- | --- | --- |
| [Activity Tracker.rbxm](modules/) | `require(13742588012)` | [downloads/index.tsx:2903](src/pages/workspaces/%5BgroupId%5D/settings/downloads/index.tsx#L2903) |
| [Application Center.rbxm](modules/) | `require(90428048416593)` | [downloads/index.tsx:2528](src/pages/workspaces/%5BgroupId%5D/settings/downloads/index.tsx#L2528) |

**How the pieces fit together.** A workspace owner downloads a loader from
`/workspaces/<groupId>/settings/downloads`. The panel generates that file on the fly and bakes in two
things: the workspace's `loaderId` (its API credential — injected automatically, nothing to change)
and a `require(<assetId>)` pointing at a **published Roblox model**. That model is where the actual
tracker code lives, and **the API base URL is hardcoded inside it**. Today those asset IDs resolve to
ReAdmin's models, which call `api.readmin.app`.

So a self-hosted instance fails in a quiet way: the panel works, owners can download loaders, and
every in-game request goes to ReAdmin's API — which rejects it, because it has never heard of your
`loaderId`. Nothing crashes; the tracker just never records anything.

Fixing it is a four-step loop per module:

1. **Import** the `.rbxm` into Roblox Studio (right-click a service → *Insert from File*).
2. **Repoint the URL.** Find the hardcoded API base inside the module's scripts and change it to your
   own `https://api.<your-domain>`. Search the scripts for `readmin` — `Activity Tracker` ships
   pointing at `api.readmin.app` and `Application Center` at `api.readmin.dev`. Confirm you've caught
   every occurrence before publishing; these are compiled models, so grepping the file from outside
   Studio will not reliably find them all.
3. **Publish to Roblox** (right-click the model → *Publish to Roblox*) and copy the new asset ID from
   its library URL. Set the model's **Distribute on Creator Store** / sharing so your games can
   `require()` it — a private model only loads in places owned by the same account or group.
4. **Swap the ID** into the matching `require(...)` in
   [downloads/index.tsx](src/pages/workspaces/%5BgroupId%5D/settings/downloads/index.tsx), then
   redeploy the panel so freshly generated loaders point at your model.

Loaders downloaded before the swap keep the old asset ID baked in — after changing it, anyone who
already installed one needs to re-download from the same page and replace the script in their game.

> **`require()` by asset ID only works in a published place with HTTP requests enabled.** Test in a
> real published game, not in Studio's local play mode, or you'll be debugging the wrong problem.

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
11. **End-to-end the in-game half** (§6.1): download a loader from
    `/workspaces/<groupId>/settings/downloads`, drop it into a published test place, join, and
    confirm the session shows up under the workspace's activity. If the panel is healthy but this
    step records nothing, you are almost certainly still pointing at ReAdmin's published modules.

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

- **Third-party dependencies**, which are licensed by their own authors. All of them are free to
  use — the panel deliberately stays on MUI's MIT-licensed tier and needs no purchased key. See
  §2.4.
- **Redistribution obligations.** If you pass ReAdmin on, PolyForm requires you to include these
  terms and the `Required Notice:` line from [LICENSE.md](LICENSE.md) with it.
